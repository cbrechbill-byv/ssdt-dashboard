import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PRELOADER_KEY = "sponsor_preloader";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !service) throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  return createClient(url, service, { auth: { persistSession: false } });
}

const DEFAULTS = {
  enabled: false,
  variant: "cinematic",
  duration_ms: 1600,
  starts_on: null,
  ends_on: null,
  vip_show_once_hours: 12,
  max_sponsors: 1,
  headline: "Because of sponsors like you, the music is free.",
  subheadline: "Thank you for supporting live music at Sugarshack Downtown.",
  footnote: "Sugarshack Downtown • Presented by By Venue Creative",
};

function normalize(v: any) {
  const merged = { ...DEFAULTS, ...(v && typeof v === "object" ? v : {}) };
  merged.enabled = !!merged.enabled;
  merged.variant = merged.variant === "fast" ? "fast" : "cinematic";
  merged.duration_ms = Math.max(400, Math.min(10000, Number(merged.duration_ms || DEFAULTS.duration_ms)));
  merged.vip_show_once_hours = Math.max(0, Math.min(168, Number(merged.vip_show_once_hours || DEFAULTS.vip_show_once_hours)));
  merged.max_sponsors = Math.max(1, Math.min(6, Number(merged.max_sponsors || DEFAULTS.max_sponsors)));
  merged.starts_on = merged.starts_on ? String(merged.starts_on).slice(0, 10) : null;
  merged.ends_on = merged.ends_on ? String(merged.ends_on).slice(0, 10) : null;
  merged.headline = String(merged.headline ?? DEFAULTS.headline);
  merged.subheadline = String(merged.subheadline ?? DEFAULTS.subheadline);
  merged.footnote = String(merged.footnote ?? DEFAULTS.footnote);
  return merged;
}

export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key,value")
      .eq("key", PRELOADER_KEY)
      .maybeSingle();

    if (error) throw error;

    const value = normalize(data?.value);
    return NextResponse.json({ ok: true, data: { key: PRELOADER_KEY, value } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getAdminClient();
    const body = await req.json().catch(() => ({}));
    const next = normalize(body?.value);

    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: PRELOADER_KEY, value: next }, { onConflict: "key" });

    if (error) throw error;

    return NextResponse.json({ ok: true, value: next });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
