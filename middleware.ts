import { NextRequest, NextResponse } from "next/server";

const USER = process.env.DASHBOARD_USER;
const PASS = process.env.DASHBOARD_PASS;

function parseBasicAuth(header: string | null) {
  if (!header) return null;

  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return null;

  const decoded = atob(encoded);
  const index = decoded.indexOf(":");
  if (index === -1) return null;

  const user = decoded.slice(0, index);
  const pass = decoded.slice(index + 1);

  return { user, pass };
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const creds = parseBasicAuth(req.headers.get("authorization"));

  if (creds && creds.user === USER && creds.pass === PASS) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Sugarshack Dashboard"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
