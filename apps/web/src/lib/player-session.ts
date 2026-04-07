/** Clears player identity from localStorage (browser only). */
export function clearPlayerLocalSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("playerId");
  window.localStorage.removeItem("playerToken");
}
