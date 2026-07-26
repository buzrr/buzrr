import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Server-side gate for the account-only duel routes.
 *
 * This lives in the pages rather than `app/duel/layout.tsx` because App Router
 * layouts get no pathname, so a layout-level gate can only redirect to one
 * hardcoded destination — which would drop deep links like an invite URL on the
 * floor after login.
 */
export async function requireDuelSession(callbackURL: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackURL=${encodeURIComponent(callbackURL)}`);
  }
  return session;
}
