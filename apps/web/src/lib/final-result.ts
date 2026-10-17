/**
 * The player's last final result, kept in localStorage so the "thank you"
 * screen stays — after the host ends the room, and after a reload — until
 * the player joins another game.
 */
export interface FinalResult {
  playerId: string;
  quizTitle: string;
  position: number | null;
  score: number;
  players: number;
}

const KEY = "buzrr:final-result";

export function saveFinalResult(r: FinalResult) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // ignore
  }
}

export function loadFinalResult(playerId: string): FinalResult | null {
  try {
    const r = JSON.parse(
      window.localStorage.getItem(KEY) ?? "null",
    ) as FinalResult | null;
    return r && r.playerId === playerId ? r : null;
  } catch {
    return null;
  }
}

export function clearFinalResult() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
