// The host's standings after a question and at the end: the old order
// first, then the points count up (longer for more, at most MAX_COUNT_MS),
// then the rows glide into their new order. At the end the winners then
// step onto the podium — third, second, first — and the fireworks start.
// Shared so the server can tell players when the host's podium stands.

/** The host's standings show this many rows. */
export const RANKING_ROWS = 20;
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

/**
 * The longest count-up among the rows the host shows first: the top
 * `rows` of the standings before the question (score minus `delta`).
 */
export function standingsCountMs(
  entries: readonly { score: number; delta?: number }[],
  rows = RANKING_ROWS,
): number {
  const before = entries
    .map((e, i) => ({ e, i, prev: e.score - (e.delta ?? 0) }))
    .sort((a, b) => b.prev - a.prev || a.i - b.i)
    .slice(0, rows);
  return Math.max(0, ...before.map(({ e }) => countUpMs(e.delta ?? 0)));
}

/** When the host's final podium stands, for the whole board's entries. */
export function finalRevealMs(
  entries: readonly { score: number; delta?: number }[],
): number {
  const resorts = entries.some((e) => (e.delta ?? 0) > 0);
  return podiumDoneMs(resorts, standingsCountMs(entries));
}
