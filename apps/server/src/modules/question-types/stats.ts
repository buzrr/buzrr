import type { QuestionStats } from "@buzrr/contract";
import type { AnswerEntry, LiveQuestion } from "./question-type";
import { summarizeAnswers } from "./registry";

/**
 * How one question went, for the host's report: the reveal's summary plus
 * the answer count, how many were right and the average time. `entries`
 * oldest first (as `summarizeAnswers` takes them); `timesMs` the time each
 * answer took.
 */
export function questionStats(
  question: LiveQuestion,
  index: number,
  entries: AnswerEntry[],
  timesMs: number[],
): QuestionStats {
  const summary = summarizeAnswers(question, entries);
  return {
    index,
    title: question.title,
    type: question.type,
    image: question.mediaType === "image" ? question.media : null,
    options: question.options.map(({ id, title, isCorrect }) => ({
      id,
      title,
      isCorrect,
    })),
    summary,
    responses: summary.responses,
    correct: "correct" in summary ? summary.correct : null,
    avgTimeMs:
      timesMs.length === 0
        ? null
        : Math.round(timesMs.reduce((s, t) => s + t, 0) / timesMs.length),
  };
}
