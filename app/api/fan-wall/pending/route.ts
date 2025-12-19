// app/api/fan-wall/pending/route.ts
// Notifies admin when a Fan Wall image is pending approval
// Triggered via Supabase pg_net webhook

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const FROM =
  process.env.DASHBOARD_FROM_EMAIL ||
  "no-reply@ssdtapp.byvenuecreative.com";

const PUBLIC_URL =
  process.env.DASHBOARD_PUBLIC_URL ||
  "https://ssdtapp.byvenuecreative.com";

const LOGO_URL =
  process.env.DASHBOARD_LOGO_URL ||
  `${PUBLIC_URL}/ssdt-logo.png`;

const FAN_WALL_WEBHOOK_SECRET =
  process.env.FAN_WALL_WEBHOOK_SECRET;

const ADMIN_EMAIL = "colin@byvenuecreative.com";
const FAN_WALL_BUCKET = "fan-wall-photos";

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

export async function POST(req: NextRequest) {
  try {
    /* -----------------------------------------------------------
       Security: webhook secret
    ------------------------------------------------------------ */
    const secret = req.headers.get("x-webhook-secret");
    if (!FAN_WALL_WEBHOOK_SECRET || secret !== FAN_WALL_WEBHOOK_SECRET) {
      console.error("[fan-wall pending] unauthorized webhook call", {
        hasSecret: !!secret,
      });
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    /* -----------------------------------------------------------
       Parse body
    ------------------------------------------------------------ */
    const body = (await req.json().catch(() => null)) as
      | { post_id?: string }
      | null;

    const postId = body?.post_id;
    if (!postId) {
      return NextResponse.json(
        { ok: false, error: "Missing post_id" },
        { status: 400 }
      );
    }

    /* -----------------------------------------------------------
       Fetch fan wall post
    ------------------------------------------------------------ */
    const { data: post, error } = await supabaseAdmin
      .from("fan_wall_posts")
      .select("id, image_path, caption, created_at")
      .eq("id", postId)
      .maybeSingle();

    if (error || !post) {
      console.error("[fan-wall pending] post lookup failed", error);
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const caption = post.caption || "New fan submission";
    const safeCaption = escapeHtml(caption);

    const imageUrl = supabaseAdmin.storage
      .from(FAN_WALL_BUCKET)
      .getPublicUrl(post.image_path).data.publicUrl;

    const reviewUrl = `${PUBLIC_URL}/fan-wall`;

    /* -----------------------------------------------------------
       Build email (MATCHES PASSWORD RESET TEMPLATE)
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
              <a href="${imageUrl}" target="_blank" rel="noreferrer">
                <img
                  src="${imageUrl}"
                  alt="Fan wall submission"
                  style="width:100%;border-radius:12px;border:1px solid #e5e7eb;"
                />
              </a>
            </div>

            <p style="margin:0 0 18px;">
              <a
                href="${reviewUrl}"
                style="display:inline-block;background:#0ea5e9;color:#ffffff;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;"
              >
                Review in Dashboard
              </a>
            </p>

            <p style="margin:0;color:#64748b;font-size:12px;">
              This image is awaiting approval and is not visible in the app yet.
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
      console.error("[fan-wall pending] Missing RESEND_API_KEY");
      return NextResponse.json({ ok: true });
    }

    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[fan-wall pending] unexpected error", err);
    return NextResponse.json({ ok: true });
  }
}
