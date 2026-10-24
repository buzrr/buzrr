import type { QuestionStats } from "@buzrr/contract";

/** Share of right answers (0–1); null for unscored types or no answers. */
export function correctRate(q: QuestionStats): number | null {
  if (q.correct === null || q.responses === 0) return null;
  return q.correct / q.responses;
}

/**
 * The wrong answer picked most often, when the type has one: an incorrect
 * option, the wrong side of true / false, or a wrong typed answer.
 */
export function commonWrongAnswer(
  q: QuestionStats,
): { text: string; count: number } | null {
  const s = q.summary;
  if (s.type === "multiple_choice") {
    let best: { text: string; count: number } | null = null;
    q.options.forEach((o, i) => {
      const count = s.counts[i] ?? 0;
      if (!o.isCorrect && count > 0 && count > (best?.count ?? 0)) {
        best = { text: o.title, count };
      }
    });
    return best;
  }
  if (s.type === "true_false") {
    const count = s.answer ? s.falseCount : s.trueCount;
    return count > 0 ? { text: s.answer ? "False" : "True", count } : null;
  }
  if (s.type === "type_answer") {
    const wrong = s.answers.find((a) => !a.correct);
    return wrong ? { text: wrong.text, count: wrong.count } : null;
  }
  return null;
}

/** Average of a rating question (1-based), or null without answers. */
export function ratingAverage(counts: number[]): number | null {
  const n = counts.reduce((s, c) => s + c, 0);
  if (n === 0) return null;
  return counts.reduce((s, c, i) => s + c * (i + 1), 0) / n;
}
