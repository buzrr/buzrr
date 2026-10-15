import type { DuelMatchedPayload } from "@buzrr/contract";

/**
 * The `duel:matched` payload, kept per game so the countdown can show the
 * opponent, category and question count before the first state-sync lands.
 */
export type StoredMatch = Pick<
  DuelMatchedPayload,
  "opponent" | "category" | "questionCount"
>;

const key = (gameCode: string) => `duel:matched:${gameCode}`;

export function storeMatched(payload: DuelMatchedPayload): void {
  try {
    const value: StoredMatch = {
      opponent: payload.opponent,
      category: payload.category,
      questionCount: payload.questionCount,
    };
    sessionStorage.setItem(key(payload.gameCode), JSON.stringify(value));
  } catch {
    // Non-fatal: the game screen falls back to the roster.
  }
}

export function readMatched(gameCode: string): StoredMatch | null {
  try {
    const raw = sessionStorage.getItem(key(gameCode));
    return raw ? (JSON.parse(raw) as StoredMatch) : null;
  } catch {
    return null;
  }
}
