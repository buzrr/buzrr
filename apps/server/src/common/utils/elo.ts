export const ELO_FLOOR = 100;
export const PROVISIONAL_GAMES = 10;

/** Higher K while a player's rating is still settling. */
export function kFactor(duelsPlayed: number): number {
  return duelsPlayed < PROVISIONAL_GAMES ? 40 : 24;
}

/**
 * Standard ELO delta for player A.
 * @param scoreA 1 = A won, 0.5 = tie, 0 = A lost
 */
export function eloDelta(
  ratingA: number,
  ratingB: number,
  scoreA: 1 | 0.5 | 0,
  k: number,
): number {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  return Math.round(k * (scoreA - expectedA));
}

export function applyFloor(rating: number): number {
  return Math.max(rating, ELO_FLOOR);
}
