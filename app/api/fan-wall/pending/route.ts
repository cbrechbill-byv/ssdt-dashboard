// app/api/fan-wall/pending/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

const ADMIN_EMAIL = "colin@byvenuecreative.com";
const FROM_EMAIL = "no-reply@ssdtapp.byvenuecreative.com";
const MODERATION_URL = "https://ssdtapp.byvenuecreative.com/fan-wall";
const BUCKET = "fan-wall-photos";

export async function POST(req: NextRequest) {
  try {
    // Auth
    const expected = mustEnv("FAN_WALL_WEBHOOK_SECRET");
    const secret =
      req.headers.get("x-fan-wall-webhook-secret") ??
      req.headers.get("x-fanwall-secret") ??
      "";

    if (!secret || secret !== expected) {
      console.error("[fan-wall pending] unauthorized webhook call", {
        hasSecret: !!secret,
      });
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // Body
    const body = await req.json().catch(() => ({} as any));
    const postId = String(body?.record?.id || body?.post_id || "").trim();
    if (!postId) {
      return NextResponse.json(
        { ok: false, error: "missing post id (expected body.record.id or body.post_id)" },
        { status: 400 }
      );
    }

    // Supabase admin
    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    const { data: post, error: postErr } = await supabase
      .from("fan_wall_posts")
      .select("id,image_path,caption,created_at,is_approved,is_hidden")
      .eq("id", postId)
      .maybeSingle();

    if (postErr) throw new Error(postErr.message || "Failed to fetch post");
    if (!post) return NextResponse.json({ ok: false, error: "post not found" }, { status: 404 });

    if (post.is_approved || post.is_hidden) {
      return NextResponse.json({ ok: true, skipped: true, reason: "not pending" });
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(post.image_path);
    const imageUrl = pub?.publicUrl || "";

    // Resend
    const resend = new Resend(mustEnv("RESEND_API_KEY"));

    const caption = post.caption ? String(post.caption) : "(no caption)";
    const createdAt = post.created_at ? new Date(post.created_at).toLocaleString("en-US") : "";

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;">
        <h2 style="margin:0 0 8px 0;">New Fan Wall post pending approval</h2>
        <p style="margin:0 0 8px 0;"><b>Caption:</b> ${escapeHtml(caption)}</p>
        <p style="margin:0 0 8px 0;"><b>Created:</b> ${escapeHtml(createdAt)}</p>
        ${imageUrl ? `<p style="margin:0 0 12px 0;"><a href="${imageUrl}">View image</a></p>` : ""}
        <p style="margin:0 0 12px 0;">
          <a href="${MODERATION_URL}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:600;">
            Open moderation page
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;margin:0;">Post ID: ${escapeHtml(post.id)}</p>
      </div>
    `;

    const { error: emailErr } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: "New Fan Wall photo pending approval",
      html,
    });

    if (emailErr) throw new Error(emailErr.message || "Resend send failed");

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[fan-wall pending] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "server error" }, { status: 500 });
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
