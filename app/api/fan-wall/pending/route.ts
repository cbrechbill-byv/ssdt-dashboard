import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const TO_EMAIL = "colin@byvenuecreative.com";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-fanwall-secret");
    const expected = mustEnv("FAN_WALL_WEBHOOK_SECRET");
    if (!secret || secret !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const postId = String(body?.post_id || "");
    const imagePath = String(body?.image_path || "");
    const caption = String(body?.caption || "");
    const createdAt = String(body?.created_at || "");

    if (!postId || !imagePath) {
      return NextResponse.json({ ok: false, error: "missing post_id or image_path" }, { status: 400 });
    }

    // Supabase (service role) to generate a signed URL for the image preview
    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const bucket = process.env.NEXT_PUBLIC_FAN_WALL_BUCKET || "fan-wall-photos";

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Signed URL keeps things private even if the bucket is not public
    const { data: signed, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(imagePath, 60 * 60); // 1 hour

    const imageUrl = signed?.signedUrl || "";

    // Build links back to your dashboard moderation page
    const dashboardBase = process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://YOUR-VERCEL-DOMAIN.com";
    const reviewUrl = `${dashboardBase}/fan-wall`;

    const resend = new Resend(mustEnv("RESEND_API_KEY"));

    const subject = `Pending Fan Wall Post (${postId.slice(0, 8)})`;

    const safeCaption = caption?.trim() ? caption.trim() : "Untitled Fan Wall post";

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system; line-height:1.4;">
        <h2 style="margin:0 0 8px 0;">New Fan Wall post pending approval</h2>
        <p style="margin:0 0 12px 0;"><b>${safeCaption}</b></p>
        <p style="margin:0 0 12px 0; color:#555;">
          Created: ${createdAt || "(unknown)"}<br/>
          Post ID: ${postId}
        </p>

        ${
          imageUrl
            ? `<a href="${imageUrl}" target="_blank" rel="noreferrer">
                 <img src="${imageUrl}" alt="Fan Wall image" style="max-width:420px; border-radius:16px; border:1px solid #eee;" />
               </a>`
            : `<p style="color:#b00;">(Could not generate image preview URL${signErr ? `: ${String(signErr.message || signErr)}` : ""})</p>`
        }

        <div style="margin-top:16px;">
          <a href="${reviewUrl}" target="_blank" rel="noreferrer"
             style="display:inline-block; background:#0ea5e9; color:white; padding:10px 14px; border-radius:999px; text-decoration:none; font-weight:600;">
            Review in Dashboard
          </a>
        </div>
      </div>
    `;

    await resend.emails.send({
      from: mustEnv("RESEND_FROM"), // e.g. "SSDT <no-reply@byvenuecreative.com>"
      to: [TO_EMAIL],
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[fan-wall pending notify] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "server error" }, { status: 500 });
  }
}
