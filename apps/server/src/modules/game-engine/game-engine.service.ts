import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import {
  HEARTBEAT_TIMEOUT_MS,
  PLAYER_LEADERBOARD_TOP,
  quizSettingsSchema,
  type PreloadAllPayload,
} from "@buzrr/contract";
import { signAssetsDeep } from "../../common/storage/asset-signing";
import { finalClipOf } from "../sound-skins/final-clip";
import type { GameOverPayload, QuestionAnswer } from "@buzrr/contract";
import type { DuelOutcome, Prisma } from "@buzrr/prisma";
import { nanoid } from "nanoid";
import { BotTier } from "../../common/utils/duel-bot";
import {
  advanceStreak,
  dateToDay,
  dayToDate,
  localDay,
} from "../../common/utils/daily-streak";
import { applyFloor, eloDelta, kFactor } from "../../common/utils/elo";
import { PrismaService } from "../../prisma/prisma.service";
import {
  acceptsMoreAnswers,
  isScored,
  mergeAnswers,
  preloadImageUrls,
  preloadUrls,
  summarizeAnswers,
  toLiveQuestion,
} from "../question-types";

/** How long a room's lobby download list is reused (joins come in waves). */
const LOBBY_ASSETS_TTL_MS = 60_000;
import { answerEntries, topOfLeaderboard } from "./core/views";
import type {
  SocketData,
  StateSyncPayload,
  SubmitAnswerAck,
  TypedServer,
} from "../realtime/realtime.types";
import {
  DUEL_FORFEIT_MS,
  PARTS_FOR,
  START_COUNTDOWN_MS,
  botAnswerOf,
  buildLeaderboard,
  buildSnapshot,
  canPause,
  forfeitOutcome,
  hasConnectedHuman,
  isHostAbandoned,
  judgeAnswer,
  overdueForfeiter,
  resumePlan,
  step,
  type Audience,
  type Effect,
  type EngineEvent,
  type Outbound,
} from "./core";
import { DuelBotService } from "./duel-bot.service";
import {
  GameMeta,
  LeaderboardEntry,
  LiveQuestion,
  RosterEntry,
} from "./game-engine.types";
import { GameStoreService, parseAnswer } from "./game-store.service";

/** How long a disconnected lobby player is kept before removal (default). */
const LOBBY_DISCONNECT_GRACE_MS = HEARTBEAT_TIMEOUT_MS;
const SWEEP_INTERVAL_MS = 15_000;
/**
 * How often, at most, the host is sent the running results of an unscored
 * question. A trailing timer per game, so a burst of answers costs one read.
 */
const LIVE_SUMMARY_MS = 1_000;

/**
 * The shell around the engine's pure core (`./core`). The rules of the game —
 * phase transitions, answer judging, scoring, what each client is told — are
 * pure functions there; this service loads their input from Redis, runs the
 * effects they return in order, and owns everything that needs I/O or
 * atomicity: first-write-wins answers, the single end-of-game claim, duel
 * pause/resume claims, timers, recovery and result persistence.
 *
 * Still the only place a game advances: the gateway only relays client intent
 * (start-game / host-next / submit-answer). Live state lives in Redis
 * (GameStoreService) so a process restart or a second instance can pick a
 * game back up.
 */
type StreakChanges = NonNullable<GameOverPayload["streaks"]>;

const OUTCOME_BY_SCORE: Record<1 | 0.5 | 0, DuelOutcome> = {
  1: "win",
  0.5: "draw",
  0: "loss",
};
const SCORE_BY_OUTCOME: Record<DuelOutcome, 1 | 0.5 | 0> = {
  win: 1,
  draw: 0.5,
  loss: 0,
};

@Injectable()
export class GameEngineService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(GameEngineService.name);
  private readonly instanceId = nanoid(10);
  private io: TypedServer | null = null;
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly disconnectTimers = new Map<string, NodeJS.Timeout>();
  private readonly liveSummaryTimers = new Map<string, NodeJS.Timeout>();
  private sweeper: NodeJS.Timeout | null = null;

  constructor(
    private readonly store: GameStoreService,
    private readonly prisma: PrismaService,
    private readonly bots: DuelBotService,
  ) {}

  setServer(io: TypedServer): void {
    this.io = io;
  }

  // -- lifecycle -------------------------------------------------------------

  async onApplicationBootstrap(): Promise<void> {
    // recoverTimers re-arms timers for surviving games, which starts the
    // sweeper via armTimer; with no live games it stays off until one starts.
    await this.recoverTimers().catch((err) =>
      this.logger.error("Timer recovery failed", err),
    );
  }

  onApplicationShutdown(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    for (const t of this.timers.values()) clearTimeout(t);
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
    for (const t of this.liveSummaryTimers.values()) clearTimeout(t);
  }

  // -- core plumbing -----------------------------------------------------------

  /**
   * Loads what the event needs, steps the phase machine, and runs the
   * effects. `qIndex` pins which question's answers are read (answer events
   * name their question; everything else reads the current one).
   */
  private async dispatch(
    gameCode: string,
    event: EngineEvent,
    qIndex?: number,
  ): Promise<void> {
    const state = await this.store.loadState(
      gameCode,
      PARTS_FOR[event.type],
      qIndex,
    );
    if (!state) return;
    const { effects } = step(state, event, Date.now());
    await this.run(gameCode, effects);
  }

  /** Executes the core's effects, strictly in the order given. */
  private async run(gameCode: string, effects: Effect[]): Promise<void> {
    for (const effect of effects) {
      switch (effect.kind) {
        case "set-questions":
          await this.store.setQuestions(gameCode, effect.questions);
          break;
        case "patch-meta":
          await this.store.patchMeta(gameCode, effect.patch);
          break;
        case "set-deadline":
          await this.store.setDeadline(gameCode, effect.at);
          break;
        case "park-deadline":
          await this.store.parkDeadline(gameCode);
          break;
        case "clear-deadline":
          await this.store.clearDeadline(gameCode);
          break;
        case "claim-owner":
          await this.store.ensureOwner(gameCode, this.instanceId);
          break;
        case "arm-timer":
          this.armTimer(gameCode, effect.at - Date.now());
          break;
        case "clear-timer":
          this.clearTimer(gameCode);
          break;
        case "mark-playing":
          // The one gameplay flag Postgres still carries: join checks and the
          // player-play context read it to tell a waiting lobby from a live
          // room. Phase, question index and scores stay in Redis.
          await this.prisma.db.gameSession.update({
            where: { gameCode },
            data: { isPlaying: true },
          });
          break;
        case "emit":
          this.send(gameCode, effect.to, effect.message);
          break;
        case "arm-bot":
          this.armBot(
            gameCode,
            effect.botId,
            effect.qIndex,
            effect.answer,
            effect.at,
          );
          break;
        case "cancel-bot":
          this.bots.cancel(gameCode);
          break;
        case "end-game":
          await this.endGame(gameCode);
          break;
        case "dispatch":
          await this.dispatch(gameCode, {
            type: effect.event,
            qIndex: effect.qIndex,
          });
          break;
        case "log":
          this.logger[effect.level](`${gameCode}: ${effect.message}`);
          break;
        default: {
          const unhandled: never = effect;
          throw new Error(
            `Unhandled engine effect ${JSON.stringify(unhandled)}`,
          );
        }
      }
    }
  }

  /**
   * Told when a new round begins (a question opens, the final standings —
   * then with the players on places 1–3).
   */
  private roundListeners = new Set<
    (gameCode: string, winners?: string[]) => void
  >();
  onNewRound(listener: (gameCode: string, winners?: string[]) => void): void {
    this.roundListeners.add(listener);
  }

  private send(gameCode: string, to: Audience, message: Outbound): void {
    if (!this.io) {
      throw new Error("GameEngineService used before gateway init");
    }
    if ("room" in to && message.event === "question-start") {
      for (const l of this.roundListeners) l(gameCode);
    }
    if (
      "room" in to &&
      message.event === "leaderboard" &&
      message.payload.isFinal
    ) {
      const winners = message.payload.entries
        .filter((e) => e.rank <= 3)
        .map((e) => e.playerId);
      for (const l of this.roundListeners) l(gameCode, winners);
    }
    // Per-player rooms work cross-instance via the redis adapter.
    const target =
      "player" in to
        ? this.io.to(`player:${to.player}`)
        : "host" in to
          ? this.io.to(`host:${gameCode}`)
          : this.io.to(gameCode);
    switch (message.event) {
      case "game-started":
        target.emit("game-started", {
          remainingMs: Math.max(0, message.deadline - Date.now()),
          ...(message.moderation ? { moderation: message.moderation } : {}),
        });
        break;
      case "closed-summary":
        target.emit("closed-summary", message.payload);
        break;
      case "preload":
        // Encrypted clips only; signed so the room can fetch them.
        target.emit("preload", signAssetsDeep(message.payload));
        break;
      case "phase-change":
        target.emit("phase-change", {
          ...message.payload,
          ...(message.deadline !== undefined
            ? { remainingMs: Math.max(0, message.deadline - Date.now()) }
            : {}),
        });
        break;
      case "question-start":
        // What is left of the window once the writes before this broadcast
        // are done — the clock has been running since the window opened, so
        // the client is told the truth rather than the full timeOut.
        // The question's media only becomes loadable now, for the room.
        target.emit(
          "question-start",
          signAssetsDeep({
            ...message.payload,
            remainingMs: Math.max(0, message.deadline - Date.now()),
          }),
        );
        break;
      case "question-end":
        target.emit("question-end", message.payload);
        break;
      case "answer-result":
        target.emit("answer-result", message.payload);
        break;
      case "answer-count":
        target.emit("answer-count", message.payload);
        break;
      case "leaderboard": {
        const { entries } = message.payload;
        if (!("room" in to) || entries.length <= PLAYER_LEADERBOARD_TOP) {
          target.emit("leaderboard", message.payload);
          break;
        }
        // The host shows the whole board; the players get its top (and
        // their own standing from answer-result) — one small broadcast.
        this.io.to(`host:${gameCode}`).emit("leaderboard", message.payload);
        this.io
          .to(gameCode)
          .except(`host:${gameCode}`)
          .emit("leaderboard", {
            ...message.payload,
            entries: topOfLeaderboard(entries),
            total: entries.length,
          });
        // Their own place comes with answer-result (once per question).
        break;
      }
    }
  }

  private armBot(
    gameCode: string,
    botId: string,
    qIndex: number,
    answer: QuestionAnswer,
    at: number,
  ): void {
    this.bots.arm(gameCode, answer, at, (planned) =>
      this.submitAnswer(gameCode, botId, qIndex, planned),
    );
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
      pacing: "host",
      phase: "lobby",
      rated: false,
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
   *
   * Friend invites pass `rated: false`: identical play, but ELO is left alone
   * so two accounts can't farm rating off each other.
   *
   * `opts.bot` marks one of the players as server-driven. That entry joins the
   * roster already connected — it has no socket to connect with, and without
   * it the early close would end every question the moment the human
   * answered, before the bot's timer could fire.
   */
  async startDuel(
    gameCode: string,
    players: {
      id: string;
      name: string;
      profilePic: string | null;
      userId?: string;
      connected?: boolean;
    }[],
    questions: LiveQuestion[],
    opts?: {
      rated?: boolean;
      bot?: { id: string; tier: BotTier; elo: number };
      /** Null/absent = Random. */
      category?: { id: string; name: string } | null;
    },
  ): Promise<void> {
    const now = Date.now();
    const firstQuestionAt = now + START_COUNTDOWN_MS;
    const category = opts?.category ?? null;
    await this.store.initMeta(gameCode, {
      sessionId: "",
      quizId: "",
      quizTitle: category ? `1v1 Duel · ${category.name}` : "1v1 Duel",
      categoryId: category?.id,
      categoryName: category?.name,
      hostId: "",
      mode: "duel",
      pacing: "auto",
      phase: "starting",
      rated: opts?.rated ?? true,
      botId: opts?.bot?.id,
      botTier: opts?.bot?.tier,
      botElo: opts?.bot?.elo,
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
        connected: p.connected ?? false,
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

  /** Per room: what devices load in the lobby, kept a minute (many joins). */
  private lobbyAssetCache = new Map<
    string,
    { at: number; payload: PreloadAllPayload }
  >();

  /**
   * Everything a device can download ahead for this room: every playable
   * question's encrypted clips and picture (no keys), in play order. Read
   * from Postgres (the questions only reach Redis at the start).
   */
  async lobbyAssets(gameCode: string): Promise<PreloadAllPayload> {
    const cached = this.lobbyAssetCache.get(gameCode);
    if (cached && Date.now() - cached.at < LOBBY_ASSETS_TTL_MS) {
      return cached.payload;
    }
    const session = await this.prisma.db.gameSession.findUnique({
      where: { gameCode },
      include: {
        quiz: {
          include: {
            questions: {
              where: { disabled: false },
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
              include: { options: { orderBy: { createdAt: "asc" } } },
            },
          },
        },
      },
    });
    const questions = (session?.quiz.questions ?? [])
      .map((q) => toLiveQuestion(q))
      .filter((q): q is LiveQuestion => q !== null);
    const payload: PreloadAllPayload = {
      questions: questions
        .map((q, qIndex) => ({
          qIndex,
          urls: preloadUrls(q),
          images: preloadImageUrls(q),
          playOn: q.audio?.playOn ?? "quiz",
        }))
        .filter((p) => p.urls.length > 0 || p.images.length > 0),
    };
    this.lobbyAssetCache.set(gameCode, { at: Date.now(), payload });
    return payload;
  }

  async startGame(gameCode: string): Promise<void> {
    const state = await this.store.loadState(gameCode, PARTS_FOR.start);
    if (!state || state.meta.phase !== "lobby") {
      this.logger.warn(
        `Start of ${gameCode} ignored: ${state ? `phase ${state.meta.phase}` : "no live state"}`,
      );
      return;
    }

    const session = await this.prisma.db.gameSession.findUnique({
      where: { gameCode },
      include: {
        quiz: {
          include: {
            questions: {
              // Disabled questions are skipped: not played, counted or scored.
              where: { disabled: false },
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
              include: { options: { orderBy: { createdAt: "asc" } } },
            },
          },
        },
      },
    });
    if (!session) {
      this.logger.error(`Cannot start ${gameCode}: no session`);
      return;
    }

    // A row whose type this build doesn't know (or whose content no longer
    // passes its type's checks) is skipped, not allowed to sink the game.
    const questions = session.quiz.questions
      .map((q) => toLiveQuestion(q))
      .filter((q): q is LiveQuestion => q !== null);
    const skipped = session.quiz.questions.length - questions.length;
    if (skipped > 0) {
      this.logger.warn(
        `${gameCode}: skipped ${skipped} unplayable question(s)`,
      );
    }

    // Moderated mode comes from the quiz's settings (invalid → unmoderated).
    const settings = quizSettingsSchema.safeParse(session.quiz.settings ?? {});
    const moderation = settings.success ? settings.data.moderation : null;
    // A user sound skin's final song is preloaded encrypted; its key goes
    // out with the final leaderboard.
    const skinId = settings.success ? settings.data.sound.skin : null;
    const skin =
      skinId && !skinId.startsWith("builtin:")
        ? await this.prisma.db.soundSkin.findUnique({
            where: { id: skinId },
            select: { finalClip: true },
          })
        : null;
    const finalSoundKey = finalClipOf(skin?.finalClip)?.key ?? null;

    const { effects } = step(
      state,
      {
        type: "start",
        questions,
        quizTitle: session.quiz.title,
        moderation: moderation?.enabled ? moderation : null,
        finalSoundKey,
      },
      Date.now(),
    );
    await this.run(gameCode, effects);
    this.logger.log(`Game ${gameCode} started (${questions.length} questions)`);
  }

  /**
   * Single pacing intent from the host. The phase machine decides what
   * "next" means from the current phase — and whether this game's pacing
   * lets a host advance it at all.
   */
  async hostNext(gameCode: string): Promise<void> {
    await this.dispatch(gameCode, { type: "host-next" });
  }

  /** Host, countdown waiting for downloads: keep waiting (no limit) or go. */
  async downloadsDecision(gameCode: string, wait: boolean): Promise<void> {
    await this.dispatch(gameCode, { type: "downloads-decision", wait });
  }

  async endGame(
    gameCode: string,
    opts?: { forfeitLoserId?: string; abandoned?: boolean },
  ): Promise<void> {
    const meta = await this.store.getMeta(gameCode);
    if (!meta || meta.phase === "ended") return;
    this.clearTimer(gameCode);
    this.bots.cancel(gameCode);
    await this.store.clearDeadline(gameCode);

    // Atomic claim: only the caller that flips phase -> "ended" persists the
    // result and cleans up, so concurrent callers can't double-write.
    const claimed = await this.store.claimEnded(gameCode);
    if (!claimed) return;

    const [scores, roster] = await Promise.all([
      this.store.leaderboard(gameCode),
      this.store.roster(gameCode),
    ]);
    const entries = buildLeaderboard(scores, roster);
    const { resultId, eloChanges, streaks } = await this.persistResult(
      gameCode,
      meta,
      entries,
      opts,
    );

    this.emitRoom(gameCode).emit("game-over", {
      entries,
      resultId,
      eloChanges,
      rated: meta.mode === "duel" && meta.rated !== false,
      ...(meta.mode === "duel"
        ? {
            category: meta.categoryId
              ? { id: meta.categoryId, name: meta.categoryName ?? "" }
              : null,
            streaks,
          }
        : {}),
    });
    this.emitRoom(gameCode).emit("game-session-ended");

    // Classic games have a lobby record to tear down; duels are Redis-only.
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

  /**
   * `answer` is whatever the client sent; the open question's type decides
   * whether it is valid and what it scores (`judgeAnswer`).
   */
  async submitAnswer(
    gameCode: string,
    playerId: string,
    qIndex: number,
    answer: unknown,
  ): Promise<SubmitAnswerAck> {
    // Taken before any Redis round trip so store latency isn't billed to the
    // player.
    const receivedAt = Date.now();
    // This runs once per player per question, so it is kept to two round
    // trips and four commands: one pipelined read (meta, questions, roster)
    // serves both judging and the early-close check, and one script stores
    // the answer, adds the score and says who has answered.
    const state = await this.store.loadState(gameCode, ["questions", "roster"]);
    if (!state) {
      return { accepted: false, reason: "No question is active" };
    }
    const judgement = judgeAnswer(
      state,
      { playerId, qIndex, answer },
      receivedAt,
    );
    if (!judgement.accepted) {
      return { accepted: false, reason: judgement.reason };
    }

    // First write wins: a duplicate (or a resend racing the original) never
    // re-scores.
    const answered = await this.store.recordAnswer(
      gameCode,
      qIndex,
      playerId,
      judgement.stored,
    );
    const question = state.questions[qIndex];
    if (!answered) {
      // Questions that take several answers fold this one into the stored
      // one; everything else is first-write-wins.
      if (question && acceptsMoreAnswers(question)) {
        return this.addToAnswer(
          gameCode,
          qIndex,
          playerId,
          question,
          judgement.stored.answer,
        );
      }
      return { accepted: false, reason: "Already answered" };
    }

    // Stepped on the state read above rather than a fresh load. If the
    // question closed in between, the step still sees it open: the meter
    // update is harmless, and a close it asks for is dropped by
    // `close-question`, which re-reads before acting.
    const { effects } = step(
      state,
      { type: "answer-recorded", qIndex, answered },
      Date.now(),
    );
    await this.run(gameCode, effects);
    if (question && !isScored(question.type)) {
      this.scheduleLiveSummary(gameCode);
    }
    return {
      accepted: true,
      answer: judgement.stored.answer,
      timeTakenMs: judgement.stored.timeTakenMs,
    };
  }

  /**
   * A further answer from a player who already answered a question that
   * takes several. Read, merge, compare-and-set; a lost race (the same
   * player's other answer landing in between) re-reads and tries again. The
   * first answer's timing and (zero) score stay as they were, and the answer
   * count doesn't change, so nothing else is stepped.
   */
  private async addToAnswer(
    gameCode: string,
    qIndex: number,
    playerId: string,
    question: LiveQuestion,
    next: QuestionAnswer,
  ): Promise<SubmitAnswerAck> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await this.store.getAnswerRaw(gameCode, qIndex, playerId);
      if (raw === null) break;
      const stored = parseAnswer(raw);
      const merged = mergeAnswers(question, stored.answer, next);
      if (!merged) {
        return {
          accepted: false,
          reason: "That's the most answers you can send",
        };
      }
      const replaced = await this.store.replaceAnswer(
        gameCode,
        qIndex,
        playerId,
        raw,
        { ...stored, answer: merged },
      );
      if (replaced) {
        this.scheduleLiveSummary(gameCode);
        return { accepted: true, answer: merged };
      }
    }
    return {
      accepted: false,
      reason: "Couldn't save that answer — try again",
    };
  }

  // -- live results (unscored types) -----------------------------------------------

  /**
   * Coalesces answers into at most one `live-summary` per `LIVE_SUMMARY_MS`.
   * Kept off the answer path on purpose: an answer costs what it always did,
   * and the summary costs one read per tick, not one per answer. The timer is
   * per instance and best effort — several instances may each send one, and
   * the host keeps whichever counts the most answers. The tick reports
   * whichever question is open when it fires: pinning the one that armed it
   * would drop the tick if the question moved on, and the per-game guard
   * would keep the next question from scheduling its own.
   */
  private scheduleLiveSummary(gameCode: string): void {
    if (this.liveSummaryTimers.has(gameCode)) return;
    const timer = setTimeout(() => {
      this.liveSummaryTimers.delete(gameCode);
      void this.sendLiveSummary(gameCode).catch((err) =>
        this.logger.error(`Live summary failed for ${gameCode}`, err),
      );
    }, LIVE_SUMMARY_MS);
    timer.unref();
    this.liveSummaryTimers.set(gameCode, timer);
  }

  /**
   * Sends the host the running results of the open question, if it is an
   * unscored one. Scored types never go out before the reveal — the host
   * screen is usually projected for the room to see. `qIndex` drops a tick
   * that outlived its question.
   */
  async sendLiveSummary(gameCode: string, qIndex?: number): Promise<void> {
    if (!this.io) return;
    const state = await this.store.loadState(gameCode, [
      "questions",
      "roster",
      "answers",
    ]);
    if (!state || state.meta.phase !== "question") return;
    const { meta, answers, roster } = state;
    if (qIndex !== undefined && meta.qIndex !== qIndex) return;
    const question = state.questions[meta.qIndex];
    if (!question || isScored(question.type)) return;
    this.io.to(`host:${gameCode}`).emit("live-summary", {
      index: meta.qIndex,
      answered: Object.keys(answers).length,
      summary: summarizeAnswers(question, answerEntries(answers, roster)),
    });
  }

  // -- roster / presence -----------------------------------------------------------

  /**
   * Admits a player to the live roster. Returns false when the room's ban list
   * rejects them — the registration is atomic with the ban check, so a connect
   * racing a ban can't slip into the roster behind it. Callers must drop the
   * connection when this is false.
   */
  async playerConnected(
    gameCode: string,
    player: { id: string; name: string; profilePic: string | null },
  ): Promise<boolean> {
    const existing = await this.store.getPlayer(gameCode, player.id);
    const admitted = await this.store.upsertPlayerUnlessBanned(gameCode, {
      id: player.id,
      name: player.name,
      profilePic: player.profilePic,
      connected: true,
      lastSeenAt: Date.now(),
      userId: existing?.userId,
    });
    if (!admitted) return false;
    this.cancelDisconnectGrace(gameCode, player.id);
    this.emitRoom(gameCode).emit("player-connection", {
      playerId: player.id,
      connected: true,
    });

    // A duel frozen while this player was away picks up where it stopped.
    // Awaited before the caller sends its snapshot, so the reconnecting client
    // renders the resumed deadline rather than the frozen one.
    const meta = await this.store.getMeta(gameCode);
    if (meta?.mode === "duel" && meta.pausedAt) {
      await this.resumeDuel(gameCode, meta);
    }
    return true;
  }

  /**
   * One of the player's sockets closed. Presence is per player, not per
   * socket: a client that reconnected already has a new socket, and the old
   * one may only close now (the server notices a dead transport a ping
   * timeout later). Marking the player gone then would count a live player
   * as absent — and the early close would skip them on the next question.
   */
  async playerDisconnected(
    gameCode: string,
    playerId: string,
    /** Lobby: how long until a player still gone leaves the list. */
    lobbyGraceMs = LOBBY_DISCONNECT_GRACE_MS,
  ): Promise<void> {
    // `player:{id}` also holds a duel user's queue/invite sockets — only a
    // socket in this game, as this player, counts as them still being here.
    const stillHere = () =>
      this.hasLiveSocket(
        `player:${playerId}`,
        (d) => d.gameCode === gameCode && d.playerId === playerId,
      );
    if (await stillHere()) return;
    const entry = await this.store.getPlayer(gameCode, playerId);
    if (!entry) return;
    await this.store.upsertPlayer(gameCode, {
      ...entry,
      connected: false,
      lastSeenAt: Date.now(),
    });
    // A reconnect that joined the room after the check above may have
    // written `connected: true` before our write landed. Re-checking after
    // the write closes that gap: either we see its socket here, or its
    // write comes after ours.
    if (await stillHere()) {
      const current = await this.store.getPlayer(gameCode, playerId);
      if (current) {
        await this.store.upsertPlayer(gameCode, {
          ...current,
          connected: true,
        });
      }
      return;
    }
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

      // Nobody left to play it: freeze rather than let the match run on
      // without them (see pauseDuel) until the forfeit grace decides it.
      const roster = await this.store.roster(gameCode);
      if (!hasConnectedHuman(meta, roster)) {
        await this.pauseDuel(gameCode, meta);
        return;
      }
    } else {
      // In the lobby a dropped player is removed after a grace period;
      // mid-game they keep their score and may rejoin.
      const timer = setTimeout(() => {
        this.disconnectTimers.delete(graceKey);
        void this.removeIfStillGone(gameCode, playerId).catch((err) =>
          this.logger.error("Lobby grace removal failed", err),
        );
      }, lobbyGraceMs);
      timer.unref();
      this.disconnectTimers.set(graceKey, timer);
    }

    // If everyone still connected has answered, don't wait for the deadline.
    if (meta?.phase === "question") {
      await this.dispatch(gameCode, { type: "roster-changed" });
    }
  }

  private async resolveDuelForfeit(
    gameCode: string,
    playerId: string,
  ): Promise<void> {
    const meta = await this.store.getMeta(gameCode);
    if (!meta || meta.phase === "ended") return;
    const outcome = forfeitOutcome(await this.store.roster(gameCode), playerId);
    if (!outcome) return;
    if ("forfeitLoserId" in outcome) {
      this.logger.log(`Duel ${gameCode}: ${playerId} forfeits (disconnected)`);
    } else {
      this.logger.log(`Duel ${gameCode}: both players gone — abandoned`);
    }
    await this.endGame(gameCode, outcome);
  }

  /**
   * Backstop for the forfeit grace, which is an in-memory timer and therefore
   * dies with the instance that armed it. `lastSeenAt` is written to the
   * roster on every disconnect, so any instance can re-derive an overdue
   * forfeit from Redis alone.
   *
   * This covers the paused case *and* the one that is easy to miss: a duel
   * whose opponent stayed connected is never paused, so before this it relied
   * entirely on that in-memory timer — a restart meant the quitter simply
   * played out the match on score instead of forfeiting.
   */
  private async sweepDuelForfeits(
    gameCode: string,
    meta: GameMeta,
  ): Promise<void> {
    const overdue = overdueForfeiter(
      meta,
      await this.store.roster(gameCode),
      Date.now(),
    );
    if (!overdue) return;
    this.logger.log(`Duel ${gameCode}: ${overdue.id} gone past the grace`);
    await this.resolveDuelForfeit(gameCode, overdue.id);
  }

  /**
   * Freezes a duel nobody is connected to. Without this a bot duel plays
   * itself out during the 30s forfeit grace — the bot answers, the question
   * closes early, and a player who reconnects in time comes back to a match
   * that moved on (or ended) without them. Timers stop and the deadline is
   * parked so the game stays visible to the sweeper, which decides it if the
   * player never returns.
   */
  private async pauseDuel(gameCode: string, meta: GameMeta): Promise<void> {
    if (!canPause(meta)) return;
    // Claim the pause *before* re-checking presence. The two orderings of a
    // reconnect racing this are then both covered: one that committed its
    // roster write earlier is seen by the check below, and one that commits
    // later is guaranteed to read `pausedAt` and resume. Claiming also means
    // only one caller ever tears the timers down.
    if (!(await this.store.claimPause(gameCode, Date.now()))) return;
    this.clearTimer(gameCode);
    this.bots.cancel(gameCode);
    await this.store.parkDeadline(gameCode);
    this.logger.log(`Duel ${gameCode} paused: no player connected`);

    if (hasConnectedHuman(meta, await this.store.roster(gameCode))) {
      const fresh = await this.store.getMeta(gameCode);
      if (fresh) await this.resumeDuel(gameCode, fresh);
    }
  }

  /**
   * Restarts a paused duel with every stored timestamp shifted by the frozen
   * span (`resumePlan`).
   *
   * No broadcast is needed — a paused duel has no other connected player, and
   * the reconnecting one is sent a fresh snapshot by the gateway right after
   * `playerConnected` (which awaits this) returns.
   */
  private async resumeDuel(gameCode: string, meta: GameMeta): Promise<void> {
    if (!meta.pausedAt) return;
    const now = Date.now();
    const { patch, fireAt, pausedFor } = resumePlan(meta, now);
    // Clearing `pausedAt` is the claim: whoever wins it is the only caller
    // that applies the shift and re-arms, so a reconnect racing the sweeper
    // (or another instance) can't move the deadlines twice.
    if (!(await this.store.claimResume(gameCode, patch))) return;

    if (fireAt !== null) {
      await this.store.setDeadline(gameCode, fireAt);
      await this.store.ensureOwner(gameCode, this.instanceId);
      this.armTimer(gameCode, fireAt - now);
    }
    // Re-arms the bot from the (now shifted) plan in meta, unless it already
    // answered before the pause.
    await this.recoverBotAnswer(gameCode);
    this.logger.log(`Duel ${gameCode} resumed after ${pausedFor}ms paused`);
  }

  async removePlayer(gameCode: string, playerId: string): Promise<void> {
    await this.store.removePlayer(gameCode, playerId);
    this.cancelDisconnectGrace(gameCode, playerId);
  }

  /**
   * Host kicks a player: Redis removal plus the room broadcast, shared by the
   * socket (`remove-player`) and HTTP (`DELETE .../players/:id`) paths. The
   * broadcast goes out before the disconnect so the kicked client still hears
   * it and can leave the game screen; the disconnect then guarantees the
   * kicked player cannot linger in the room (works across instances via the
   * Redis adapter).
   *
   * `banned` only labels the broadcast — the ban itself is recorded by
   * `banPlayer` before this runs.
   */
  async kickPlayer(
    gameCode: string,
    player: { id: string; name?: string; profilePic?: string | null },
    opts?: { banned?: boolean },
  ): Promise<void> {
    await this.removePlayer(gameCode, player.id);
    this.emitRoom(gameCode).emit("player-removed", {
      ...player,
      ...(opts?.banned ? { banned: true } : {}),
    });
    this.io?.in(`player:${player.id}`).disconnectSockets(true);
    // The reveal may now be due (the removed player was the last one
    // everyone was waiting on), and leaderboards need the row gone.
    await this.dispatch(gameCode, { type: "roster-changed" });
  }

  /**
   * Host bans a player: the room-scoped ban is recorded first, so from this
   * point on no connection can be admitted (`playerConnected` checks the ban
   * atomically with the roster write) and the kick's disconnect can't be
   * beaten by a reconnect. Cleared with the rest of the game state at the end.
   */
  async banPlayer(
    gameCode: string,
    player: { id: string; name?: string; profilePic?: string | null },
  ): Promise<void> {
    await this.store.banPlayer(gameCode, player.id);
    await this.kickPlayer(gameCode, player, { banned: true });
  }

  async isBanned(gameCode: string, playerId: string): Promise<boolean> {
    return this.store.isBanned(gameCode, playerId);
  }

  async hostConnected(gameCode: string): Promise<void> {
    await this.store.patchMeta(gameCode, {
      hostConnected: true,
      hostLastSeenAt: Date.now(),
    });
  }

  /**
   * A host socket closed. As with players, a stale socket closing after the
   * host reconnected must not mark them gone — the abandon sweep would end a
   * game whose host is still on it. Same check-write-recheck as
   * `playerDisconnected`.
   */
  async hostDisconnected(gameCode: string): Promise<void> {
    const stillHere = () =>
      this.hasLiveSocket(
        `host:${gameCode}`,
        (d) => d.gameCode === gameCode && d.isRoomHost === true,
      );
    if (await stillHere()) return;
    await this.store.patchMeta(gameCode, {
      hostConnected: false,
      hostLastSeenAt: Date.now(),
    });
    if (await stillHere()) {
      await this.store.patchMeta(gameCode, { hostConnected: true });
    }
  }

  // -- snapshot ----------------------------------------------------------------------

  async getSnapshot(
    gameCode: string,
    playerId?: string | null,
  ): Promise<StateSyncPayload | null> {
    const state = await this.store.loadState(gameCode, [
      "questions",
      "roster",
      "answers",
      "scores",
    ]);
    return state ? buildSnapshot(state, playerId, Date.now()) : null;
  }

  // -- timers / recovery ------------------------------------------------------------

  /**
   * The sweeper only needs to run while deadlines exist, so it is started
   * lazily here (every deadline write is paired with an armTimer call) and
   * stopped by sweep() once the deadline set drains — same pattern as the
   * matchmaking worker. On Upstash this matters: an unconditional 15s poll
   * costs ~350K commands/month at zero users.
   */
  private ensureSweeper(): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      void this.sweep().catch((err) => this.logger.error("Sweep failed", err));
    }, SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  private stopSweeperIfIdle(deadlineCount: number): void {
    // timers.size guards the race where armTimer ran after this sweep's
    // allDeadlines() read: a locally scheduled game keeps the sweeper alive.
    if (deadlineCount === 0 && this.timers.size === 0 && this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = null;
    }
  }

  private armTimer(gameCode: string, delayMs: number): void {
    this.ensureSweeper();
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
    // Only the owner fires a game's transitions, however many instances had
    // a timer armed for it.
    const owner = await this.store.ensureOwner(gameCode, this.instanceId);
    if (!owner) return;
    const state = await this.store.loadState(gameCode, PARTS_FOR.deadline);
    if (!state) {
      await this.store.clearDeadline(gameCode);
      return;
    }
    const { effects } = step(state, { type: "deadline" }, Date.now());
    await this.run(gameCode, effects);
  }

  private async recoverTimers(): Promise<void> {
    const deadlines = await this.store.allDeadlines();
    const now = Date.now();
    for (const { code, atMs } of deadlines) {
      if (atMs <= now) {
        await this.handleDeadline(code);
      } else {
        this.armTimer(code, atMs - now);
        // handleDeadline re-enters the question (and re-plans) on its own; a
        // question still mid-flight needs its bot answer put back by hand.
        await this.recoverBotAnswer(code);
      }
    }
    if (deadlines.length > 0) {
      this.logger.log(`Recovered ${deadlines.length} game timer(s)`);
    }
  }

  /** Re-arms the answer the bot had already committed to before the restart. */
  private async recoverBotAnswer(gameCode: string): Promise<void> {
    const meta = await this.store.getMeta(gameCode);
    if (!meta || meta.phase !== "question" || meta.pausedAt) return;
    const { botId, botAnswerAt } = meta;
    const answer = botAnswerOf(meta);
    if (!botId || !answer || !botAnswerAt) return;
    // Already answered before we went down? submitAnswer is first-write-wins,
    // so a duplicate is harmless — but skip the wasted round trip.
    const answers = await this.store.getAnswers(gameCode, meta.qIndex);
    if (answers[botId]) return;
    this.armBot(gameCode, botId, meta.qIndex, answer, botAnswerAt);
  }

  private async sweep(): Promise<void> {
    const deadlines = await this.store.allDeadlines();
    this.stopSweeperIfIdle(deadlines.length);
    if (deadlines.length === 0) return;
    const now = Date.now();
    // Catch deadlines whose in-process timer was lost (crash, other instance).
    // Failures are isolated per game so one broken state can't starve the rest.
    for (const { code, atMs } of deadlines) {
      if (atMs > now) continue;
      try {
        await this.handleDeadline(code);
      } catch (err) {
        this.logger.error(`Sweep deadline handling failed for ${code}`, err);
      }
    }
    // End games nobody is coming back to. Parked entries keep both host-paced
    // phases and paused duels visible here (see parkDeadline).
    for (const { code } of deadlines) {
      try {
        const meta = await this.store.getMeta(code);
        if (!meta || meta.phase === "ended") continue;
        if (isHostAbandoned(meta, Date.now())) {
          this.logger.warn(`Ending ${code}: host absent for >5min`);
          await this.endGame(code);
        } else if (meta.mode === "duel") {
          await this.sweepDuelForfeits(code, meta);
        }
      } catch (err) {
        this.logger.error(`Sweep abandon check failed for ${code}`, err);
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
    streaks?: StreakChanges;
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

    // `!== false` rather than truthiness: duels already live in Redis before
    // `rated` existed stay rated across the deploy.
    const isRatedDuel =
      meta.mode === "duel" &&
      meta.rated !== false &&
      entries.length === 2 &&
      !opts?.abandoned;
    const categoryId = meta.mode === "duel" ? (meta.categoryId ?? null) : null;
    const userIdOf = (e: LeaderboardEntry) =>
      rosterById.get(e.playerId)?.userId ?? null;

    // Each duellist's outcome: the forfeiter loses outright; otherwise total
    // score decides, and equal scores are a draw. An abandoned duel (both
    // gone) has no outcome.
    const outcomes = new Map<string, DuelOutcome>();
    if (meta.mode === "duel" && entries.length === 2 && !opts?.abandoned) {
      const [a, b] = entries;
      const forfeiter = opts?.forfeitLoserId;
      const forfeited = (e: LeaderboardEntry) =>
        forfeiter !== undefined &&
        (e.playerId === forfeiter || userIdOf(e) === forfeiter);
      let scoreA: 1 | 0.5 | 0;
      if (forfeited(a) || forfeited(b)) {
        scoreA = forfeited(a) ? 0 : 1;
      } else if (a.score === b.score) {
        scoreA = 0.5;
      } else {
        scoreA = a.score > b.score ? 1 : 0;
      }
      outcomes.set(a.playerId, OUTCOME_BY_SCORE[scoreA]);
      outcomes.set(b.playerId, OUTCOME_BY_SCORE[(1 - scoreA) as 1 | 0.5 | 0]);
    }

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
      categoryId,
      playerCount: entries.length,
      questionCount: meta.qCount,
      startedAt: new Date(meta.startedAt),
      entries: {
        create: entries.map((e) => ({
          playerName: e.name,
          profilePic: e.profilePic,
          userId: userIdOf(e),
          score: e.score,
          rank: e.rank,
          correctCount: correctCounts.get(e.playerId) ?? 0,
          eloBefore: elo?.[e.playerId]?.before ?? null,
          eloAfter: elo?.[e.playerId]?.after ?? null,
          outcome: outcomes.get(e.playerId) ?? null,
        })),
      },
    });

    try {
      // A finished duel (not abandoned) applies ratings when rated and the
      // daily streak always, in the same transaction as the result insert.
      if (meta.mode === "duel" && !opts?.abandoned) {
        return await this.prisma.db.$transaction(async (tx) => {
          const eloChanges = isRatedDuel
            ? await this.applyDuelRatings(
                tx,
                meta,
                entries,
                rosterById,
                outcomes,
              )
            : undefined;
          const streaks = await this.applyDailyStreaks(
            tx,
            entries,
            rosterById,
            opts?.forfeitLoserId,
          );
          const result = await tx.gameResult.create({
            data: data(null, null, eloChanges),
            select: { id: true },
          });
          return { resultId: result.id, eloChanges, streaks };
        });
      }

      const result = await this.prisma.db.gameResult.create({
        data: data(meta.quizId || null, meta.hostId || null),
        select: { id: true },
      });
      return { resultId: result.id };
    } catch (err) {
      // Quiz/host/category may have been deleted mid-game; keep the result
      // anyway.
      try {
        const result = await this.prisma.db.gameResult.create({
          data: { ...data(null, null), categoryId: null },
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

  /**
   * Rated duels: each human's rating moves against the opponent's — the
   * category's own rating for a category duel, the global one for Random.
   * A bot's rating comes from meta. Returns undefined (no rating change) if a
   * human's account is gone.
   */
  private async applyDuelRatings(
    tx: Prisma.TransactionClient,
    meta: GameMeta,
    entries: LeaderboardEntry[],
    rosterById: Map<string, RosterEntry>,
    outcomes: Map<string, DuelOutcome>,
  ): Promise<Record<string, { before: number; after: number }> | undefined> {
    const categoryId = meta.categoryId ?? null;
    const current = new Map<string, { rating: number; duelsPlayed: number }>();
    for (const e of entries) {
      if (e.playerId === meta.botId) continue;
      const userId = rosterById.get(e.playerId)?.userId ?? e.playerId;
      if (categoryId) {
        const exists = await tx.user.count({ where: { id: userId } });
        if (!exists) return undefined;
        const row = await tx.userCategoryRating.findUnique({
          where: { userId_categoryId: { userId, categoryId } },
          select: { rating: true, duelsPlayed: true },
        });
        current.set(e.playerId, row ?? { rating: 1200, duelsPlayed: 0 });
      } else {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { eloRating: true, duelsPlayed: true },
        });
        if (!user) return undefined;
        current.set(e.playerId, {
          rating: user.eloRating,
          duelsPlayed: user.duelsPlayed,
        });
      }
    }

    const changes: Record<string, { before: number; after: number }> = {};
    for (const e of entries) {
      const mine = current.get(e.playerId);
      if (!mine) continue; // the bot
      const opponent = entries.find((o) => o.playerId !== e.playerId);
      const opponentRating =
        opponent && opponent.playerId === meta.botId
          ? (meta.botElo ?? mine.rating)
          : (current.get(opponent?.playerId ?? "")?.rating ?? mine.rating);
      const outcome = outcomes.get(e.playerId) ?? "draw";
      const after = applyFloor(
        mine.rating +
          eloDelta(
            mine.rating,
            opponentRating,
            SCORE_BY_OUTCOME[outcome],
            kFactor(mine.duelsPlayed),
          ),
      );
      changes[e.playerId] = { before: mine.rating, after };

      const userId = rosterById.get(e.playerId)?.userId ?? e.playerId;
      if (categoryId) {
        await tx.userCategoryRating.upsert({
          where: { userId_categoryId: { userId, categoryId } },
          create: { userId, categoryId, rating: after, duelsPlayed: 1 },
          update: { rating: after, duelsPlayed: { increment: 1 } },
        });
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { eloRating: after, duelsPlayed: { increment: 1 } },
        });
      }
    }
    return changes;
  }

  /**
   * Daily streak: every signed-in duellist who finished (didn't forfeit)
   * counts today, in their own time zone — rated, unrated and bot duels alike.
   */
  private async applyDailyStreaks(
    tx: Prisma.TransactionClient,
    entries: LeaderboardEntry[],
    rosterById: Map<string, RosterEntry>,
    forfeitLoserId: string | undefined,
  ): Promise<StreakChanges> {
    const now = new Date();
    const streaks: StreakChanges = {};
    for (const e of entries) {
      const userId = rosterById.get(e.playerId)?.userId;
      if (!userId) continue; // bots have no account
      if (forfeitLoserId === userId || forfeitLoserId === e.playerId) continue;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          timeZone: true,
          currentStreak: true,
          bestStreak: true,
          lastStreakDay: true,
        },
      });
      if (!user) continue;
      const today = localDay(now, user.timeZone);
      const next = advanceStreak(
        {
          current: user.currentStreak,
          best: user.bestStreak,
          lastDay: user.lastStreakDay ? dateToDay(user.lastStreakDay) : null,
        },
        today,
      );
      if (next.advanced) {
        await tx.user.update({
          where: { id: userId },
          data: {
            currentStreak: next.current,
            bestStreak: next.best,
            lastStreakDay: dayToDate(today),
          },
        });
        await tx.duelDay.createMany({
          data: [{ userId, day: dayToDate(today) }],
          skipDuplicates: true,
        });
      }
      streaks[e.playerId] = {
        current: next.current,
        best: next.best,
        advanced: next.advanced,
      };
    }
    return streaks;
  }

  // -- helpers ------------------------------------------------------------------------

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
    this.emitRoom(gameCode).emit("player-removed", {
      id: playerId,
      timedOut: true,
    });
  }

  /**
   * Whether `room` still holds a socket matching `match`, on any instance (the
   * redis adapter answers `fetchSockets` cluster-wide). Socket.IO removes a
   * closing socket from its rooms before `disconnect` fires, so the closing
   * one never counts itself. If the check fails, assume nobody is left — the
   * behaviour before this check existed.
   */
  private async hasLiveSocket(
    room: string,
    match: (data: Partial<SocketData>) => boolean,
  ): Promise<boolean> {
    if (!this.io) return false;
    try {
      const sockets = await this.io.in(room).fetchSockets();
      return sockets.some((s) => match(s.data ?? {}));
    } catch (err) {
      this.logger.warn(`Presence check for ${room} failed`, err);
      return false;
    }
  }

  private emitRoom(gameCode: string) {
    if (!this.io) {
      throw new Error("GameEngineService used before gateway init");
    }
    return this.io.to(gameCode);
  }
}
