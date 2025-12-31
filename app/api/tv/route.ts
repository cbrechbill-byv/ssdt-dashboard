// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv\route.ts
// app/api/tv/route.ts
// Returns today's check-in totals (ET-aligned) + a small recent feed.
// Protected by ?key=CHECKIN_BOARD_KEY

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

type RecentItem =
  | { atIso: string; label: "VIP"; source?: string | null; points?: number | null }
  | { atIso: string; label: "Guest" };

type TvApiResponse = {
  ok: true;
  asOfIso: string;
  dateEt: string; // YYYY-MM-DD (ET)
  total: number;
  vip: number;
  guest: number;
  recent: RecentItem[];
};

function getEtYmd(now = new Date()): string {
  // YYYY-MM-DD in ET
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getEnvKioskKey(): string | null {
  const k = process.env.CHECKIN_BOARD_KEY?.trim();
  return k ? k : null;
}

export async function GET(req: NextRequest) {
  const envKey = getEnvKioskKey();
  const key = req.nextUrl.searchParams.get("key") ?? "";

  if (!envKey || key !== envKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ✅ IMPORTANT:
  // In this codebase, supabaseServer is a SupabaseClient instance (NOT a function).
  const supabase = supabaseServer;

  const todayEt = getEtYmd(new Date());
  const asOfIso = new Date().toISOString();

  // VIP check-ins: rewards_scans where source='qr_checkin' and scan_date=today ET
  const vipCountRes = await supabase
    .from("rewards_scans")
    .select("*", { count: "exact", head: true })
    .eq("source", "qr_checkin")
    .eq("scan_date", todayEt);

  if (vipCountRes.error) {
    return NextResponse.json({ ok: false, error: vipCountRes.error.message }, { status: 500 });
  }

  // Guest check-ins: guest_checkins where day_et=today ET
  const guestCountRes = await supabase
    .from("guest_checkins")
    .select("*", { count: "exact", head: true })
    .eq("day_et", todayEt);

  if (guestCountRes.error) {
    return NextResponse.json({ ok: false, error: guestCountRes.error.message }, { status: 500 });
  }

  const vip = vipCountRes.count ?? 0;
  const guest = guestCountRes.count ?? 0;

  // Recent feed is optional. Keep it light and safe (UI can ignore it).
  const vipRecentRes = await supabase
    .from("rewards_scans")
    .select("created_at, source, points")
    .eq("source", "qr_checkin")
    .eq("scan_date", todayEt)
    .order("created_at", { ascending: false })
    .limit(10);

  const guestRecentRes = await supabase
    .from("guest_checkins")
    .select("created_at")
    .eq("day_et", todayEt)
    .order("created_at", { ascending: false })
    .limit(10);

  const vipRecent: RecentItem[] =
    vipRecentRes.data?.map((r) => ({
      atIso: String(r.created_at),
      label: "VIP",
      source: (r as unknown as { source?: string | null }).source ?? null,
      points: (r as unknown as { points?: number | null }).points ?? null,
    })) ?? [];

  const guestRecent: RecentItem[] =
    guestRecentRes.data?.map((r) => ({
      atIso: String(r.created_at),
      label: "Guest",
    })) ?? [];

  const recent = [...vipRecent, ...guestRecent]
    .sort((a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime())
    .slice(0, 20);

  const payload: TvApiResponse = {
    ok: true,
    asOfIso,
    dateEt: todayEt,
    total: vip + guest,
    vip,
    guest,
    recent,
  };

  return NextResponse.json(payload);
}
