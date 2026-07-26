/**
 * Prefers NEXT_PUBLIC_APP_URL; falls back to the browser origin so links still
 * resolve when the env var is unset (e.g. local dev / previews).
 */
function appOrigin(): string {
  const rawBase =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  // Drop any trailing slash(es) so a configured base like "https://app.com/"
  // doesn't produce "https://app.com//join/CODE".
  return rawBase.replace(/\/+$/, "");
}

/**
 * Builds the public, shareable join URL for a hosted quiz. Players who open it
 * enter a name and are dropped straight into the game (see /join/[gameCode]).
 */
export function buildJoinUrl(gameCode: string): string {
  return `${appOrigin()}/join/${encodeURIComponent(gameCode)}`;
}

/**
 * Builds the shareable link for a 1v1 friend challenge. Unlike a hosted-quiz
 * join link, the page behind it requires a signed-in account.
 */
export function buildDuelInviteUrl(code: string): string {
  return `${appOrigin()}/duel/invite/${encodeURIComponent(code)}`;
}
