"use server";

import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";

/**
 * Server-side audit logger — safe for Server Actions.
 */
export async function logDashboardEventServer({
  action,
  entity,
  entityId,
  details,
}: {
  action: "create" | "update" | "delete";
  entity: string;
  entityId?: string | null;
  details?: any;
}) {
  try {
    const session = await getDashboardSession();

    const supabase = supabaseServer;

    await supabase.from("dashboard_audit_log").insert({
      actor_email: session?.email ?? null,
      actor_role: session?.role ?? null,
      action,
      entity,
      entity_id: entityId ?? null,
      details: details ?? {},
    });
  } catch (err) {
    console.error("[audit-log] Failed to write audit event:", err);
  }
}
