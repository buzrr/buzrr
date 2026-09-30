/**
 * Public content routes: pages meant to be read by visitors and crawlers,
 * whose only persisted client state is the theme. `ReduxProvider` renders
 * these without waiting for redux-persist, so their HTML is server-rendered.
 * App routes (admin, player, duel, …) are deliberately not listed.
 */
const EXACT = new Set(["/", "/pricing", "/support", "/docs"]);
const PREFIXES = [
  "/alternatives",
  "/compare/",
  "/use-cases",
  "/open-source-quiz-platform",
  "/self-hosted-quiz",
];

export function isPublicContentPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXACT.has(pathname) || PREFIXES.some((p) => pathname.startsWith(p));
}
