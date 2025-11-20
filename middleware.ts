import { NextRequest, NextResponse } from "next/server";

// TEMP: hard-coded dashboard credentials.
// Once we confirm this works, we can move these back to environment variables.
const USER = "admin";
const PASS = "MrBanks143!!!";

function parseBasicAuth(header: string | null) {
  if (!header) return null;

  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return null;

  // atob is available in the Edge runtime; Buffer is not.
  const decoded = atob(encoded);
  const index = decoded.indexOf(":");
  if (index === -1) return null;

  const user = decoded.slice(0, index);
  const pass = decoded.slice(index + 1);

  return { user, pass };
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let Next internals and favicon through without auth
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const creds = parseBasicAuth(req.headers.get("authorization"));

  if (creds && creds.user === USER && creds.pass === PASS) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Sugarshack Dashboard"'
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
