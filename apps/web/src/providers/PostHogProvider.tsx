"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  capturePageview,
  identifyUser,
  isAnalyticsEnabled,
  isTrackedPath,
  resetAnalytics,
  setPathTracked,
} from "@/lib/analytics";

/**
 * Keeps the PostHog person in sync with the Better Auth session: identify on
 * sign-in, reset on sign-out so the next visitor on a shared device is not
 * merged into the previous profile.
 *
 * Only mounted on in-scope routes, so gameplay screens never pay for the
 * session lookup.
 */
function AnalyticsIdentity() {
  const { data: session, isPending } = authClient.useSession();
  const identifiedId = useRef<string | null>(null);

  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;
  const name = session?.user?.name ?? null;

  useEffect(() => {
    if (isPending) return;

    if (userId) {
      if (identifiedId.current !== userId) {
        identifyUser({ id: userId, email, name });
        identifiedId.current = userId;
      }
      return;
    }

    if (identifiedId.current) {
      resetAnalytics();
      identifiedId.current = null;
    }
  }, [isPending, userId, email, name]);

  return null;
}

/**
 * Boots PostHog on the client and captures a pageview per in-scope navigation.
 * Renders nothing of its own — when NEXT_PUBLIC_POSTHOG_KEY is unset, or the
 * visitor is on an out-of-scope route, children pass straight through and no
 * session lookup or SDK download happens.
 */
export default function PostHogProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const tracked = isAnalyticsEnabled && isTrackedPath(pathname);

  // The identity sync reads the Better Auth session, whose store hook cannot
  // run while the root layout is rendered on the server. Mounting it only
  // after hydration keeps it off the SSR/prerender path.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    // Set before capturing: `before_send` reads this to keep or drop events,
    // and capturePageview() itself no-ops while out of scope.
    setPathTracked(tracked);
    if (tracked) capturePageview();
  }, [pathname, tracked]);

  return (
    <>
      {tracked && hydrated && <AnalyticsIdentity />}
      {children}
    </>
  );
}
