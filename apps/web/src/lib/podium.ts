// The host's standings after a question (scores step) and at the end: the
// old order first, then the points count up (longer for more, at most
// MAX_COUNT_MS), then the rows glide into their new order. At the end the
// winners then step onto the podium — third, second, first — and the
// fireworks start. Players learn their place only then (moderated games).

/** The old standings stay this long before the points count up. */
export const SETTLE_DELAY_MS = 1100;
/** Points count up for at most this long. */
export const MAX_COUNT_MS = 4000;
/** A short pause between the count-up and the re-sort. */
export const COUNT_PAUSE_MS = 300;
/** How long the re-sort (rows gliding, leaving, entering) runs. */
export const RESORT_MS = 900;
/** The podium fills third, second, first this far apart, then fireworks. */
export const PODIUM_STEP_MS = 900;

/** How long a row's points count up: the more points, the longer. */
export function countUpMs(delta: number): number {
  if (delta <= 0) return 0;
  return Math.min(MAX_COUNT_MS, 600 + delta * 2.5);
}

/** When the re-sort starts, after a count-up of `countMs`. */
export function resortStartMs(countMs: number): number {
  return SETTLE_DELAY_MS + countMs + COUNT_PAUSE_MS;
}

/**
 * When the podium starts filling: after the re-sort when there are new
 * points (`countMs`: the longest count-up; the most it can be when unknown).
 */
export function podiumStartMs(
  resorts: boolean,
  countMs = MAX_COUNT_MS,
): number {
  return resorts ? resortStartMs(countMs) + RESORT_MS : 500;
}

/** When the podium stands and the fireworks start. */
export function podiumDoneMs(resorts: boolean, countMs?: number): number {
  return podiumStartMs(resorts, countMs) + 3 * PODIUM_STEP_MS;
}
