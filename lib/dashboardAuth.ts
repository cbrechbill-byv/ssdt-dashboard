import { cookies } from "next/headers";

export type DashboardRole = "admin" | "viewer";

export type DashboardSession = {
  id: string;
  email: string;
  role: DashboardRole;
  iat: number;
};

export const SESSION_COOKIE_NAME = "ssdt_dashboard_session";

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
