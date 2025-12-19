// app/api/fan-wall/pending/route.ts
// POST webhook endpoint: called when a new fan_wall_posts row is inserted (pending moderation)
//
// Expects:
// - FAN_WALL_WEBHOOK_SECRET (env)
// - RESEND_API_KEY (env)
// - RESEND_FROM (env) e.g. "SSDT <no-reply@ssdtapp.byvenuecreative.com>"
// - SUPABASE_URL (env)
// - SUPABASE_SERVICE_ROLE_KEY (env)   (recommended, for signed image URLs if bucket is private)
//
// Notes:
// - Sends to colin@byvenuecreative.com only (as requested)
// - Moderation page: https://ssdtapp.byvenuecreative.com/fan-wall

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const TO_EMAIL = "colin@byvenuecreative.com";
const MODERATION_URL = "https://ssdtapp.byvenuecreative.com/fan-wall";
const FAN_WALL_BUCKET = "fan-wall-photos";

function mustEnv(key: string) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

function getSecretFromHeaders(req: NextRequest) {
  // Accept either header name to avoid config mismatches
  return (
    req.headers.get("x-fanwall-secret") ||
    req.headers.get("x-fan-wall-webhook-secret") ||
    ""
  );
}

export async function POST(req: NextRequest) {
  try {
    const secret = getSecretFromHeaders(req);
    const expected = mustEnv("FAN_WALL_WEBHOOK_SECRET");

    if (!secret || secret !== expected) {
      console.warn("[fan-wall pending] unauthorized webhook call");
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    // Support either shape:
    // 1) { post_id, image_path, caption, created_at }
    // 2) Supabase DB webhook style with { record: { id, image_path, ... } }
    const record = body?.record ?? body ?? {};
    const postId = String(record?.id ?? record?.post_id ?? "");
    if (!postId) {
      return NextResponse.json({ ok: false, error: "missing post id" }, { status: 400 });
    }

    const supabaseUrl = mustEnv("SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch the post (source of truth)
    const { data: post, error: postErr } = await supabase
      .from("fan_wall_posts")
      .select("id, image_path, caption, created_at, is_approved, is_hidden")
      .eq("id", postId)
      .single();

    if (postErr || !post) {
      console.error("[fan-wall pending] failed to load post", postErr);
      return NextResponse.json({ ok: false, error: "post not found" }, { status: 404 });
    }

    // Only notify for pending + visible
    if (post.is_approved || post.is_hidden) {
      console.log("[fan-wall pending] skipping (already reviewed/hidden)", post.id);
      return NextResponse.json({ ok: true, skipped: true });
    }

    const imagePath = String(post.image_path || "");
    if (!imagePath) {
      return NextResponse.json({ ok: false, error: "missing image_path" }, { status: 400 });
    }

    // Try public URL first (works if bucket is public)
    let imageUrl: string | null = null;
    {
      const { data } = supabase.storage.from(FAN_WALL_BUCKET).getPublicUrl(imagePath);
      imageUrl = data?.publicUrl ?? null;
    }

    // If bucket is private, publicUrl won't load for email recipients.
    // Generate a signed URL (7 days).
    if (!imageUrl) {
      const { data: signed, error: signErr } = await supabase.storage
        .from(FAN_WALL_BUCKET)
        .createSignedUrl(imagePath, 60 * 60 * 24 * 7);

      if (signErr) {
        console.error("[fan-wall pending] signed url failed", signErr);
      } else {
        imageUrl = signed?.signedUrl ?? null;
      }
    }

    const subject = "SSDT Fan Wall: New post pending approval";

    const caption = (post.caption ?? "").toString().trim();
    const createdAt = post.created_at ? new Date(post.created_at).toLocaleString("en-US") : "";

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
        <h2 style="margin:0 0 12px 0;">New Fan Wall post pending approval</h2>
        <p style="margin:0 0 8px 0;">
          <strong>Post ID:</strong> ${post.id}<br/>
          ${createdAt ? `<strong>Created:</strong> ${createdAt}<br/>` : ""}
          ${caption ? `<strong>Caption:</strong> ${escapeHtml(caption)}<br/>` : ""}
        </p>

        ${
          imageUrl
            ? `<p style="margin:12px 0;">
                 <img src="${imageUrl}" alt="Fan wall post" style="max-width:520px; width:100%; border-radius:12px; border:1px solid #e5e7eb;" />
               </p>`
            : `<p style="margin:12px 0; color:#b91c1c;">
                 Could not generate an image URL for preview. Please review in dashboard.
               </p>`
        }

        <p style="margin:16px 0 0 0;">
          <a href="${MODERATION_URL}" style="display:inline-block; background:#0ea5e9; color:white; padding:10px 14px; border-radius:10px; text-decoration:none;">
            Review pending posts
          </a>
        </p>

        <p style="margin:16px 0 0 0; color:#6b7280; font-size:12px;">
          You’re receiving this because you’re the admin moderation inbox.
        </p>
      </div>
    `;

    // IMPORTANT: instantiate Resend inside handler so missing env doesn't crash at module load
    const resend = new Resend(mustEnv("RESEND_API_KEY"));

    const sendRes = await resend.emails.send({
      from: mustEnv("RESEND_FROM"),
      to: [TO_EMAIL],
      subject,
      html,
    });

    console.log("[fan-wall pending] email sent", { postId: post.id, sendRes });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[fan-wall pending] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "server error" }, { status: 500 });
  }
}

function escapeHtml(str: string) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
