import type {
  AnswerResultPayload,
  QuestionAnswer,
  QuestionEndPayload,
} from "@buzrr/contract";
import { resolveAnswerTiming } from "../../common/utils/answer-timing";
import {
  checkAnswer,
  scoreAnswer,
  summarizeAnswers,
  type LiveQuestion,
} from "../question-types";

// Pure rules of "Play alone" (ADR-016): each player's own question window,
// judged with the live game's handlers, timing and scoring.

/** A stored answer of an attempt; `answer` null = the time ran out. */
export interface SoloAnswerRow {
  qIndex: number;
  answer: QuestionAnswer | null;
  timeTakenMs: number;
  isCorrect: boolean;
  score: number;
}

export type SoloJudgement =
  | { kind: "invalid" }
  | { kind: "late"; row: SoloAnswerRow }
  | { kind: "ok"; row: SoloAnswerRow };

/** When the question opened at `qStartAt` stops taking answers. */
export const soloDeadline = (question: LiveQuestion, qStartAt: number) =>
  qStartAt + question.timeOut * 1000;

/** A question whose time ran out unanswered. */
export const missedRow = (
  question: LiveQuestion,
  qIndex: number,
): SoloAnswerRow => ({
  qIndex,
  answer: null,
  timeTakenMs: question.timeOut * 1000,
  isCorrect: false,
  score: 0,
});

/**
 * An answer to the open question, received at `now` (server time): invalid,
 * too late (stored as missed) or judged and scored.
 */
export function judgeSoloAnswer(
  question: LiveQuestion,
  qIndex: number,
  qStartAt: number,
  raw: unknown,
  now: number,
): SoloJudgement {
  const timing = resolveAnswerTiming({
    receivedAt: now,
    qStartAt,
    qDeadline: soloDeadline(question, qStartAt),
  });
  if (!timing.accepted)
    return { kind: "late", row: missedRow(question, qIndex) };
  const check = checkAnswer(question, raw);
  if (!check) return { kind: "invalid" };
  return {
    kind: "ok",
    row: {
      qIndex,
      answer: check.answer,
      timeTakenMs: timing.timeTakenMs,
      isCorrect: check.correct,
      score: scoreAnswer(question, check, timing.timeTakenMs),
    },
  };
}

/**
 * The reveal of one answered question, in the live game's shapes: the
 * player's result and the question's solution.
 */
export function soloReveal(
  question: LiveQuestion,
  row: SoloAnswerRow,
  totalScore: number,
): { you: AnswerResultPayload; reveal: QuestionEndPayload } {
  const entries = row.answer ? [{ answer: row.answer, author: null }] : [];
  return {
    you: {
      answered: row.answer !== null,
      answer: row.answer,
      isCorrect: row.isCorrect,
      score: row.score,
      totalScore,
      rank: null,
      timeTakenMs: row.answer ? row.timeTakenMs : null,
    },
    reveal: {
      index: row.qIndex,
      summary: summarizeAnswers(question, entries),
      avgTimeMs: row.answer ? row.timeTakenMs : null,
    },
  };
}

/** Place among finished attempts: one more than those who scored higher. */
export const soloRank = (score: number, scores: number[]) =>
  1 + scores.filter((s) => s > score).length;
