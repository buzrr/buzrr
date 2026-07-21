/**
 * Builds the public, shareable join URL for a hosted quiz. Players who open it
 * enter a name and are dropped straight into the game (see /join/[gameCode]).
 *
 * Prefers NEXT_PUBLIC_APP_URL; falls back to the browser origin so the link
 * still resolves when the env var is unset (e.g. local dev / previews).
 */
export function buildJoinUrl(gameCode: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/join/${encodeURIComponent(gameCode)}`;
}
