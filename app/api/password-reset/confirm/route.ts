// app/api/password-reset/confirm/route.ts
// Path: /api/password-reset/confirm
// Consumes token, sets bcrypt password_hash on dashboard_users

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token?: string; password?: string } | null;
  const token = (body?.token ?? "").trim();
  const password = body?.password ?? "";

  if (!token || !password) {
    return NextResponse.json({ error: "Token and password are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { data: resetRow, error: resetErr } = await supabaseAdmin
    .from("dashboard_password_resets")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (resetErr) {
    console.error("[password-reset confirm] lookup error", resetErr);
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 400 });
  }

  if (!resetRow?.id || !resetRow.user_id) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 400 });
  }

  if (resetRow.used_at) {
    return NextResponse.json({ error: "This reset link was already used." }, { status: 400 });
  }

  const exp = new Date(resetRow.expires_at);
  if (Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
    return NextResponse.json({ error: "This reset link has expired." }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { error: updUserErr } = await supabaseAdmin
    .from("dashboard_users")
    .update({ password_hash, updated_at: new Date().toISOString() })
    .eq("id", resetRow.user_id);

  if (updUserErr) {
    console.error("[password-reset confirm] update user error", updUserErr);
    return NextResponse.json({ error: "Failed to set password." }, { status: 500 });
  }

  const { error: markErr } = await supabaseAdmin
    .from("dashboard_password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("id", resetRow.id);

  if (markErr) {
    console.error("[password-reset confirm] mark used error", markErr);
  }

  return NextResponse.json({ ok: true });
}
