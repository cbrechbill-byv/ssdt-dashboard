// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv\route.ts
// app/api/tv/route.ts
// Returns today's check-in totals (ET-aligned) + a small recent feed.
//
// ✅ Behavior:
// - Requires ?key=CHECKIN_BOARD_KEY (kiosk secret)
// - VIP = rewards_scans where source='qr_checkin' AND scan_date=todayET
// - Guest = guest_checkins where day_et=todayET
// - Recent feed merges both (sorted by timestamp)

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

export async function GET(req: Request) {
  // ✅ Kiosk key protection
  const url = new URL(req.url);
  const providedKey = (url.searchParams.get("key") ?? "").trim();
  const kioskKey = (process.env.CHECKIN_BOARD_KEY ?? "").trim();

  // If not configured, fail closed
  if (!kioskKey) {
    return NextResponse.json({ ok: false, error: "Not configured" }, { status: 500 });
  }

  if (providedKey !== kioskKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer;

  const todayEt = getEtYmd();
  const asOfIso = new Date().toISOString();

  // --- VIP check-ins today (ET) -----------------------------------------
  const { data: vipRows, error: vipErr } = await supabase
    .from("rewards_scans")
    .select("id, scanned_at, source, points, scan_date")
    .eq("source", "qr_checkin")
    .eq("scan_date", todayEt)
    .order("scanned_at", { ascending: false })
    .limit(80);

  if (vipErr) console.error("[tv] rewards_scans error", vipErr);

  const vipCount = (vipRows ?? []).length;

  const vipRecent =
    (vipRows ?? []).map((r: any) => ({
      atIso: r.scanned_at as string,
      label: "VIP" as const,
      source: r.source ?? null,
      points: r.points ?? null,
    })) ?? [];

  // --- Guest check-ins today (ET) ---------------------------------------
  const { data: guestRows, error: guestErr } = await supabase
    .from("guest_checkins")
    .select("id, day_et, scanned_at, checked_in_at")
    .eq("day_et", todayEt)
    // Prefer scanned_at when present; fall back to checked_in_at
    .order("scanned_at", { ascending: false })
    .order("checked_in_at", { ascending: false })
    .limit(80);

  if (guestErr) console.error("[tv] guest_checkins error", guestErr);

  const guestCount = (guestRows ?? []).length;

  const guestRecent =
    (guestRows ?? [])
      .map((r: any) => ({
        atIso: (r.scanned_at ?? r.checked_in_at) as string | null,
        label: "Guest" as const,
      }))
      .filter((x) => !!x.atIso) ?? [];

  const recent = [...vipRecent, ...guestRecent]
    .filter((r) => r.atIso)
    .sort((a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime())
    .slice(0, 20);

  const total = vipCount + guestCount;

  return NextResponse.json({
    ok: true,
    asOfIso,
    dateEt: todayEt,
    total,
    vip: vipCount,
    guest: guestCount,
    recent,
  });
}
