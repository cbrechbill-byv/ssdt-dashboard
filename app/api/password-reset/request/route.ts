// app/api/password-reset/request/route.ts
// Path: /api/password-reset/request
// Sends a set-password or reset-password email (same mechanism)
// IMPORTANT: Never instantiate Resend at module-load time.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";

const FROM = process.env.DASHBOARD_FROM_EMAIL || "no-reply@example.com";
const PUBLIC_URL = process.env.DASHBOARD_PUBLIC_URL || "http://localhost:3000";

function okGeneric() {
  // Don’t reveal whether a user exists
  return NextResponse.json({ ok: true });
}

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || !key.trim()) return null;
  try {
    return new Resend(key);
  } catch (e) {
    console.error("[password-reset request] Resend init error", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { email?: string; mode?: "invite" | "reset" }
      | null;

    const email = (body?.email ?? "").trim().toLowerCase();
    const mode = body?.mode ?? "reset";

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    // If admin is sending invites/resets, require session.
    // If it's a normal “forgot password” from /login, no session required.
    if (mode === "invite") {
      const session = await getDashboardSession();
      if (!session || (session.role ?? "admin") !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Find user (but respond generically if not found)
    const { data: user, error: userErr } = await supabaseAdmin
      .from("dashboard_users")
      .select("id, email, role")
      .eq("email", email)
      .maybeSingle();

    if (userErr) {
      console.error("[password-reset request] user lookup error", userErr);
      return okGeneric();
    }
    if (!user?.id) return okGeneric();

    // Create token (1 hour)
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60).toISOString();

    const { error: insertErr } = await supabaseAdmin
      .from("dashboard_password_resets")
      .insert({
        user_id: user.id,
        token,
        expires_at: expires,
        used_at: null,
      });

    if (insertErr) {
      console.error("[password-reset request] token insert error", insertErr);
      return NextResponse.json(
        { error: "Failed to create reset token." },
        { status: 500 }
      );
    }

    const link = `${PUBLIC_URL}/reset-password?token=${token}`;

    const subject =
      mode === "invite"
        ? "Your SSDT Dashboard account — set your password"
        : "Reset your SSDT Dashboard password";

    const headline =
      mode === "invite"
        ? "Welcome to the SSDT Dashboard"
        : "Reset your password";

    const buttonText = mode === "invite" ? "Set password" : "Reset password";

    const html = `
      <div style="font-family: ui-sans-serif, system-ui; line-height: 1.4;">
        <h2>${headline}</h2>
        <p>This link expires in 1 hour.</p>
        <p>
          <a href="${link}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;font-weight:600;">
            ${buttonText}
          </a>
        </p>
        <p style="color:#64748b;font-size:12px;">
          If you didn’t request this, you can ignore this email.
        </p>
      </div>
    `;

    // Send email if configured (Vercel integration should provide RESEND_API_KEY)
    const resend = getResendClient();
    if (!resend) {
      console.error(
        "[password-reset request] Missing RESEND_API_KEY (email not sent)."
      );
      // Still respond OK to avoid leaking account existence
      return okGeneric();
    }

    try {
      await resend.emails.send({
        from: FROM,
        to: email,
        subject,
        html,
      });
    } catch (e) {
      console.error("[password-reset request] email send error", e);
      // Still respond OK (don’t leak)
    }

    // Audit (only if someone is logged in)
    try {
      const session = await getDashboardSession();
      if (session?.email) {
        await supabaseServer.from("dashboard_audit_log").insert({
          actor_email: session.email,
          actor_role: session.role ?? "admin",
          action: "create",
          entity: "dashboard_password_reset",
          entity_id: user.id,
          details: {
            target_email: email,
            mode,
            source: "password-reset-request",
          },
        });
      }
    } catch {}

    return okGeneric();
  } catch (err) {
    console.error("[password-reset request] unexpected error", err);
    // Still do generic OK to avoid leaking
    return okGeneric();
  }
}
