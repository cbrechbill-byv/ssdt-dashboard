// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv\route.ts
// app/api/tv/route.ts
// Returns today's check-in totals (ET-aligned) + a small recent feed.
// VIP = rewards_scans where scan_date=todayET (optionally filtered by source elsewhere)
// Guest = guest_checkins where day_et=todayET

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

export async function GET() {
  const supabase = supabaseServer;

  const todayEt = getEtYmd();
  const asOfIso = new Date().toISOString();

  // --- VIP check-ins today (ET) -----------------------------------------
  // If you want ONLY QR check-ins, add: .eq("source", "qr_checkin")
  const { data: vipRows, error: vipErr } = await supabase
    .from("rewards_scans")
    .select("id, scanned_at, source, points, scan_date")
    .eq("scan_date", todayEt)
    .order("scanned_at", { ascending: false })
    .limit(80);

  if (vipErr) console.error("[tv] rewards_scans error", vipErr);

  const vipCount = (vipRows ?? []).length;

  // --- Guest check-ins today (ET) ---------------------------------------
  // Your schema uses: day_et + checked_in_at/scanned_at
  let guestCount = 0;
  let guestRecent: Array<{ atIso: string; label: "Guest" }> = [];

  const { data: guestRows, error: guestErr } = await supabase
    .from("guest_checkins")
    .select("id, day_et, scanned_at, checked_in_at")
    .eq("day_et", todayEt)
    // Prefer scanned_at ordering if present; checked_in_at exists and is not null
    .order("checked_in_at", { ascending: false })
    .limit(80);

  if (guestErr) {
    console.error("[tv] guest_checkins error", guestErr);
  } else {
    guestCount = (guestRows ?? []).length;
    guestRecent =
      (guestRows ?? []).map((r: any) => ({
        atIso: (r.scanned_at ?? r.checked_in_at) as string,
        label: "Guest" as const,
      })) ?? [];
  }

  const vipRecent =
    (vipRows ?? []).map((r: any) => ({
      atIso: r.scanned_at as string,
      label: "VIP" as const,
      source: r.source ?? null,
      points: r.points ?? null,
    })) ?? [];

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
