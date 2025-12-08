// lib/dashboardAuth.ts
// Simple cookie-based dashboard session helpers.

import { cookies } from "next/headers";

export type DashboardSession = {
  email: string;
  role: string;
};

const DASHBOARD_SESSION_COOKIE = "ssdt_dashboard_session";

/**
 * Read the current dashboard session from cookies (server-side).
 */
export async function getDashboardSession(): Promise<DashboardSession | null> {
  // Your environment typed cookies() as async earlier, so keep the await:
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
 * Attach a dashboard session cookie to an existing NextResponse.
 * Used in /api/login after successful auth.
 */
export function createDashboardSession(
  session: DashboardSession,
  res: any
): void {
  res.cookies.set(DASHBOARD_SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
}

/**
 * Clear the dashboard session cookie on the given response.
 * Used in /api/logout.
 */
export function clearDashboardSession(res: any): void {
  res.cookies.set(DASHBOARD_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
