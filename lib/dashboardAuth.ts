import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export type DashboardSession = {
  email: string;
  role: "admin" | "viewer" | string;
};

const SESSION_COOKIE_NAME = "ssdt_dashboard_session";

/**
 * Server-side helper to read the dashboard session from cookies.
 * Works with Next.js 16 where `cookies()` is async.
 */
export async function getDashboardSession(): Promise<DashboardSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.email || !parsed?.role) return null;
    return {
      email: parsed.email,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

/**
 * Attach a JSON session cookie to an existing response.
 */
export function createDashboardSession(
  session: DashboardSession,
  response: NextResponse
) {
  response.cookies.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Clear the dashboard session cookie.
 */
export function clearDashboardSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
