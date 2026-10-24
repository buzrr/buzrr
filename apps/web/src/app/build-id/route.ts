import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * This deployment's build id (compiled in, see the Dockerfile's BUILD_ID).
 * Open pages compare it with their own and reload when a new version is out.
 */
export function GET() {
  return NextResponse.json(
    { id: process.env.NEXT_PUBLIC_BUILD_ID ?? "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
