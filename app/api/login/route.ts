// app/api/login/route.ts

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

import { supabaseServer } from "@/lib/supabaseServer";
import {
  createSessionResponse,
  clearSessionResponse,
  DashboardSession,
} from "@/lib/dashboardAuth";

/**
 * POST /api/login
 * Body: { email, password } (JSON or form-encoded)
 */
export async function POST(req: NextRequest) {
  let email = "";
  let password = "";

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = await req.json();
      email = String(body.email ?? "").trim().toLowerCase();
      password = String(body.password ?? "");
    } else {
      const form = await req.formData();
      email = String(form.get("email") ?? "").trim().toLowerCase();
      password = String(form.get("password") ?? "");
    }
  } catch {
    return clearSessionResponse(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!email || !password) {
    return clearSessionResponse(
      { success: false, error: "Email and password are required" },
      { status: 400 }
    );
  }

  const supabase = supabaseServer;

  // Look up dashboard-only user
  const { data: user, error } = await supabase
    .from("dashboard_users")
    .select("id, email, role, password_hash")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("[login] dashboard_users lookup error", error);
    return clearSessionResponse(
      { success: false, error: "Unexpected error" },
      { status: 500 }
    );
  }

  if (!user || !user.password_hash) {
    // Don't leak whether the email exists
    return clearSessionResponse(
      { success: false, error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    return clearSessionResponse(
      { success: false, error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const session: DashboardSession = {
    email: user.email,
    role: user.role ?? "admin",
  };

  // Log login to dashboard_audit_log
  const { error: auditError } = await supabase
    .from("dashboard_audit_log")
    .insert({
      actor_email: user.email,
      actor_role: user.role ?? "admin",
      action: "login",
      entity: "dashboard_session",
      entity_id: user.id,
      details: {
        source: "dashboard-login",
      },
    });

  if (auditError) {
    console.error("[login] audit log error", auditError);
  }

  // Create session cookie + JSON response
  return createSessionResponse(session, { success: true });
}
