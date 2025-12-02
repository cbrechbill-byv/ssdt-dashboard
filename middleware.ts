import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// TEMP: disable all auth / redirects in middleware so we can use the dashboard
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// Optionally, you can keep a matcher if you had one before, but it's not required.
// export const config = {
//   matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
// };
