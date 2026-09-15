import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Server-side gate for the billing pages. Per page (like `requireDuelSession`)
 * so the login redirect returns the user to the exact billing step they were on.
 */
export async function requireBillingSession(callbackURL: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackURL=${encodeURIComponent(callbackURL)}`);
  }
  return session;
}
