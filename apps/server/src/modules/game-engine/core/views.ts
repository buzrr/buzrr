import {
  denseRanks,
  type AnswerResultPayload,
  type LeaderboardEntry,
  type StateSyncPayload,
} from "@buzrr/contract";
import {
  summarizeAnswers,
  toPublicQuestion,
  type AnswerEntry,
} from "../../question-types";
import type {
  LiveQuestion,
  RosterEntry,
  ScoreEntry,
  StoredAnswer,
} from "../game-engine.types";
import {
  HOST_LEADERBOARD_TOP,
  PLAYER_LEADERBOARD_TOP,
  isScoredType,
} from "@buzrr/contract";
import { leaderboardWithReveal, moderationOf } from "./moderation";
import type { GameState } from "./state";

// Pure projections of a game's state into what clients are sent.

export function averageAnswerMs(
  answers: Record<string, StoredAnswer>,
): number | null {
  const list = Object.values(answers);
  if (list.length === 0) return null;
  return Math.round(
    list.reduce((sum, a) => sum + a.timeTakenMs, 0) / list.length,
  );
}

/**
 * What a player is sent of the leaderboard: the top `PLAYER_LEADERBOARD_TOP`,
 * plus their own row (snapshots only — a room broadcast has no "own").
 */
export function topOfLeaderboard(
  entries: LeaderboardEntry[],
  playerId?: string,
): LeaderboardEntry[] {
  const top = entries.slice(0, PLAYER_LEADERBOARD_TOP);
  const own = playerId
    ? entries.slice(PLAYER_LEADERBOARD_TOP).find((e) => e.playerId === playerId)
    : undefined;
  return own ? [...top, own] : top;
}

/**
 * What the host is sent of the leaderboard: the top `HOST_LEADERBOARD_TOP`,
 * plus — when the entries carry this question's `delta` — whoever was in
 * the top before it. Order and ranks stay the full board's.
 */
export function hostOfLeaderboard(
  entries: LeaderboardEntry[],
): LeaderboardEntry[] {
  if (entries.length <= HOST_LEADERBOARD_TOP) return entries;
  const keep = new Set(
    entries.slice(0, HOST_LEADERBOARD_TOP).map((e) => e.playerId),
  );
  if (entries.some((e) => e.delta !== undefined)) {
    entries
      .map((e, i) => ({ id: e.playerId, i, before: e.score - (e.delta ?? 0) }))
      .sort((a, b) => b.before - a.before || a.i - b.i)
      .slice(0, HOST_LEADERBOARD_TOP)
      .forEach((e) => keep.add(e.id));
  }
  return entries.filter((e) => keep.has(e.playerId));
}

/**
 * Ranked by score, equal scores sharing a rank; rostered players who never
 * scored follow at zero, in roster order. With `revealAnswers`, each entry
 * carries the points it earned on that question as `delta`.
 */
export function buildLeaderboard(
  scores: ScoreEntry[],
  roster: RosterEntry[],
  revealAnswers?: Record<string, StoredAnswer>,
): LeaderboardEntry[] {
  const byId = new Map(roster.map((p) => [p.id, p]));
  // Players who never scored still belong on the board.
  const scored = new Set(scores.map((s) => s.playerId));
  const rows = [
    ...scores,
    ...roster
      .filter((p) => !scored.has(p.id))
      .map((p) => ({ playerId: p.id, score: 0 })),
  ].sort((a, b) => b.score - a.score);
  const ranks = denseRanks(rows.map((r) => r.score));
  return rows.map((r, i) => ({
    playerId: r.playerId,
    name: byId.get(r.playerId)?.name ?? "Unknown",
    profilePic: byId.get(r.playerId)?.profilePic ?? null,
    score: r.score,
    rank: ranks[i]!,
    ...(revealAnswers ? { delta: revealAnswers[r.playerId]?.score ?? 0 } : {}),
  }));
}

/** Where `score` places among `scores` — one below each higher distinct score. */
function rankAmong(score: number, scores: ScoreEntry[]): number {
  return (
    new Set(scores.filter((s) => s.score > score).map((s) => s.score)).size + 1
  );
}

/**
 * A player's own outcome on the current question, plus their standing. A
 * player who hasn't scored ranks with everyone else on zero.
 */
export function buildAnswerResult(
  scores: ScoreEntry[],
  answers: Record<string, StoredAnswer>,
  playerId: string,
): AnswerResultPayload {
  const answer = answers[playerId];
  const totalScore = scores.find((s) => s.playerId === playerId)?.score ?? 0;
  return {
    answered: Boolean(answer),
    answer: answer?.answer ?? null,
    isCorrect: answer?.isCorrect ?? false,
    score: answer?.score ?? 0,
    totalScore,
    rank: rankAmong(totalScore, scores),
    timeTakenMs: answer?.timeTakenMs ?? null,
  };
}

/** The three quickest right answers (scored types only). */
function fastestCorrect(
  question: LiveQuestion,
  answers: Record<string, StoredAnswer>,
  roster: RosterEntry[],
) {
  if (!isScoredType(question.type)) return undefined;
  const byId = new Map(roster.map((p) => [p.id, p]));
  return Object.entries(answers)
    .filter(([, a]) => a.isCorrect)
    .sort(([, a], [, b]) => a.timeTakenMs - b.timeTakenMs)
    .slice(0, 3)
    .map(([playerId, a]) => {
      const p = byId.get(playerId);
      return {
        playerId,
        name: p?.name ?? "Player",
        profilePic: p?.profilePic ?? null,
        timeMs: a.timeTakenMs,
      };
    });
}

/**
 * Everyone's score before the open question's answers were counted — the
 * standings as of the last reveal.
 */
function scoresBefore(
  scores: ScoreEntry[],
  answers: Record<string, StoredAnswer>,
): ScoreEntry[] {
  return scores.map((s) => ({
    playerId: s.playerId,
    score: s.score - (answers[s.playerId]?.score ?? 0),
  }));
}

/**
 * Stored answers as a type's `summarize` takes them: oldest first, each with
 * its author while the roster still has them.
 */
export function answerEntries(
  answers: Record<string, StoredAnswer>,
  roster: RosterEntry[],
): AnswerEntry[] {
  const byId = new Map(roster.map((p) => [p.id, p]));
  return Object.entries(answers)
    .sort(([, a], [, b]) => a.answeredAt - b.answeredAt)
    .map(([playerId, stored]) => {
      const player = byId.get(playerId);
      return {
        answer: stored.answer,
        author: player
          ? { name: player.name, profilePic: player.profilePic }
          : null,
      };
    });
}

export function buildReveal(
  question: LiveQuestion,
  index: number,
  answers: Record<string, StoredAnswer>,
  roster: RosterEntry[],
) {
  return {
    index,
    summary: summarizeAnswers(question, answerEntries(answers, roster)),
    avgTimeMs: averageAnswerMs(answers),
    fastest: fastestCorrect(question, answers, roster),
    // The reveal clip becomes playable only now.
    ...(question.audio?.revealKey
      ? { audioRevealKey: question.audio.revealKey }
      : {}),
  };
}

/**
 * The full `state-sync` snapshot a (re)connecting client renders from. The
 * open question goes out through its type's `toPublic` — the answer key only
 * appears once the phase is `reveal`.
 */
export function buildSnapshot(
  state: GameState,
  playerId: string | null | undefined,
  now: number,
): StateSyncPayload {
  const { meta, roster, answers, scores } = state;
  const payload: StateSyncPayload = {
    phase: meta.phase,
    mode: meta.mode,
    qIndex: meta.qIndex,
    qCount: meta.qCount,
    players: roster.map((p) => ({
      id: p.id,
      name: p.name,
      profilePic: p.profilePic,
      connected: p.connected,
    })),
  };

  if (meta.phase === "starting") {
    // Lets a client that (re)connects mid-countdown show the real time left.
    payload.remainingMs = Math.max(0, meta.qDeadline - now);
  }
  const mod = moderationOf(meta);
  if (mod) payload.moderation = mod;
  const question = state.questions[meta.qIndex];
  const inReveal = meta.phase === "reveal";
  const inScores = meta.phase === "scores";
  if (
    question &&
    (meta.phase === "question" ||
      meta.phase === "closed" ||
      inReveal ||
      inScores)
  ) {
    payload.question = toPublicQuestion(question);
    // "closed" (and scores with answers hidden) keep the answer key back.
    const answerHidden =
      meta.phase === "closed" || (inScores && !mod?.showAnswer);
    if (answerHidden) {
      // Nothing beyond the public question.
    } else if (meta.phase === "question") {
      // Unstamped is only possible for meta written by an older build (the
      // window is durable before the broadcast); fall back to the full window
      // rather than showing a dead countdown.
      payload.remainingMs = meta.qStartAt
        ? Math.max(0, meta.qDeadline - now)
        : question.timeOut * 1000;
      payload.answeredCount = Object.keys(answers).length;
    } else {
      payload.reveal = buildReveal(
        question,
        meta.qIndex,
        answers,
        state.roster,
      );
    }
  }

  if (
    (inReveal && leaderboardWithReveal(mod)) ||
    inScores ||
    meta.phase === "final" ||
    meta.phase === "ended"
  ) {
    const board = buildLeaderboard(
      scores,
      roster,
      inReveal || inScores ? answers : undefined,
    );
    if (playerId && board.length > PLAYER_LEADERBOARD_TOP) {
      payload.leaderboard = topOfLeaderboard(board, playerId);
      payload.leaderboardTotal = board.length;
    } else if (!playerId && board.length > HOST_LEADERBOARD_TOP) {
      payload.leaderboard = hostOfLeaderboard(board);
      payload.leaderboardTotal = board.length;
    } else {
      payload.leaderboard = board;
    }
  }

  // A host reconnecting in "closed" gets the tally its screen shows.
  if (!playerId && meta.phase === "closed" && question) {
    const {
      audioRevealKey: _key,
      fastest: _fastest,
      ...tally
    } = buildReveal(question, meta.qIndex, answers, roster);
    void _key;
    payload.closedSummary = tally;
  }

  if (
    (meta.phase === "final" || meta.phase === "ended") &&
    meta.finalSoundKey
  ) {
    payload.finalSoundKey = meta.finalSoundKey;
  }

  if (playerId) {
    const you = buildAnswerResult(scores, answers, playerId);
    // While the question is open a player may learn *that* their answer was
    // stored (and which one — reconnects re-lock on it), never whether it was
    // right: the verdict, the points, and the total/rank they already move
    // all wait for the reveal. Total and rank are as of the last reveal.
    // Moderated "closed" keeps the verdict back the same way until the
    // answer (or the scores) are shown.
    const masked = meta.phase === "question" || meta.phase === "closed";
    payload.you = masked
      ? {
          ...you,
          isCorrect: false,
          score: 0,
          totalScore: you.totalScore - you.score,
          rank: rankAmong(
            you.totalScore - you.score,
            scoresBefore(scores, answers),
          ),
        }
      : you;
  }
  return payload;
}
