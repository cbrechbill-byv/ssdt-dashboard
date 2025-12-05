// app/api/dashboard/audit-log/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";

type AuditLogEntry = {
  id: string;
  created_at: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
};

export async function GET(request: Request) {
  try {
    const session = await getDashboardSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // If at some point you add viewer accounts, you could restrict this to admins only.
    // For now we just require a logged-in dashboard user.
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const pageParam = url.searchParams.get("page");

    const limit = Math.min(
      Math.max(parseInt(limitParam || "50", 10) || 50, 1),
      200
    ); // 1–200
    const page = Math.max(parseInt(pageParam || "1", 10) || 1, 1);

    const offset = (page - 1) * limit;

    const supabase = supabaseServer;

    const { data, error, count } = await supabase
      .from("dashboard_audit_log")
      .select(
        "id, created_at, actor_email, actor_role, action, entity, entity_id, details",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[audit-log] Supabase error", error);
      return NextResponse.json(
        { error: "Failed to load audit log" },
        { status: 500 }
      );
    }

    const entries = (data ?? []) as AuditLogEntry[];

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total: count ?? entries.length,
        hasMore: count != null ? offset + limit < count : false,
      },
    });
  } catch (err) {
    console.error("[audit-log] Unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
