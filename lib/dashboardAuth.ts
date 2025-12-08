// lib/dashboardAuth.ts
// Server-side helpers for dashboard auth/session based on a simple HttpOnly cookie.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export type DashboardSession = {
  email: string;
  role: string; // "admin" | "viewer" | etc.
};

const DASHBOARD_SESSION_COOKIE = "ssdt_dashboard_session";

/**
 * Read the current dashboard session from cookies (server-side).
 * Used in server components, route handlers, and server actions.
 */
export async function getDashboardSession(): Promise<DashboardSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.email !== "string") return null;
    return {
      email: parsed.email,
      role: typeof parsed.role === "string" ? parsed.role : "admin",
    };
  } catch {
    return null;
  }
}

/**
 * Create a NextResponse JSON with a dashboard session cookie attached.
 * Used by /api/login.
 */
export function createSessionResponse(
  session: DashboardSession,
  body: any = { success: true },
  init: ResponseInit = {}
): NextResponse {
  const res = NextResponse.json(body, init);

  res.cookies.set(DASHBOARD_SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return res;
}

/**
 * Clear the dashboard session cookie and return a JSON response.
 * Used by /api/logout and also on failed logins.
 */
export function clearSessionResponse(
  body: any = { success: true },
  init: ResponseInit = {}
): NextResponse {
  const res = NextResponse.json(body, init);

  res.cookies.set(DASHBOARD_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}
