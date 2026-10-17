/**
 * Instance switches, compiled in at build time (NEXT_PUBLIC_*, see the web
 * Dockerfile build args) so server code, client components and the proxy all
 * agree without a round-trip.
 *
 * - NEXT_PUBLIC_BILLING=ON: show pricing, plans and upgrade prompts. Must match
 *   the server's BILLING. Anything else hides every plan/pricing hint.
 * - NEXT_PUBLIC_PRIVATE_BUZZ=ON: a private instance — no marketing pages, a
 *   bare landing page (1v1, join room, admin login) and no donation prompts.
 * - NEXT_PUBLIC_TITLE: site name/title (browser tab, page title suffix, app
 *   manifest). Empty keeps the Buzrr defaults.
 */
export const BILLING_ENABLED =
  process.env.NEXT_PUBLIC_BILLING?.toUpperCase() === "ON";

export const PRIVATE_BUZZ =
  process.env.NEXT_PUBLIC_PRIVATE_BUZZ?.toUpperCase() === "ON";

export const INSTANCE_TITLE = process.env.NEXT_PUBLIC_TITLE?.trim() || "";
