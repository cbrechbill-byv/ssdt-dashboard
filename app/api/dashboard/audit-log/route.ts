import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ✅ getDashboardSession returns Promise<DashboardSession | null>
    const session = await getDashboardSession();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const supabase = supabaseServer;

    const { error } = await supabase.from("dashboard_audit_log").insert({
      actor_email: session.email ?? null,
      actor_role: session.role ?? null,
      action: body.action,
      entity: body.entity,
      entity_id: body.entityId ?? null,
      details: body.details ?? null,
    });

    if (error) {
      console.error("[audit-log] insert error", error);
      return NextResponse.json(
        { error: "Failed to write audit log" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[audit-log] unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
