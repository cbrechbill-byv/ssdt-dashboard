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

// Optional: override if you want a separate hosted image URL
const LOGO_URL =
  process.env.DASHBOARD_LOGO_URL || `${PUBLIC_URL}/ssdt-logo.png`;

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

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    const safeLink = escapeHtml(link);

    const subject =
      mode === "invite"
        ? "Set your password — Sugarshack Downtown Staff Dashboard"
        : "Password reset — Sugarshack Downtown Staff Dashboard";

    const headline =
      mode === "invite"
        ? "Set your password"
        : "Reset your password";

    const subhead =
      mode === "invite"
        ? "You’ve been invited to access the Sugarshack Downtown Staff Dashboard."
        : "A password reset was requested for the Sugarshack Downtown Staff Dashboard.";

    const buttonText = mode === "invite" ? "Set password" : "Reset password";

    const html = `
      <div style="background:#f1f5f9;padding:24px 0;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;">
          
          <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;background:#0f172a;">
            <div style="display:flex;align-items:center;gap:12px;">
              <img src="${escapeHtml(LOGO_URL)}" alt="Sugarshack Downtown" style="height:40px;width:auto;display:block;" />
              <div>
                <div style="color:#ffffff;font-weight:700;font-size:14px;letter-spacing:0.02em;">
                  Sugarshack Downtown
                </div>
                <div style="color:#cbd5e1;font-size:12px;">
                  Staff Dashboard
                </div>
              </div>
            </div>
          </div>

          <div style="padding:22px 24px;color:#0f172a;line-height:1.45;">
            <h2 style="margin:0 0 8px;font-size:18px;">${headline}</h2>
            <p style="margin:0 0 14px;color:#334155;font-size:14px;">${subhead}</p>

            <p style="margin:0 0 16px;color:#334155;font-size:14px;">
              This secure link expires in <b>1 hour</b>.
            </p>

            <p style="margin:0 0 18px;">
              <a href="${safeLink}" style="display:inline-block;background:#0ea5e9;color:#ffffff;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;">
                ${buttonText}
              </a>
            </p>

            <p style="margin:0 0 6px;color:#64748b;font-size:12px;">
              If the button doesn’t work, copy and paste this link:
            </p>
            <p style="margin:0 0 14px;color:#0ea5e9;font-size:12px;word-break:break-all;">
              ${safeLink}
            </p>

            <p style="margin:0;color:#64748b;font-size:12px;">
              If you didn’t request this, you can ignore this email.
            </p>
          </div>

          <div style="padding:14px 24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;">
            Sugarshack Downtown • This message was sent from an unmonitored address.
          </div>
        </div>
      </div>
    `;

    // Send email if configured (Vercel integration should provide RESEND_API_KEY)
    const resend = getResendClient();
    if (!resend) {
      console.error(
        "[password-reset request] Missing RESEND_API_KEY (email not sent)."
      );
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
    return okGeneric();
  }
}
