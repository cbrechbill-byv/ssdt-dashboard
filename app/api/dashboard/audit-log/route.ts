// app/api/dashboard/audit-log/route.ts

import { NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type Body = {
  action: "create" | "update" | "delete";
  entity: string;
  entityId?: string;
  details?: any;
};

export async function POST(req: Request) {
  try {
    const session = getDashboardSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json()) as Body;

    if (!body.action || !body.entity) {
      return NextResponse.json(
        { error: "action and entity are required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer;

    const { error } = await supabase.from("dashboard_audit_log").insert({
      actor_email: session.email,
      actor_role: session.role,
      action: body.action,
      entity: body.entity,
      entity_id: body.entityId ?? null,
      details: body.details ?? null,
    });

    if (error) {
      console.error("[audit-log] insert error:", error);
      return NextResponse.json(
        { error: "Failed to write audit log" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("[audit-log] exception:", err);
    return NextResponse.json(
      { error: "Unexpected error writing audit log" },
      { status: 500 }
    );
  }
}
