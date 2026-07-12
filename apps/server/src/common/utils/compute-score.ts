/**
 * Kahoot-style score decay. Same math as the legacy HTTP scoring path,
 * but in milliseconds and with server-measured time.
 * 1000 at t=0 decaying to 100 at the time limit; 0 for wrong answers.
 */
export function computeScore(
  isCorrect: boolean,
  timeTakenMs: number,
  timeOutSec: number,
): number {
  if (!isCorrect) return 0;
  const limitMs = timeOutSec * 1000;
  const clamped = Math.min(Math.max(timeTakenMs, 0), limitMs);
  if (clamped < limitMs) {
    return Math.round(1000 - (clamped / limitMs) * 900);
  }
  return 100;
}
