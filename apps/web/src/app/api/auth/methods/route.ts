import { NextResponse } from "next/server";
import { getAuthMethods } from "@/lib/auth-methods";

// Read from runtime env (a self-hosted image is built once and configured per
// install), so this can't be prerendered. The login page itself is static and
// asks here instead; a short shared-cache window keeps that from being a
// function call per visit, while a self-hosted install behind a caching proxy
// picks up changed sign-in settings within minutes.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getAuthMethods(), {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
