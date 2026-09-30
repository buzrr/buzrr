/**
 * Canonical identity of the public site. Every canonical URL, sitemap entry
 * and JSON-LD `@id` is built from `SITE_URL` — never from a request host,
 * preview deployment or `NEXT_PUBLIC_APP_URL` (which differs per environment).
 * The apex `buzrr.in` redirects to www, so www is canonical.
 */
export const SITE_URL = "https://www.buzrr.in";
export const SITE_NAME = "Buzrr";

export const DEFAULT_TITLE =
  "Buzrr — Open-Source Live Quiz Platform with Ranked 1v1 Quiz Battles";

/** The one-sentence definition reused in metadata and JSON-LD. */
export const SITE_DESCRIPTION =
  "Open-source quiz platform: host live multiplayer quiz rooms players join with a code, play ranked 1v1 quiz battles, and generate quizzes with AI. Free to start.";

export const REPO_URL = "https://github.com/buzrr/buzrr";
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

export const SOCIAL_PROFILES = [
  REPO_URL,
  "https://www.instagram.com/buzrr.in/",
  "https://www.youtube.com/@BuzznoldBuzzenegger",
];

/** `"/alternatives/kahoot"` → `"https://www.buzrr.in/alternatives/kahoot"`. */
export function absoluteUrl(path = "/"): string {
  if (path === "/" || path === "") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
