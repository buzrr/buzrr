import type { ModerationSettings } from "@buzrr/contract";

// Mirrors apps/server/src/modules/game-engine/core/moderation.ts: what the
// host's "next" does in each moderated step, so buttons can say so.

/** The reveal is followed by a separate, host-triggered scores step. */
export function scoresStepPending(mod: ModerationSettings | null): boolean {
  return Boolean(mod?.showScores && mod.confirmShowScores);
}

/**
 * The running leaderboard is shown together with the reveal — not after a
 * moderated game's last question (the final standings come next).
 */
export function leaderboardWithReveal(
  mod: ModerationSettings | null,
  lastQuestion = false,
): boolean {
  return (
    mod === null || (mod.showScores && !mod.confirmShowScores && !lastQuestion)
  );
}

/** Label for the host's button that leaves the current question for good. */
export function nextQuestionLabel(qIndex: number, qCount: number): string {
  return qIndex >= qCount - 1
    ? "Final leaderboard"
    : `Next question · ${qIndex + 2} of ${qCount}`;
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
  if (mod?.showAnswer && reveals) return "Show answer";
  if (!reveals) return nextQuestionLabel(qIndex, qCount);
  if (mod?.showScores && scored) return "Show standings";
  return nextQuestionLabel(qIndex, qCount);
}
