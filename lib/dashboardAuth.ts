import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export type DashboardRole = "admin" | "viewer";

export type DashboardSession = {
  id: string;
  email: string;
  role: DashboardRole;
  iat: number;
};

export const SESSION_COOKIE_NAME = "ssdt_dashboard_session";

/**
 * Create / update the dashboard session cookie on a response.
 */
export async function createDashboardSession(opts: {
  email: string;
  role: DashboardRole;
  response: NextResponse;
}) {
  const { email, role, response } = opts;

  const session: DashboardSession = {
    // Use email as a stable identifier for now (email is unique in dashboard_users)
    id: email,
    email,
    role,
    iat: Date.now(),
  };

  const json = JSON.stringify(session);
  const encoded = Buffer.from(json, "utf8").toString("base64");

  // HttpOnly & Secure cookie for dashboard auth
  response.cookies.set(SESSION_COOKIE_NAME, encoded, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}

/**
 * Read the dashboard session from the HttpOnly cookie.
 * In modern Next route handlers, cookies() is async.
 */
export async function getDashboardSession(): Promise<DashboardSession | null> {
  try {
    const cookieStore = await cookies(); // <- IMPORTANT: await here
    const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!raw) return null;

    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as DashboardSession;

    if (!parsed?.id || !parsed?.email || !parsed?.role) {
      return null;
    }

    return parsed;
  } catch (e) {
    console.error("[dashboardAuth] failed to read session cookie:", e);
    return null;
  }
}
