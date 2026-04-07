import { type NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getToken } from "next-auth/jwt";
import { auth } from "@/utils/auth";

export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const session = await auth();
  const sessionUserId = session?.user?.id;

  // With Prisma adapter, NextAuth defaults to DB sessions, so `getToken` may be
  // empty. Keep `getToken` as a fallback for JWT-session setups.
  const tokenData = sessionUserId
    ? null
    : await getToken({
        req,
        secret,
      });
  const subject = sessionUserId ?? tokenData?.sub;

  if (!subject) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await new SignJWT({
    sub: subject,
    email: typeof tokenData?.email === "string" ? tokenData.email : undefined,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token });
}
