"use client";

import type { PostHog } from "posthog-js";

/**
 * Thin wrapper around posthog-js.
 *
 * PostHog is optional: without NEXT_PUBLIC_POSTHOG_KEY the SDK is never even
 * downloaded and every helper here is a no-op, so local and self-hosted setups
 * run fine with no analytics account. When it is configured, the ~200 kB SDK is
 * imported lazily so it stays off the initial page bundle.
 *
 * Tracking is also scoped by route — see `isTrackedPath`.
 */

export const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || "";

export const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";

export const isAnalyticsEnabled = Boolean(posthogKey);

/** Product events. Keep this union the single source of truth for names. */
export type AnalyticsEvent =
  | "duel_queue_started"
  | "duel_matched"
  | "duel_queue_timeout"
  | "duel_queue_failed";

type AnalyticsProperties = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Route scoping
// ---------------------------------------------------------------------------
// Analytics is deliberately limited to the landing page, the pre-game entry
// points, and the non-gameplay admin screens. Live gameplay is excluded so no
// analytics traffic competes with the realtime socket during a match.

/** Landing page and the pre-game entry points, matched exactly. */
const TRACKED_EXACT = new Set(["/", "/duel", "/player"]);

/** Pre-game entry points that carry a dynamic segment. */
const TRACKED_PREFIXES = ["/duel/invite/", "/player/joinRoom/", "/join/"];

/**
 * Admin gameplay routes — the `(gameplay)` route group, which does not appear
 * in the URL. Everything else under /admin is in scope.
 */
const ADMIN_GAMEPLAY_PREFIXES = ["/admin/game/", "/admin/play/"];

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/** Whether analytics should capture anything at all on this route. */
export function isTrackedPath(pathname: string): boolean {
  const path = normalizePath(pathname);

  if (TRACKED_EXACT.has(path)) return true;
  if (TRACKED_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;

  if (path === "/admin" || path.startsWith("/admin/")) {
    return !ADMIN_GAMEPLAY_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  return false;
}

// Mirrors the current route's scope for `before_send`, which has to make the
// keep/drop call at send time — autocapture and other implicit events fire
// without going through the helpers below.
let pathTracked = false;

export function setPathTracked(tracked: boolean) {
  pathTracked = tracked;
}

// ---------------------------------------------------------------------------
// SDK loading
// ---------------------------------------------------------------------------

let clientPromise: Promise<PostHog | null> | null = null;

/**
 * Downloads and initialises posthog-js on first use. Repeat calls share the
 * one promise, so the SDK is fetched and initialised exactly once.
 */
export function loadAnalytics(): Promise<PostHog | null> {
  if (!isAnalyticsEnabled || typeof window === "undefined") {
    return Promise.resolve(null);
  }

  clientPromise ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      // Pageviews are captured by hand in PostHogProvider so they land only on
      // in-scope routes; the automatic history listener cannot tell them apart.
      capture_pageview: false,
      // Only create person profiles for users we actually identify — anonymous
      // landing-page traffic stays event-only.
      person_profiles: "identified_only",
      // Final scope gate: drops autocapture (and anything else the SDK raises
      // on its own) while the visitor is on an out-of-scope route.
      before_send: (event) => (pathTracked ? event : null),
    });
    return posthog;
  });

  return clientPromise;
}

/** Queues work until the SDK is ready; drops it when out of scope or disabled. */
function withClient(fn: (client: PostHog) => void) {
  if (!pathTracked) return;
  void loadAnalytics().then((client) => {
    if (client) fn(client);
  });
}

export function capture(
  event: AnalyticsEvent,
  properties?: AnalyticsProperties,
) {
  withClient((client) => client.capture(event, properties));
}

export function capturePageview() {
  withClient((client) => client.capture("$pageview"));
}

export function identifyUser(user: {
  id: string;
  email?: string | null;
  name?: string | null;
}) {
  withClient((client) =>
    client.identify(user.id, {
      email: user.email ?? undefined,
      name: user.name ?? undefined,
    }),
  );
}

/** Call on sign-out so the next visitor is not merged into the old profile. */
export function resetAnalytics() {
  withClient((client) => client.reset());
}
