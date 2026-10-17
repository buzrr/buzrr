import { NextResponse } from "next/server";
import { getAuthMethods } from "@/lib/auth-methods";

// Read from runtime env (a self-hosted image is built once and configured per
// install), so this can't be prerendered. The login page itself is static and
// asks here instead; the CDN caching keeps that from being a function call per
// visit. Env changes on Vercel need a redeploy, which purges this cache.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getAuthMethods(), {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
