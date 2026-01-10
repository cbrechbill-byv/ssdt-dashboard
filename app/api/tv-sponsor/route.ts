// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv-sponsor\route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";
const SPONSOR_BUCKET = "sponsor-logos";
const DEFAULT_ROTATE_EVERY_SECONDS = 20;

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function etSecondsSinceMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const ss = Number(parts.find((p) => p.type === "second")?.value ?? "0");
  return hh * 3600 + mm * 60 + ss;
}

function clampRotateSeconds(n: number) {
  if (!Number.isFinite(n)) return DEFAULT_ROTATE_EVERY_SECONDS;
  // sensible bounds for TVs
  return Math.max(5, Math.min(600, Math.floor(n)));
}

function jsonNoStore(body: any, init?: { status?: number }) {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

type SchedRow = {
  id: string;
  sponsor_id: string;
  start_date: string;
  end_date: string | null;
  priority: number;
  is_active: boolean;
  created_at?: string;
};

type SponsorSettingsRow = {
  id: string;
  rotate_every_seconds: number;
  updated_at: string;
};

export async function GET(req: NextRequest) {
  const envKey = process.env.CHECKIN_BOARD_KEY?.trim() ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";

  // Lock this endpoint behind the same key used by the TV board
  if (!envKey || key !== envKey) {
    return jsonNoStore({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer;
  const todayEt = getEtYmd(new Date());

  // ✅ Load rotation setting (single-row settings table)
  const { data: settingsData, error: settingsErr } = await supabase
    .from("tv_sponsor_settings")
    .select("id,rotate_every_seconds,updated_at")
    .eq("id", "default")
    .maybeSingle();

  if (settingsErr) return jsonNoStore({ ok: false, error: settingsErr.message }, { status: 500 });

  const rotateEverySeconds = clampRotateSeconds(
    Number((settingsData as SponsorSettingsRow | null)?.rotate_every_seconds ?? DEFAULT_ROTATE_EVERY_SECONDS)
  );

  // Pull ALL eligible schedules for today (so we can rotate them)
  const { data: schedRows, error: schedErr } = await supabase
    .from("tv_sponsor_schedule")
    .select("id,sponsor_id,start_date,end_date,priority,is_active,created_at")
    .eq("is_active", true)
    .lte("start_date", todayEt)
    .or(`end_date.is.null,end_date.gte.${todayEt}`)
    .order("priority", { ascending: false })
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (schedErr) return jsonNoStore({ ok: false, error: schedErr.message }, { status: 500 });

  const eligible = ((schedRows ?? []) as SchedRow[]).filter((r) => !!r?.sponsor_id);

  if (eligible.length === 0) {
    return jsonNoStore({
      ok: true,
      found: false,
      todayEt,
      rotateEverySeconds,
      schedule: null,
      sponsor: null,
    });
  }

  // ✅ Option A: rotate deterministically by ET time slice
  const sec = etSecondsSinceMidnight(new Date());
  const slot = Math.floor(sec / rotateEverySeconds);
  const idx = slot % eligible.length;

  const picked = eligible[idx];

  const { data: sponsor, error: sponsorErr } = await supabase
    .from("sponsors")
    .select("id,name,logo_path,website_url,tier,sponsor_message")
    .eq("id", picked.sponsor_id)
    .maybeSingle();

  if (sponsorErr) return jsonNoStore({ ok: false, error: sponsorErr.message }, { status: 500 });

  // Build a public URL for the logo (bucket must be public)
  let logoUrl: string | null = null;
  if (sponsor?.logo_path) {
    const { data } = supabase.storage.from(SPONSOR_BUCKET).getPublicUrl(sponsor.logo_path);
    logoUrl = data?.publicUrl ?? null;
  }

  return jsonNoStore({
    ok: true,
    found: true,
    todayEt,
    rotateEverySeconds,

    // debug / confidence
    rotation: {
      eligibleCount: eligible.length,
      index: idx,
    },

    schedule: {
      id: picked.id,
      start_date: picked.start_date,
      end_date: picked.end_date,
      priority: picked.priority,
    },

    sponsor: sponsor
      ? {
          id: sponsor.id,
          name: sponsor.name,
          tier: sponsor.tier,
          website_url: sponsor.website_url,
          sponsor_message: sponsor.sponsor_message,
          logo_url: logoUrl,
        }
      : null,
  });
}
