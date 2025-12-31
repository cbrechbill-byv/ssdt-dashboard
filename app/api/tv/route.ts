// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv\route.ts

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
  dateEt: string;
  total: number;
  vip: number;
  guest: number;
  recent: RecentItem[];
};

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export async function GET(req: NextRequest) {
  const envKey = process.env.CHECKIN_BOARD_KEY?.trim();
  const key = req.nextUrl.searchParams.get("key") ?? "";

  if (!envKey || key !== envKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ✅ Correct usage (NOT a function)
  const supabase = supabaseServer;

  const todayEt = getEtYmd(new Date());
  const asOfIso = new Date().toISOString();

  const vipCountRes = await supabase
    .from("rewards_scans")
    .select("*", { count: "exact", head: true })
    .eq("source", "qr_checkin")
    .eq("scan_date", todayEt);

  if (vipCountRes.error) {
    return NextResponse.json({ ok: false, error: vipCountRes.error.message }, { status: 500 });
  }

  const guestCountRes = await supabase
    .from("guest_checkins")
    .select("*", { count: "exact", head: true })
    .eq("day_et", todayEt);

  if (guestCountRes.error) {
    return NextResponse.json({ ok: false, error: guestCountRes.error.message }, { status: 500 });
  }

  const vip = vipCountRes.count ?? 0;
  const guest = guestCountRes.count ?? 0;

  const payload: TvApiResponse = {
    ok: true,
    asOfIso,
    dateEt: todayEt,
    total: vip + guest,
    vip,
    guest,
    recent: [],
  };

  return NextResponse.json(payload);
}
