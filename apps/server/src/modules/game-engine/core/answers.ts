import { resolveAnswerTiming } from "../../../common/utils/answer-timing";
import { checkAnswer, scoreAnswer } from "../../question-types";
import type { StoredAnswer } from "../game-engine.types";
import type { GameState } from "./state";

export type AnswerJudgement =
  | { accepted: false; reason: string }
  | { accepted: true; stored: StoredAnswer };

/**
 * Decides whether a submitted answer counts and what it scores — purely, from
 * the game's state and the server's receive time. Storing it is the shell's
 * job (first write wins, `HSETNX`), so a judgement of "accepted" can still
 * lose to an earlier answer from the same player.
 *
 * Needs `meta`, `questions` and `roster` loaded.
 */
export function judgeAnswer(
  state: GameState,
  input: { playerId: string; qIndex: number; answer: unknown },
  receivedAt: number,
): AnswerJudgement {
  const { meta } = state;
  if (meta.phase !== "question") {
    return { accepted: false, reason: "No question is active" };
  }
  if (input.qIndex !== meta.qIndex) {
    return { accepted: false, reason: "Question already advanced" };
  }
  // The window is stamped before `question-start` is broadcast; an unstamped
  // one can only be meta left behind by an older build.
  if (!meta.qStartAt) {
    return { accepted: false, reason: "Question has not started" };
  }
  // Server-measured time: never trust the client clock, and never take a
  // correction the client can influence. Answers are accepted for a short
  // fixed grace past the deadline so ones sent in time can still arrive.
  const timing = resolveAnswerTiming({
    receivedAt,
    qStartAt: meta.qStartAt,
    qDeadline: meta.qDeadline,
  });
  if (!timing.accepted) {
    return { accepted: false, reason: "Time is up" };
  }

  // Kicked players are removed from the roster but may still hold a live
  // socket for a moment — never accept intents from outside the roster.
  if (!state.roster.some((p) => p.id === input.playerId)) {
    return { accepted: false, reason: "Not in this game" };
  }

  const question = state.questions[input.qIndex];
  if (!question) {
    return { accepted: false, reason: "Question not found" };
  }
  const check = checkAnswer(question, input.answer);
  if (!check) {
    return { accepted: false, reason: "Invalid answer" };
  }

  return {
    accepted: true,
    stored: {
      answer: check.answer,
      answeredAt: receivedAt,
      timeTakenMs: timing.timeTakenMs,
      isCorrect: check.correct,
      score: scoreAnswer(question, check, timing.timeTakenMs),
    },
  };
}
