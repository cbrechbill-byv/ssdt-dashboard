// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv\route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

function getKioskEnvKey(): string | null {
  const primary = process.env.CHECKIN_BOARD_KEY?.trim();
  if (primary) return primary;

  const fallback = process.env.CHECKIN_BOARD_KEY?.trim();
  if (fallback) return fallback;

  return null;
}

function getEtYmd(now = new Date()): string {
  // YYYY-MM-DD in ET
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

type RecentItem =
  | { atIso: string; label: "VIP"; source?: string | null; points?: number | null }
  | { atIso: string; label: "Guest" };

type TvApiResponse = {
  ok: true;
  asOfIso: string;
  dateEt: string;
  total: number;
  vip: number;
  guest: number;
  recent: RecentItem[];
};

export async function GET(req: NextRequest) {
  const envKey = getKioskEnvKey();
  const key = req.nextUrl.searchParams.get("key") ?? "";

  if (!envKey || key !== envKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();
  const todayEt = getEtYmd(new Date());
  const asOfIso = new Date().toISOString();

  // VIP: rewards_scans where source='qr_checkin' and scan_date=today ET
  const vipCountPromise = supabase
    .from("rewards_scans")
    .select("*", { count: "exact", head: true })
    .eq("source", "qr_checkin")
    .eq("scan_date", todayEt);

  // Guests: guest_checkins where day_et=today ET
  const guestCountPromise = supabase
    .from("guest_checkins")
    .select("*", { count: "exact", head: true })
    .eq("day_et", todayEt);

  const [vipCountRes, guestCountRes] = await Promise.all([vipCountPromise, guestCountPromise]);

  if (vipCountRes.error) {
    return NextResponse.json({ ok: false, error: vipCountRes.error.message }, { status: 500 });
  }
  if (guestCountRes.error) {
    return NextResponse.json({ ok: false, error: guestCountRes.error.message }, { status: 500 });
  }

  const vipCount = vipCountRes.count ?? 0;
  const guestCount = guestCountRes.count ?? 0;

  // Keep recent lightweight (optional; UI can ignore)
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
      source: (r as any).source ?? null,
      points: (r as any).points ?? null,
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
    total: vipCount + guestCount,
    vip: vipCount,
    guest: guestCount,
    recent,
  };

  return NextResponse.json(payload);
}
