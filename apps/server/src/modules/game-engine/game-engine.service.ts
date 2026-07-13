import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { nanoid } from "nanoid";
import { computeScore } from "../../common/utils/compute-score";
import { applyFloor, eloDelta, kFactor } from "../../common/utils/elo";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  AnswerResultPayload,
  StateSyncPayload,
  SubmitAnswerAck,
  TypedServer,
} from "../realtime/realtime.types";
import {
  GameMeta,
  LeaderboardEntry,
  LiveQuestion,
  RosterEntry,
  toPublicQuestion,
} from "./game-engine.types";
import { GameStoreService } from "./game-store.service";

/** Countdown shown on clients between "start game" and the first question. */
const START_COUNTDOWN_MS = 3_200;
/** Latency grace added to every question deadline. */
const DEADLINE_GRACE_MS = 300;
/** Auto-advance delay after a reveal in hostless (duel) games. */
const DUEL_REVEAL_MS = 4_000;
/** How long a disconnected lobby player is kept before removal. */
const LOBBY_DISCONNECT_GRACE_MS = 60_000;
/** A classic game whose host has been gone this long is ended by the sweeper. */
const HOST_ABANDON_MS = 5 * 60_000;
/** A duel player disconnected this long mid-game forfeits the match. */
const DUEL_FORFEIT_MS = 30_000;
const SWEEP_INTERVAL_MS = 15_000;

/**
 * Server-authoritative game loop. All timing, question advancement and
 * scoring decisions happen here; the gateway only relays client intent
 * (start-game / host-next / submit-answer) and the engine pushes phase
 * transitions to the room. Live state lives in Redis (GameStoreService) so
 * a process restart or a second instance can pick a game back up.
 */
@Injectable()
export class GameEngineService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(GameEngineService.name);
  private readonly instanceId = nanoid(10);
  private io: TypedServer | null = null;
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly disconnectTimers = new Map<string, NodeJS.Timeout>();
  private sweeper: NodeJS.Timeout | null = null;

  constructor(
    private readonly store: GameStoreService,
    private readonly prisma: PrismaService,
  ) {}

  setServer(io: TypedServer): void {
    this.io = io;
  }

  // -- lifecycle -------------------------------------------------------------

  async onApplicationBootstrap(): Promise<void> {
    await this.recoverTimers().catch((err) =>
      this.logger.error("Timer recovery failed", err),
    );
    this.sweeper = setInterval(() => {
      void this.sweep().catch((err) => this.logger.error("Sweep failed", err));
    }, SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  onApplicationShutdown(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    for (const t of this.timers.values()) clearTimeout(t);
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
  }

  // -- session bootstrap -------------------------------------------------------

  /** Create the live session record on first socket contact (idempotent). */
  async ensureLiveSession(
    gameCode: string,
    init: { sessionId: string; quizId: string; hostId: string },
  ): Promise<void> {
    await this.store.initMeta(gameCode, {
      sessionId: init.sessionId,
      quizId: init.quizId,
      quizTitle: "",
      hostId: init.hostId,
      mode: "classic",
      phase: "lobby",
      qIndex: 0,
      qId: "",
      qStartAt: 0,
      qDeadline: 0,
      qCount: 0,
      startedAt: 0,
      hostConnected: false,
      hostLastSeenAt: Date.now(),
    });
  }

  /**
   * Bootstrap a hostless duel entirely in Redis (no GameSession row). The
   * matchmaker calls this once both players are paired; the first question
   * fires after the start countdown whether or not both have connected yet.
   */
  async startDuel(
    gameCode: string,
    players: {
      id: string;
      name: string;
      profilePic: string | null;
      userId: string;
    }[],
    questions: LiveQuestion[],
  ): Promise<void> {
    const now = Date.now();
    const firstQuestionAt = now + START_COUNTDOWN_MS;
    await this.store.initMeta(gameCode, {
      sessionId: "",
      quizId: "",
      quizTitle: "1v1 Duel",
      hostId: "",
      mode: "duel",
      phase: "starting",
      qIndex: 0,
      qId: "",
      qStartAt: 0,
      qDeadline: firstQuestionAt,
      qCount: questions.length,
      startedAt: now,
      hostConnected: false,
      hostLastSeenAt: now,
    });
    await this.store.setQuestions(gameCode, questions);
    for (const p of players) {
      await this.store.upsertPlayer(gameCode, {
        id: p.id,
        name: p.name,
        profilePic: p.profilePic,
        connected: false,
        lastSeenAt: now,
        userId: p.userId,
      });
    }
    await this.store.setDeadline(gameCode, firstQuestionAt);
    await this.store.ensureOwner(gameCode, this.instanceId);
    this.armTimer(gameCode, firstQuestionAt - now);
    this.logger.log(
      `Duel ${gameCode} started: ${players.map((p) => p.id).join(" vs ")}`,
    );
  }

  // -- host intents ------------------------------------------------------------

  async startGame(gameCode: string): Promise<void> {
    const meta = await this.store.getMeta(gameCode);
    if (!meta || meta.phase !== "lobby") return;

    const session = await this.prisma.db.gameSession.findUnique({
      where: { gameCode },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
              include: { options: { orderBy: { createdAt: "asc" } } },
            },
          },
        },
      },
    });
    if (!session || session.quiz.questions.length === 0) {
      this.logger.error(`Cannot start ${gameCode}: no session or questions`);
      return;
    }

    const questions: LiveQuestion[] = session.quiz.questions.map((q) => ({
      id: q.id,
      title: q.title,
      media: q.media,
      mediaType: q.mediaType,
      timeOut: q.timeOut,
      options: q.options.map((o) => ({
        id: o.id,
        title: o.title,
        isCorrect: o.isCorrect,
      })),
    }));
    await this.store.setQuestions(gameCode, questions);

    const now = Date.now();
    const firstQuestionAt = now + START_COUNTDOWN_MS;
    await this.store.patchMeta(gameCode, {
      phase: "starting",
      quizTitle: session.quiz.title,
      qCount: questions.length,
      startedAt: now,
      qDeadline: firstQuestionAt,
    });
    await this.store.setDeadline(gameCode, firstQuestionAt);
    await this.store.ensureOwner(gameCode, this.instanceId);

    // Legacy compat: joining checks / player-play context still read this row.
    await this.prisma.db.gameSession.update({
      where: { gameCode },
      data: { isPlaying: true },
    });

    this.emitRoom(gameCode).emit("game-started");
    this.armTimer(gameCode, firstQuestionAt - now);
    this.logger.log(`Game ${gameCode} started (${questions.length} questions)`);
  }

  /**
   * Single pacing intent from the host. The server decides what "next" means
   * from the current phase.
   */
  async hostNext(gameCode: string): Promise<void> {
    const meta = await this.store.getMeta(gameCode);
    if (!meta) return;
    switch (meta.phase) {
      case "question":
        await this.enterReveal(gameCode);
        break;
      case "reveal":
        if (meta.qIndex + 1 < meta.qCount) {
          await this.enterQuestion(gameCode, meta.qIndex + 1);
        } else {
          await this.enterFinal(gameCode);
        }
        break;
      case "final":
        await this.endGame(gameCode);
        break;
      default:
        break;
    }
  }

  async endGame(
    gameCode: string,
    opts?: { forfeitLoserId?: string; abandoned?: boolean },
  ): Promise<void> {
    const meta = await this.store.getMeta(gameCode);
    if (!meta || meta.phase === "ended") return;
    this.clearTimer(gameCode);
    await this.store.clearDeadline(gameCode);

    // Atomic claim: only the caller that flips phase -> "ended" persists the
    // result and cleans up, so concurrent callers can't double-write.
    const claimed = await this.store.claimEnded(gameCode);
    if (!claimed) return;

    const entries = await this.buildLeaderboard(gameCode);
    const { resultId, eloChanges } = await this.persistResult(
      gameCode,
      meta,
      entries,
      opts,
    );

    this.emitRoom(gameCode).emit("game-over", { entries, resultId, eloChanges });
    this.emitRoom(gameCode).emit("game-session-ended");

    // Classic games have a lobby record to tear down; duels are Redis-only.
    // PlayerAnswer is no longer written by the engine (live state lives in Redis,
    // final state in GameResult); cleanup is a no-op for backward compat.
    if (meta.mode === "classic" && meta.sessionId) {
      await this.prisma.db
        .$transaction([
          this.prisma.db.player.updateMany({
            where: { gameId: meta.sessionId },
            data: { gameId: null },
          }),
          this.prisma.db.gameSession.delete({ where: { id: meta.sessionId } }),
        ])
        .catch((err) =>
          this.logger.error(`Postgres cleanup failed for ${gameCode}`, err),
        );
    }

    await this.store.deleteGame(gameCode, meta.qCount);
    this.logger.log(`Game ${gameCode} ended`);
  }

  // -- player intents -----------------------------------------------------------

  async submitAnswer(
    gameCode: string,
    playerId: string,
    qIndex: number,
    optionId: string,
  ): Promise<SubmitAnswerAck> {
    const meta = await this.store.getMeta(gameCode);
    if (!meta || meta.phase !== "question") {
      return { accepted: false, reason: "No question is active" };
    }
    if (qIndex !== meta.qIndex) {
      return { accepted: false, reason: "Question already advanced" };
    }
    const now = Date.now();
    if (now > meta.qDeadline) {
      return { accepted: false, reason: "Time is up" };
    }

    const questions = await this.store.getQuestions(gameCode);
    const question = questions?.[qIndex];
    if (!question) {
      return { accepted: false, reason: "Question not found" };
    }
    const option = question.options.find((o) => o.id === optionId);
    if (!option) {
      return { accepted: false, reason: "Invalid option" };
    }

    // Server-measured time: never trust the client clock.
    const timeTakenMs = Math.max(0, now - meta.qStartAt);
    const score = computeScore(option.isCorrect, timeTakenMs, question.timeOut);

    const stored = await this.store.putAnswer(gameCode, qIndex, playerId, {
      optionId,
      answeredAt: now,
      timeTakenMs,
      isCorrect: option.isCorrect,
      score,
    });
    if (!stored) {
      return { accepted: false, reason: "Already answered" };
    }
    await this.store.addScore(gameCode, playerId, score);

    await this.maybeRevealEarly(gameCode, qIndex);
    return { accepted: true };
  }

  /**
   * Legacy-HTTP entry point: answers against whatever question is currently
   * active. Time is still measured server-side.
   */
  async submitAnswerCurrent(
    gameCode: string,
    playerId: string,
    optionId: string,
  ): Promise<SubmitAnswerAck> {
    const meta = await this.store.getMeta(gameCode);
    if (!meta || meta.phase !== "question") {
      return { accepted: false, reason: "No question is active" };
    }
    return this.submitAnswer(gameCode, playerId, meta.qIndex, optionId);
  }

  // -- roster / presence -----------------------------------------------------------

  async playerConnected(
    gameCode: string,
    player: { id: string; name: string; profilePic: string | null },
  ): Promise<void> {
    const existing = await this.store.getPlayer(gameCode, player.id);
    await this.store.upsertPlayer(gameCode, {
      id: player.id,
      name: player.name,
      profilePic: player.profilePic,
      connected: true,
      lastSeenAt: Date.now(),
      userId: existing?.userId,
    });
    this.cancelDisconnectGrace(gameCode, player.id);
    this.emitRoom(gameCode).emit("player-connection", {
      playerId: player.id,
      connected: true,
    });
  }

  async playerDisconnected(gameCode: string, playerId: string): Promise<void> {
    const entry = await this.store.getPlayer(gameCode, playerId);
    if (!entry) return;
    await this.store.upsertPlayer(gameCode, {
      ...entry,
      connected: false,
      lastSeenAt: Date.now(),
    });
    this.emitRoom(gameCode).emit("player-connection", {
      playerId,
      connected: false,
    });

    const meta = await this.store.getMeta(gameCode);
    const graceKey = `${gameCode}:${playerId}`;

    if (meta?.mode === "duel") {
      // A duel player who stays gone forfeits the match.
      const timer = setTimeout(() => {
        this.disconnectTimers.delete(graceKey);
        void this.resolveDuelForfeit(gameCode, playerId).catch((err) =>
          this.logger.error("Duel forfeit handling failed", err),
        );
      }, DUEL_FORFEIT_MS);
      timer.unref();
      this.disconnectTimers.set(graceKey, timer);
    } else {
      // In the lobby a dropped player is removed after a grace period;
      // mid-game they keep their score and may rejoin.
      const timer = setTimeout(() => {
        this.disconnectTimers.delete(graceKey);
        void this.removeIfStillGone(gameCode, playerId).catch((err) =>
          this.logger.error("Lobby grace removal failed", err),
        );
      }, LOBBY_DISCONNECT_GRACE_MS);
      timer.unref();
      this.disconnectTimers.set(graceKey, timer);
    }

    // If everyone still connected has answered, don't wait for the deadline.
    if (meta?.phase === "question") {
      await this.maybeRevealEarly(gameCode, meta.qIndex);
    }
  }

  private async resolveDuelForfeit(
    gameCode: string,
    playerId: string,
  ): Promise<void> {
    const meta = await this.store.getMeta(gameCode);
    if (!meta || meta.phase === "ended") return;
    const roster = await this.store.roster(gameCode);
    const player = roster.find((p) => p.id === playerId);
    if (!player || player.connected) return;
    const opponent = roster.find((p) => p.id !== playerId);
    if (opponent?.connected) {
      this.logger.log(`Duel ${gameCode}: ${playerId} forfeits (disconnected)`);
      await this.endGame(gameCode, {
        forfeitLoserId: player.userId ?? playerId,
      });
    } else {
      this.logger.log(`Duel ${gameCode}: both players gone — abandoned`);
      await this.endGame(gameCode, { abandoned: true });
    }
  }

  async removePlayer(gameCode: string, playerId: string): Promise<void> {
    await this.store.removePlayer(gameCode, playerId);
    this.cancelDisconnectGrace(gameCode, playerId);
  }

  async hostConnected(gameCode: string, connected: boolean): Promise<void> {
    await this.store.patchMeta(gameCode, {
      hostConnected: connected,
      hostLastSeenAt: Date.now(),
    });
  }

  // -- snapshot ----------------------------------------------------------------------

  async getSnapshot(
    gameCode: string,
    playerId?: string | null,
  ): Promise<StateSyncPayload | null> {
    const meta = await this.store.getMeta(gameCode);
    if (!meta) return null;
    const now = Date.now();
    const roster = await this.store.roster(gameCode);

    const payload: StateSyncPayload = {
      phase: meta.phase,
      mode: meta.mode,
      qIndex: meta.qIndex,
      qCount: meta.qCount,
      serverNow: now,
      players: roster.map((p) => ({
        id: p.id,
        name: p.name,
        profilePic: p.profilePic,
        connected: p.connected,
      })),
    };

    if (meta.phase === "question" || meta.phase === "reveal") {
      const questions = await this.store.getQuestions(gameCode);
      const question = questions?.[meta.qIndex];
      if (question) {
        if (meta.phase === "question") {
          payload.question = toPublicQuestion(question);
          payload.startAt = meta.qStartAt;
          payload.deadline = meta.qDeadline;
        } else {
          const answers = await this.store.getAnswers(gameCode, meta.qIndex);
          payload.reveal = {
            index: meta.qIndex,
            counts: question.options.map(
              (o) =>
                Object.values(answers).filter((a) => a.optionId === o.id)
                  .length,
            ),
            correctOptionIds: question.options
              .filter((o) => o.isCorrect)
              .map((o) => o.id),
          };
        }
      }
    }

    if (
      meta.phase === "reveal" ||
      meta.phase === "final" ||
      meta.phase === "ended"
    ) {
      payload.leaderboard = await this.buildLeaderboard(gameCode);
    }

    if (playerId) {
      payload.you = await this.buildAnswerResult(gameCode, meta, playerId);
    }

    return payload;
  }

  // -- transitions -------------------------------------------------------------------

  private async enterQuestion(gameCode: string, index: number): Promise<void> {
    const questions = await this.store.getQuestions(gameCode);
    const question = questions?.[index];
    if (!question) {
      this.logger.error(`Question ${index} missing for ${gameCode}`);
      return;
    }
    const now = Date.now();
    const deadline = now + question.timeOut * 1000 + DEADLINE_GRACE_MS;
    await this.store.patchMeta(gameCode, {
      phase: "question",
      qIndex: index,
      qId: question.id,
      qStartAt: now,
      qDeadline: deadline,
    });
    await this.store.setDeadline(gameCode, deadline);

    this.emitRoom(gameCode).emit("question-start", {
      index,
      qCount: questions.length,
      question: toPublicQuestion(question),
      startAt: now,
      deadline,
      serverNow: now,
    });
    // Legacy dual-emit for not-yet-migrated clients.
    if (index === 0) {
      this.emitRoom(gameCode).emit("get-question-index", 0);
    } else {
      this.emitRoom(gameCode).emit("question-changed", index);
    }
    this.emitRoom(gameCode).emit("timer-starts");

    this.armTimer(gameCode, deadline - now);
  }

  private async enterReveal(gameCode: string): Promise<void> {
    const meta = await this.store.getMeta(gameCode);
    if (!meta || meta.phase !== "question") return;
    this.clearTimer(gameCode);

    const questions = await this.store.getQuestions(gameCode);
    const question = questions?.[meta.qIndex];
    if (!question) return;
    const answers = await this.store.getAnswers(gameCode, meta.qIndex);

    const counts = question.options.map(
      (o) => Object.values(answers).filter((a) => a.optionId === o.id).length,
    );
    const correctOptionIds = question.options
      .filter((o) => o.isCorrect)
      .map((o) => o.id);

    const isDuel = meta.mode === "duel";
    const revealUntil = isDuel ? Date.now() + DUEL_REVEAL_MS : 0;
    await this.store.patchMeta(gameCode, {
      phase: "reveal",
      qDeadline: revealUntil,
    });
    if (isDuel) {
      await this.store.setDeadline(gameCode, revealUntil);
      this.armTimer(gameCode, DUEL_REVEAL_MS);
    } else {
      await this.store.clearDeadline(gameCode);
    }

    this.emitRoom(gameCode).emit("question-end", {
      index: meta.qIndex,
      counts,
      correctOptionIds,
    });
    // Legacy dual-emit.
    this.emitRoom(gameCode).emit("displaying-result", {
      presenter: counts,
      player: Object.entries(answers).map(([playerId, a]) => ({
        playerId,
        isCorrect: a.isCorrect,
      })),
    });

    // Running leaderboard so the host screen needs no REST round-trip.
    const entries = await this.buildLeaderboard(gameCode);
    this.emitRoom(gameCode).emit("leaderboard", { entries, isFinal: false });

    // Personal outcomes to per-player rooms (cross-instance via redis-adapter).
    const roster = await this.store.roster(gameCode);
    for (const player of roster) {
      const result = await this.buildAnswerResult(gameCode, meta, player.id);
      this.io?.to(`player:${player.id}`).emit("answer-result", result);
    }
  }

  private async enterFinal(gameCode: string): Promise<void> {
    const meta = await this.store.getMeta(gameCode);
    if (!meta || meta.phase !== "reveal") return;
    this.clearTimer(gameCode);
    await this.store.clearDeadline(gameCode);
    await this.store.patchMeta(gameCode, { phase: "final", qDeadline: 0 });

    const entries = await this.buildLeaderboard(gameCode);
    this.emitRoom(gameCode).emit("leaderboard", { entries, isFinal: true });
    // Legacy dual-emit, shaped like the old Prisma include result.
    this.emitRoom(gameCode).emit(
      "displaying-final-leaderboard",
      entries.map((e) => ({
        playerId: e.playerId,
        score: e.score,
        position: e.rank,
        Player: { id: e.playerId, name: e.name, profilePic: e.profilePic },
      })),
    );

    if (meta.mode === "duel") {
      await this.endGame(gameCode);
    }
  }

  private async maybeRevealEarly(
    gameCode: string,
    qIndex: number,
  ): Promise<void> {
    const roster = await this.store.roster(gameCode);
    const connected = roster.filter((p) => p.connected).length;
    if (connected === 0) return;
    const answers = await this.store.getAnswers(gameCode, qIndex);
    const answeredConnected = roster.filter(
      (p) => p.connected && answers[p.id],
    ).length;
    if (answeredConnected >= connected) {
      await this.enterReveal(gameCode);
    }
  }

  // -- timers / recovery ------------------------------------------------------------

  private armTimer(gameCode: string, delayMs: number): void {
    this.clearTimer(gameCode);
    const timer = setTimeout(
      () => {
        this.timers.delete(gameCode);
        void this.handleDeadline(gameCode).catch((err) =>
          this.logger.error(`Deadline handling failed for ${gameCode}`, err),
        );
      },
      Math.max(delayMs, 0),
    );
    timer.unref();
    this.timers.set(gameCode, timer);
  }

  private clearTimer(gameCode: string): void {
    const timer = this.timers.get(gameCode);
    if (timer) clearTimeout(timer);
    this.timers.delete(gameCode);
  }

  private async handleDeadline(gameCode: string): Promise<void> {
    const owner = await this.store.ensureOwner(gameCode, this.instanceId);
    if (!owner) return;
    const meta = await this.store.getMeta(gameCode);
    if (!meta) {
      await this.store.clearDeadline(gameCode);
      return;
    }
    switch (meta.phase) {
      case "starting":
        await this.enterQuestion(gameCode, 0);
        break;
      case "question":
        if (Date.now() >= meta.qDeadline) {
          await this.enterReveal(gameCode);
        }
        break;
      case "reveal":
        // Only hostless (duel) reveals carry a deadline.
        if (meta.qIndex + 1 < meta.qCount) {
          await this.enterQuestion(gameCode, meta.qIndex + 1);
        } else {
          await this.enterFinal(gameCode);
        }
        break;
      default:
        await this.store.clearDeadline(gameCode);
        break;
    }
  }

  private async recoverTimers(): Promise<void> {
    const deadlines = await this.store.allDeadlines();
    const now = Date.now();
    for (const { code, atMs } of deadlines) {
      if (atMs <= now) {
        await this.handleDeadline(code);
      } else {
        this.armTimer(code, atMs - now);
      }
    }
    if (deadlines.length > 0) {
      this.logger.log(`Recovered ${deadlines.length} game timer(s)`);
    }
  }

  private async sweep(): Promise<void> {
    // Catch deadlines whose in-process timer was lost (crash, other instance).
    const due = await this.store.dueDeadlines(Date.now());
    for (const code of due) {
      await this.handleDeadline(code);
    }
    // End classic games abandoned by their host mid-game.
    for (const { code } of await this.store.allDeadlines()) {
      const meta = await this.store.getMeta(code);
      if (
        meta &&
        meta.mode === "classic" &&
        !meta.hostConnected &&
        meta.phase !== "lobby" &&
        meta.phase !== "ended" &&
        Date.now() - meta.hostLastSeenAt > HOST_ABANDON_MS
      ) {
        this.logger.warn(`Ending ${code}: host absent for >5min`);
        await this.endGame(code);
      }
    }
  }

  /**
   * Writes the immutable GameResult before the live state is destroyed.
   * For duels this also applies the ELO update atomically in the same
   * transaction. Games that never left the lobby produce no result.
   */
  private async persistResult(
    gameCode: string,
    meta: GameMeta,
    entries: LeaderboardEntry[],
    opts?: { forfeitLoserId?: string; abandoned?: boolean },
  ): Promise<{
    resultId?: string;
    eloChanges?: Record<string, { before: number; after: number }>;
  }> {
    if (!meta.startedAt || meta.qCount === 0) return {};

    const roster = await this.store.roster(gameCode);
    const rosterById = new Map(roster.map((p) => [p.id, p]));
    const correctCounts = new Map<string, number>();
    for (let i = 0; i < meta.qCount; i++) {
      const answers = await this.store.getAnswers(gameCode, i);
      for (const [playerId, a] of Object.entries(answers)) {
        if (a.isCorrect) {
          correctCounts.set(playerId, (correctCounts.get(playerId) ?? 0) + 1);
        }
      }
    }

    const isRatedDuel =
      meta.mode === "duel" && entries.length === 2 && !opts?.abandoned;

    const data = (
      quizId: string | null,
      hostId: string | null,
      elo?: Record<string, { before: number; after: number }>,
    ) => ({
      gameCode,
      mode: meta.mode,
      quizId,
      quizTitle: meta.quizTitle,
      hostId,
      playerCount: entries.length,
      questionCount: meta.qCount,
      startedAt: new Date(meta.startedAt),
      entries: {
        create: entries.map((e) => ({
          playerName: e.name,
          profilePic: e.profilePic,
          userId: rosterById.get(e.playerId)?.userId ?? null,
          score: e.score,
          rank: e.rank,
          correctCount: correctCounts.get(e.playerId) ?? 0,
          eloBefore: elo?.[e.playerId]?.before ?? null,
          eloAfter: elo?.[e.playerId]?.after ?? null,
        })),
      },
    });

    try {
      if (isRatedDuel) {
        return await this.prisma.db.$transaction(async (tx) => {
          const [a, b] = entries;
          const userIdA = rosterById.get(a.playerId)?.userId ?? a.playerId;
          const userIdB = rosterById.get(b.playerId)?.userId ?? b.playerId;
          const users = await tx.user.findMany({
            where: { id: { in: [userIdA, userIdB] } },
            select: { id: true, eloRating: true, duelsPlayed: true },
          });
          const userA = users.find((u) => u.id === userIdA);
          const userB = users.find((u) => u.id === userIdB);
          if (!userA || !userB) {
            const result = await tx.gameResult.create({
              data: data(null, null),
              select: { id: true },
            });
            return { resultId: result.id };
          }

          // Outcome: forfeiter loses outright; otherwise total score decides,
          // equal scores are a tie.
          let scoreA: 1 | 0.5 | 0;
          if (opts?.forfeitLoserId) {
            scoreA = opts.forfeitLoserId === userIdA ? 0 : 1;
          } else if (a.score === b.score) {
            scoreA = 0.5;
          } else {
            scoreA = a.score > b.score ? 1 : 0;
          }

          const deltaA = eloDelta(
            userA.eloRating,
            userB.eloRating,
            scoreA,
            kFactor(userA.duelsPlayed),
          );
          const deltaB = eloDelta(
            userB.eloRating,
            userA.eloRating,
            (1 - scoreA) as 1 | 0.5 | 0,
            kFactor(userB.duelsPlayed),
          );
          const eloChanges: Record<string, { before: number; after: number }> =
            {
              [a.playerId]: {
                before: userA.eloRating,
                after: applyFloor(userA.eloRating + deltaA),
              },
              [b.playerId]: {
                before: userB.eloRating,
                after: applyFloor(userB.eloRating + deltaB),
              },
            };

          await tx.user.update({
            where: { id: userIdA },
            data: {
              eloRating: eloChanges[a.playerId].after,
              duelsPlayed: { increment: 1 },
            },
          });
          await tx.user.update({
            where: { id: userIdB },
            data: {
              eloRating: eloChanges[b.playerId].after,
              duelsPlayed: { increment: 1 },
            },
          });
          const result = await tx.gameResult.create({
            data: data(null, null, eloChanges),
            select: { id: true },
          });
          return { resultId: result.id, eloChanges };
        });
      }

      const result = await this.prisma.db.gameResult.create({
        data: data(meta.quizId || null, meta.hostId || null),
        select: { id: true },
      });
      return { resultId: result.id };
    } catch (err) {
      // Quiz/host may have been deleted mid-game; keep the result anyway.
      try {
        const result = await this.prisma.db.gameResult.create({
          data: data(null, null),
          select: { id: true },
        });
        return { resultId: result.id };
      } catch (inner) {
        this.logger.error(`Failed to persist result for ${gameCode}`, inner);
        this.logger.error(`Original error:`, err);
        return {};
      }
    }
  }

  // -- helpers ------------------------------------------------------------------------

  private async buildLeaderboard(
    gameCode: string,
  ): Promise<LeaderboardEntry[]> {
    const [scores, roster] = await Promise.all([
      this.store.leaderboard(gameCode),
      this.store.roster(gameCode),
    ]);
    const byId = new Map<string, RosterEntry>(roster.map((p) => [p.id, p]));
    const entries = scores.map((s, i) => ({
      playerId: s.playerId,
      name: byId.get(s.playerId)?.name ?? "Unknown",
      profilePic: byId.get(s.playerId)?.profilePic ?? null,
      score: s.score,
      rank: i + 1,
    }));
    // Players who never scored still belong on the board.
    for (const p of roster) {
      if (!scores.some((s) => s.playerId === p.id)) {
        entries.push({
          playerId: p.id,
          name: p.name,
          profilePic: p.profilePic,
          score: 0,
          rank: entries.length + 1,
        });
      }
    }
    return entries;
  }

  private async buildAnswerResult(
    gameCode: string,
    meta: GameMeta,
    playerId: string,
  ): Promise<AnswerResultPayload> {
    const answers = await this.store.getAnswers(gameCode, meta.qIndex);
    const answer = answers[playerId];
    const [totalScore, rank] = await Promise.all([
      this.store.totalScore(gameCode, playerId),
      this.store.rank(gameCode, playerId),
    ]);
    return {
      answered: Boolean(answer),
      optionId: answer?.optionId ?? null,
      isCorrect: answer?.isCorrect ?? false,
      score: answer?.score ?? 0,
      totalScore,
      rank,
    };
  }

  private cancelDisconnectGrace(gameCode: string, playerId: string): void {
    const key = `${gameCode}:${playerId}`;
    const timer = this.disconnectTimers.get(key);
    if (timer) clearTimeout(timer);
    this.disconnectTimers.delete(key);
  }

  private async removeIfStillGone(
    gameCode: string,
    playerId: string,
  ): Promise<void> {
    const [meta, entry] = await Promise.all([
      this.store.getMeta(gameCode),
      this.store.getPlayer(gameCode, playerId),
    ]);
    if (!meta || !entry || entry.connected) return;
    if (meta.phase !== "lobby") return;
    await this.store.removePlayer(gameCode, playerId);
    this.emitRoom(gameCode).emit("player-removed", { id: playerId });
  }

  private emitRoom(gameCode: string) {
    if (!this.io) {
      throw new Error("GameEngineService used before gateway init");
    }
    return this.io.to(gameCode);
  }
}
