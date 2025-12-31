// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv\route.ts
// app/api/tv/route.ts
// Returns today's check-in totals (ET-aligned) + a small recent feed.
// Protected by ?key=CHECKIN_BOARD_KEY

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

type RecentItem =
  | { atIso: string; label: "VIP"; source?: string | null; points?: number | null }
  | { atIso: string; label: "Guest" };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const providedKey = (url.searchParams.get("key") ?? "").trim();
  const kioskKey = (process.env.CHECKIN_BOARD_KEY ?? "").trim();

  if (!kioskKey || providedKey !== kioskKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer;

  const todayEt = getEtYmd();
  const asOfIso = new Date().toISOString();

  const { data: vipRows, error: vipErr } = await supabase
    .from("rewards_scans")
    .select("id, scanned_at, source, points, scan_date")
    .eq("source", "qr_checkin")
    .eq("scan_date", todayEt)
    .order("scanned_at", { ascending: false })
    .limit(140);

  if (vipErr) console.error("[tv] rewards_scans error", vipErr);

  const { data: guestRows, error: guestErr } = await supabase
    .from("guest_checkins")
    .select("id, scanned_at, checked_in_at, day_et")
    .eq("day_et", todayEt)
    .order("scanned_at", { ascending: false })
    .order("checked_in_at", { ascending: false })
    .limit(140);

  if (guestErr) console.error("[tv] guest_checkins error", guestErr);

  const vipCount = (vipRows ?? []).length;
  const guestCount = (guestRows ?? []).length;

  const vipRecent: RecentItem[] = (vipRows ?? []).flatMap((r: any) => {
    const atIso = r?.scanned_at as unknown;
    if (!isNonEmptyString(atIso)) return [];
    return [
      {
        atIso,
        label: "VIP" as const,
        source: (r?.source ?? null) as string | null,
        points: (r?.points ?? null) as number | null,
      },
    ];
  });

  const guestRecent: RecentItem[] = (guestRows ?? []).flatMap((r: any) => {
    const atIso = (r?.scanned_at ?? r?.checked_in_at) as unknown;
    if (!isNonEmptyString(atIso)) return [];
    return [{ atIso, label: "Guest" as const }];
  });

  const recent = [...vipRecent, ...guestRecent]
    .sort((a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime())
    .slice(0, 20);

  return NextResponse.json({
    ok: true,
    asOfIso,
    dateEt: todayEt,
    total: vipCount + guestCount,
    vip: vipCount,
    guest: guestCount,
    recent,
  });
}
