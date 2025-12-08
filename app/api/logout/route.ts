// app/api/logout/route.ts

import { NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";
import {
  clearSessionResponse,
  getDashboardSession,
} from "@/lib/dashboardAuth";

/**
 * POST /api/logout
 * Clears the dashboard session cookie and logs a logout action.
 */
export async function POST(_req: NextRequest) {
  const session = await getDashboardSession();
  const supabase = supabaseServer;

  if (session?.email) {
    const { error } = await supabase.from("dashboard_audit_log").insert({
      actor_email: session.email,
      actor_role: session.role ?? "unknown",
      action: "logout",
      entity: "dashboard_session",
      entity_id: null,
      details: {
        source: "dashboard-logout",
      },
    });

    if (error) {
      console.error("[logout] audit log error", error);
    }
  }

  return clearSessionResponse({ success: true });
}
