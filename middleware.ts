// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * SSDT Dashboard Middleware
 *
 * GOAL:
 * - Keep TV + Check-In rollout routes PUBLIC and never redirected:
 *   /tv, /api/tv, /checkin, /c
 *   /.well-known/apple-app-site-association, /apple-app-site-association
 *
 * - Everything else can be protected later when auth middleware is re-enabled.
 *
 * CURRENT STATE:
 * - Auth is intentionally disabled (returns NextResponse.next()).
 * - This file is the "safe scaffold" so when you re-enable auth,
 *   you won’t accidentally break TV screens or QR flows.
 */

const PUBLIC_PREFIXES = [
  "/tv",
  "/api/tv",
  "/checkin",
  "/c",
  "/.well-known/apple-app-site-association",
  "/apple-app-site-association",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public rollout routes
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  /**
   * TEMP: Auth disabled.
   * When you re-enable auth later, put it HERE, but DO NOT touch the public paths above.
   *
   * Example (future):
   * - If not logged in => redirect("/login")
   * - Else NextResponse.next()
   */
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
