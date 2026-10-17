import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BILLING_ENABLED, PRIVATE_BUZZ } from "@/lib/instance";

/** Pricing and checkout only exist when billing is on. */
const BILLING_ROUTES = ["/pricing", "/billing", "/refund-policy"];

/** Marketing, legal and donation pages of the hosted service. */
const PUBLIC_SITE_ROUTES = [
  "/alternatives",
  "/compare",
  "/use-cases",
  "/open-source-quiz-platform",
  "/self-hosted-quiz",
  "/privacy",
  "/terms",
  "/support",
];

const matches = (pathname: string, routes: string[]) =>
  routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!BILLING_ENABLED && pathname.startsWith("/admin/billing")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (
    (!BILLING_ENABLED && matches(pathname, BILLING_ROUTES)) ||
    (PRIVATE_BUZZ && matches(pathname, PUBLIC_SITE_ROUTES))
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/pricing/:path*",
    "/billing/:path*",
    "/refund-policy/:path*",
    "/admin/billing/:path*",
    "/alternatives/:path*",
    "/compare/:path*",
    "/use-cases/:path*",
    "/open-source-quiz-platform/:path*",
    "/self-hosted-quiz/:path*",
    "/privacy/:path*",
    "/terms/:path*",
    "/support/:path*",
  ],
};
