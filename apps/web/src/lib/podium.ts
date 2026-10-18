// The final standings on the host's board: the rankings re-sort (when the
// last question brought points), then the winners step onto the podium —
// third, second, first — then the fireworks. Players learn their place only
// then (moderated games).

/** The rankings start on the old standings this long, then count up. */
export const SETTLE_DELAY_MS = 1100;
/** How long the re-sort runs (count-up and glide). */
export const RESORT_MS = 900;
/** The podium fills third, second, first this far apart, then fireworks. */
export const PODIUM_STEP_MS = 900;

/** When the podium starts filling. */
export function podiumStartMs(resorts: boolean): number {
  return resorts ? SETTLE_DELAY_MS + RESORT_MS : 500;
}

/** When the podium stands and the fireworks start. */
export function podiumDoneMs(resorts: boolean): number {
  return podiumStartMs(resorts) + 3 * PODIUM_STEP_MS;
}
