// app/api/admin-users/reset-password/route.ts
// Path: /api/admin-users/reset-password
import { NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isAdminSession(session: any) {
  const role = (session?.role ?? session?.user?.role ?? "").toString().toLowerCase();
  return role.includes("admin") || role === "owner";
}

export async function POST(req: Request) {
  const session = await getDashboardSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminSession(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const email = (body?.email ?? "").toString().trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // This sends an email via Supabase Auth
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email);

  if (error) {
    console.error("[admin-users] reset-password error", error);
    return NextResponse.json({ error: "Failed to send password reset" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
