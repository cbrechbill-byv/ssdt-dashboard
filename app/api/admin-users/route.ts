// app/api/admin-users/route.ts
// Path: /api/admin-users
// Admin-only CRUD for dashboard_users (cookie session check)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";
import bcrypt from "bcryptjs";

function forbid() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

async function requireAdmin() {
  const session = await getDashboardSession();
  if (!session) return null;
  if ((session.role ?? "admin") !== "admin") return null;
  return session;
}

function randomTempPassword() {
  // simple random password to satisfy NOT NULL password_hash if your schema requires it
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let out = "";
  for (let i = 0; i < 20; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return forbid();

  const { data, error } = await supabaseAdmin
    .from("dashboard_users")
    // ✅ do NOT select updated_at (your table doesn't have it)
    .select("id, email, role, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[admin-users] GET error", error);
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return forbid();

  const body = (await req.json().catch(() => null)) as
    | { email?: string; role?: string }
    | null;

  const email = (body?.email ?? "").trim().toLowerCase();
  const role = (body?.role ?? "admin").trim();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  // prevent duplicates
  const { data: existing } = await supabaseAdmin
    .from("dashboard_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing?.id) {
    return NextResponse.json(
      { error: "That email already exists in dashboard users." },
      { status: 409 }
    );
  }

  // ✅ safe insert regardless of schema: create a temp password hash
  const tempPassword = randomTempPassword();
  const password_hash = await bcrypt.hash(tempPassword, 10);

  const { data, error } = await supabaseAdmin
    .from("dashboard_users")
    .insert({
      email,
      role,
      password_hash,
    })
    .select("id, email, role, created_at")
    .single();

  if (error) {
    console.error("[admin-users] POST error", error);
    return NextResponse.json(
      { error: error.message || "Failed to create user." },
      { status: 500 }
    );
  }

  try {
    await supabaseServer.from("dashboard_audit_log").insert({
      actor_email: session.email,
      actor_role: session.role ?? "admin",
      action: "create",
      entity: "dashboard_users",
      entity_id: data.id,
      details: { email, role, source: "admin-users" },
    });
  } catch {}

  return NextResponse.json({ ok: true, user: data });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return forbid();

  const body = (await req.json().catch(() => null)) as
    | { id?: string; email?: string; role?: string }
    | null;

  const id = (body?.id ?? "").trim();
  const email = (body?.email ?? "").trim().toLowerCase();
  const role = (body?.role ?? "admin").trim();

  if (!id || !email) {
    return NextResponse.json({ error: "id and email are required." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("dashboard_users")
    .update({ email, role })
    .eq("id", id);

  if (error) {
    console.error("[admin-users] PATCH error", error);
    return NextResponse.json(
      { error: error.message || "Failed to update user." },
      { status: 500 }
    );
  }

  try {
    await supabaseServer.from("dashboard_audit_log").insert({
      actor_email: session.email,
      actor_role: session.role ?? "admin",
      action: "update",
      entity: "dashboard_users",
      entity_id: id,
      details: { email, role, source: "admin-users" },
    });
  } catch {}

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return forbid();

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id = (body?.id ?? "").trim();

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("dashboard_users").delete().eq("id", id);

  if (error) {
    console.error("[admin-users] DELETE error", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete user." },
      { status: 500 }
    );
  }

  try {
    await supabaseServer.from("dashboard_audit_log").insert({
      actor_email: session.email,
      actor_role: session.role ?? "admin",
      action: "delete",
      entity: "dashboard_users",
      entity_id: id,
      details: { source: "admin-users" },
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
