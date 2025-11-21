import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const isAdmin = req.cookies.get("ssdt_admin")?.value === "1";
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  if (!isAdmin && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/fan-wall/:path*"],
};
