import type {
  AnswerResultPayload,
  LeaderboardEntry,
  StateSyncPayload,
} from "@buzrr/contract";
import { summarizeAnswers, toPublicQuestion } from "../../question-types";
import type {
  LiveQuestion,
  RosterEntry,
  ScoreEntry,
  StoredAnswer,
} from "../game-engine.types";
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
 * Ranked by score; rostered players who never scored follow in roster order.
 * With `revealAnswers`, each entry carries the points it earned on that
 * question as `delta`.
 */
export function buildLeaderboard(
  scores: ScoreEntry[],
  roster: RosterEntry[],
  revealAnswers?: Record<string, StoredAnswer>,
): LeaderboardEntry[] {
  const byId = new Map(roster.map((p) => [p.id, p]));
  const entries: LeaderboardEntry[] = scores.map((s, i) => ({
    playerId: s.playerId,
    name: byId.get(s.playerId)?.name ?? "Unknown",
    profilePic: byId.get(s.playerId)?.profilePic ?? null,
    score: s.score,
    rank: i + 1,
    ...(revealAnswers ? { delta: revealAnswers[s.playerId]?.score ?? 0 } : {}),
  }));
  // Players who never scored still belong on the board.
  const scored = new Set(scores.map((s) => s.playerId));
  for (const p of roster) {
    if (!scored.has(p.id)) {
      entries.push({
        playerId: p.id,
        name: p.name,
        profilePic: p.profilePic,
        score: 0,
        rank: entries.length + 1,
        ...(revealAnswers ? { delta: 0 } : {}),
      });
    }
  }
  return entries;
}

/** A player's own outcome on the current question, plus their standing. */
export function buildAnswerResult(
  scores: ScoreEntry[],
  answers: Record<string, StoredAnswer>,
  playerId: string,
): AnswerResultPayload {
  const answer = answers[playerId];
  const index = scores.findIndex((s) => s.playerId === playerId);
  return {
    answered: Boolean(answer),
    answer: answer?.answer ?? null,
    isCorrect: answer?.isCorrect ?? false,
    score: answer?.score ?? 0,
    totalScore: index === -1 ? 0 : (scores[index]?.score ?? 0),
    rank: index === -1 ? null : index + 1,
  };
}

export function buildReveal(
  question: LiveQuestion,
  index: number,
  answers: Record<string, StoredAnswer>,
) {
  return {
    index,
    summary: summarizeAnswers(
      question,
      Object.values(answers).map((a) => a.answer),
    ),
    avgTimeMs: averageAnswerMs(answers),
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

  const question = state.questions[meta.qIndex];
  const inReveal = meta.phase === "reveal";
  if (question && (meta.phase === "question" || inReveal)) {
    payload.question = toPublicQuestion(question);
    if (meta.phase === "question") {
      // Unstamped is only possible for meta written by an older build (the
      // window is durable before the broadcast); fall back to the full window
      // rather than showing a dead countdown.
      payload.remainingMs = meta.qStartAt
        ? Math.max(0, meta.qDeadline - now)
        : question.timeOut * 1000;
      payload.answeredCount = Object.keys(answers).length;
    } else {
      payload.reveal = buildReveal(question, meta.qIndex, answers);
    }
  }

  if (inReveal || meta.phase === "final" || meta.phase === "ended") {
    payload.leaderboard = buildLeaderboard(
      scores,
      roster,
      inReveal ? answers : undefined,
    );
  }

  if (playerId) {
    const you = buildAnswerResult(scores, answers, playerId);
    // While the question is open a player may learn *that* their answer was
    // stored (and which one — reconnects re-lock on it), never whether it was
    // right: the verdict, the points, and the total/rank they already move
    // all wait for the reveal.
    payload.you =
      meta.phase === "question"
        ? {
            ...you,
            isCorrect: false,
            score: 0,
            totalScore: you.totalScore - you.score,
            rank: null,
          }
        : you;
  }
  return payload;
}
