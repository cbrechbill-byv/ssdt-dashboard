import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";
import { clearDashboardSession, getDashboardSession } from "@/lib/dashboardAuth";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  const supabase = supabaseServer;

  // Read current session (if any) before clearing cookie
  let session = null;
  try {
    session = await getDashboardSession();
  } catch (err) {
    console.error("[logout] Error reading dashboard session:", err);
  }

  if (session) {
    try {
      await supabase.from("dashboard_audit_log").insert({
        actor_email: session.email ?? null,
        actor_role: session.role ?? null,
        action: "logout",
        entity: "dashboard_session",
        entity_id: null,
        details: { source: "api/logout" },
      });
    } catch (logErr) {
      console.error("[logout] Failed to write logout audit log:", logErr);
    }
  }

  clearDashboardSession(response);
  return response;
}
