import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function GET() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const subject = session?.user?.id;

  if (!subject) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await new SignJWT({
    sub: subject,
    email: session.user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token });
}
