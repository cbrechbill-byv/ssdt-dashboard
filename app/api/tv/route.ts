// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv\route.ts
// app/api/tv/route.ts
// Returns today's check-in totals (ET-aligned) + a small recent feed.
// VIP = rewards_scans where source='qr_checkin' and scan_date=todayET
// Guest = optional guest_checkins table (safe fallback if not present)

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const ET_TZ = "America/New_York";

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = supabaseServer;

  const todayEt = getEtYmd();
  const asOfIso = new Date().toISOString();

  // VIP check-ins today
  const { data: vipRows, error: vipErr } = await supabase
    .from("rewards_scans")
    .select("id, scanned_at, source, points")
    .eq("source", "qr_checkin")
    .eq("scan_date", todayEt)
    .order("scanned_at", { ascending: false })
    .limit(80);

  if (vipErr) console.error("[tv] rewards_scans error", vipErr);

  const vipCount = (vipRows ?? []).length;

  // Guest check-ins today (optional table)
  let guestCount = 0;
  let guestRecent: Array<{ atIso: string; label: "Guest" }> = [];

  try {
    const { data: guestRows, error: guestErr } = await supabase
      .from("guest_checkins")
      .select("id, created_at")
      .eq("checkin_date", todayEt)
      .order("created_at", { ascending: false })
      .limit(40);

    if (guestErr) {
      // table missing or column mismatch -> treat as “not configured”
      console.warn("[tv] guest_checkins not available:", guestErr.message);
    } else {
      guestCount = (guestRows ?? []).length;
      guestRecent =
        (guestRows ?? []).map((r: any) => ({
          atIso: r.created_at,
          label: "Guest" as const,
        })) ?? [];
    }
  } catch {
    // ignore
  }

  const vipRecent =
    (vipRows ?? []).map((r: any) => ({
      atIso: r.scanned_at,
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
