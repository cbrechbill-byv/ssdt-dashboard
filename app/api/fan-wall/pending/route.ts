// app/api/fan-wall/pending/route.ts
// Notifies admin when a Fan Wall image is pending approval
// Triggered via Supabase pg_net webhook

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ADMIN_EMAIL = "colin@byvenuecreative.com";
const FAN_WALL_BUCKET = "fan-wall-photos";

function requireEnv(name: string, fallback?: string) {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env: ${name}`);
}

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || !key.trim()) return null;
  try {
    return new Resend(key);
  } catch (e) {
    console.error("[fan-wall pending] Resend init error", e);
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

function readWebhookSecret(req: NextRequest) {
  // Support BOTH names to prevent mismatches between SQL + test scripts.
  // Next headers are case-insensitive.
  return (
    req.headers.get("x-fan-wall-webhook-secret") ||
    req.headers.get("x-webhook-secret") ||
    ""
  ).trim();
}

export async function POST(req: NextRequest) {
  try {
    /* -----------------------------------------------------------
       Security: webhook secret
    ------------------------------------------------------------ */
    const expected = requireEnv("FAN_WALL_WEBHOOK_SECRET");
    const received = readWebhookSecret(req);

    if (!received) {
      console.error("[fan-wall pending] unauthorized webhook call", { hasSecret: false });
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    if (received !== expected) {
      console.error("[fan-wall pending] unauthorized webhook call", { hasSecret: true });
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    /* -----------------------------------------------------------
       Parse body (support both shapes)
    ------------------------------------------------------------ */
    const body = (await req.json().catch(() => null)) as
      | { post_id?: string; record?: { id?: string } }
      | null;

    const postId = (body?.post_id || body?.record?.id || "").trim();
    if (!postId) {
      return NextResponse.json({ ok: false, error: "Missing post_id" }, { status: 400 });
    }

    /* -----------------------------------------------------------
       Fetch fan wall post (only email if pending + visible)
    ------------------------------------------------------------ */
    const { data: post, error } = await supabaseAdmin
      .from("fan_wall_posts")
      .select("id, image_path, caption, created_at, is_approved, is_hidden")
      .eq("id", postId)
      .maybeSingle();

    if (error || !post) {
      console.error("[fan-wall pending] post lookup failed", error);
      return NextResponse.json({ ok: false, error: "post not found" }, { status: 404 });
    }

    if (post.is_hidden || post.is_approved) {
      // Not pending/visible anymore — don’t spam.
      return NextResponse.json({ ok: true, skipped: true });
    }

    /* -----------------------------------------------------------
       Env / URLs
    ------------------------------------------------------------ */
    // Use RESEND_FROM if you set it; fallback to DASHBOARD_FROM_EMAIL; final fallback to your no-reply.
    const FROM =
      process.env.RESEND_FROM?.trim() ||
      process.env.DASHBOARD_FROM_EMAIL?.trim() ||
      "no-reply@ssdtapp.byvenuecreative.com";

    const PUBLIC_URL = requireEnv("DASHBOARD_PUBLIC_URL", "https://ssdtapp.byvenuecreative.com");
    const LOGO_URL = (process.env.DASHBOARD_LOGO_URL || `${PUBLIC_URL}/ssdt-logo.png`).trim();
    const reviewUrl = `${PUBLIC_URL}/fan-wall`;

    const caption = (post.caption || "New fan submission").trim();
    const safeCaption = escapeHtml(caption);

    const imageUrl =
      supabaseAdmin.storage.from(FAN_WALL_BUCKET).getPublicUrl(post.image_path).data.publicUrl;

    /* -----------------------------------------------------------
       Build email (matches password reset template style)
    ------------------------------------------------------------ */
    const subject = "Fan Wall approval needed — Sugarshack Downtown";

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
                  Fan Wall Moderation
                </div>
              </div>
            </div>
          </div>

          <div style="padding:22px 24px;color:#0f172a;line-height:1.45;">
            <h2 style="margin:0 0 8px;font-size:18px;">
              New fan wall image pending approval
            </h2>

            <p style="margin:0 0 14px;color:#334155;font-size:14px;">
              ${safeCaption}
            </p>

            <div style="margin:16px 0;">
              <a href="${escapeHtml(imageUrl)}" target="_blank" rel="noreferrer">
                <img
                  src="${escapeHtml(imageUrl)}"
                  alt="Fan wall submission"
                  style="width:100%;border-radius:12px;border:1px solid #e5e7eb;display:block;"
                />
              </a>
            </div>

            <p style="margin:0 0 18px;">
              <a
                href="${escapeHtml(reviewUrl)}"
                style="display:inline-block;background:#0ea5e9;color:#ffffff;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;"
              >
                Review in Dashboard
              </a>
            </p>

            <p style="margin:0;color:#64748b;font-size:12px;">
              This image is awaiting approval and is not visible in the app yet.
            </p>

            <p style="margin:14px 0 0;color:#94a3b8;font-size:11px;">
              Post ID: ${escapeHtml(post.id)}
            </p>
          </div>

          <div style="padding:14px 24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;">
            Sugarshack Downtown • This message was sent automatically.
          </div>
        </div>
      </div>
    `;

    /* -----------------------------------------------------------
       Send email
    ------------------------------------------------------------ */
    const resend = getResendClient();
    if (!resend) {
      console.error("[fan-wall pending] Missing RESEND_API_KEY (email not sent).");
      return NextResponse.json({ ok: true, warning: "missing resend api key" });
    }

    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[fan-wall pending] unexpected error", err);
    return NextResponse.json({ ok: false, error: err?.message || "server error" }, { status: 500 });
  }
}
