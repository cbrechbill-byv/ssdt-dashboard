import { NextResponse } from "next/server";
import {
  clearDashboardSession,
  getDashboardSession,
} from "@/lib/dashboardAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST() {
  // Read session BEFORE clearing cookie so we know who is logging out
  const session = await getDashboardSession();
  const supabase = supabaseServer;

  // Create the response we’ll send back
  const response = NextResponse.json({ ok: true });

  // Clear the cookie on this response
  clearDashboardSession(response);

  // Log logout if we know who it was
  if (session?.email) {
    try {
      await supabase.from("dashboard_audit_log").insert({
        actor_email: session.email,
        actor_role: session.role ?? "unknown",
        action: "logout",
        entity: "dashboard_session",
        entity_id: null,
        details: {
          source: "dashboard-logout-route",
        },
      });
    } catch (err) {
      console.error("[Dashboard logout] error writing audit log", err);
    }
  }

  return response;
}
