import type { ModerationSettings } from "@buzrr/contract";
import { tx } from "@/lib/i18n/context";

// Mirrors apps/server/src/modules/game-engine/core/moderation.ts: what the
// host's "next" does in each moderated step, so buttons can say so.

/** The reveal is followed by a separate, host-triggered scores step. */
export function scoresStepPending(mod: ModerationSettings | null): boolean {
  return Boolean(mod?.showScores && mod.confirmShowScores);
}

/** The running leaderboard is shown together with the reveal. */
export function leaderboardWithReveal(mod: ModerationSettings | null): boolean {
  return mod === null || (mod.showScores && !mod.confirmShowScores);
}

/** Label for the host's button that leaves the current question for good. */
export function nextQuestionLabel(qIndex: number, qCount: number): string {
  return qIndex >= qCount - 1
    ? tx("Final leaderboard")
    : tx("Next question · {n} of {total}", { n: qIndex + 2, total: qCount });
}

/** Host button on the "closed" (time's up) step. */
export function closedNextLabel(
  mod: ModerationSettings | null,
  qIndex: number,
  qCount: number,
  /** Unscored questions skip the scores step. */
  scored = true,
  /** Nothing to reveal (`revealHasPoint`): the host goes straight on. */
  reveals = true,
): string {
  if (mod?.showAnswer && reveals) return tx("Show answer");
  if (!reveals) return nextQuestionLabel(qIndex, qCount);
  if (mod?.showScores && scored) return tx("Show scores");
  return nextQuestionLabel(qIndex, qCount);
}
