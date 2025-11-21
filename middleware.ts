import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1) Allow static assets & Next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/ssdt-logo") ||
    pathname.startsWith("/api/login")
  ) {
    return NextResponse.next();
  }

  // 2) Allow login page without cookie
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // 3) For everything else, require auth cookie
  const cookie = request.cookies.get("ssdt_admin");

  if (!cookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname || "/dashboard");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Apply to all routes; static assets are skipped in code above
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
