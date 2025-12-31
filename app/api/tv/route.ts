// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv\route.ts
// app/api/tv/route.ts
// Returns today's check-in totals (ET-aligned) + a small recent feed.
// VIP = rewards_scans where scan_date=todayET
// Guest = guest_checkins where day_et=todayET
//
// ✅ Fix: ensure recent items always have atIso: string (no null) before sorting

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

type RecentItem =
  | { atIso: string; label: "VIP"; source?: string | null; points?: number | null }
  | { atIso: string; label: "Guest" };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isRecentItem(v: unknown): v is RecentItem {
  return !!v && typeof v === "object" && isNonEmptyString((v as any).atIso);
}

export async function GET() {
  const supabase = supabaseServer;

  const todayEt = getEtYmd();
  const asOfIso = new Date().toISOString();

  // --- VIP check-ins today (ET) -----------------------------------------
  const { data: vipRows, error: vipErr } = await supabase
    .from("rewards_scans")
    .select("id, scanned_at, source, points, scan_date")
    .eq("scan_date", todayEt)
    .order("scanned_at", { ascending: false })
    .limit(80);

  if (vipErr) console.error("[tv] rewards_scans error", vipErr);

  const vipCount = (vipRows ?? []).length;

  const vipRecent: RecentItem[] = (vipRows ?? [])
    .map((r: any) => {
      const atIso = r?.scanned_at as string | null;
      if (!isNonEmptyString(atIso)) return null;

      return {
        atIso,
        label: "VIP" as const,
        source: (r?.source ?? null) as string | null,
        points: (r?.points ?? null) as number | null,
      };
    })
    .filter(isRecentItem);

  // --- Guest check-ins today (ET) ---------------------------------------
  const { data: guestRows, error: guestErr } = await supabase
    .from("guest_checkins")
    .select("id, day_et, scanned_at, checked_in_at")
    .eq("day_et", todayEt)
    // prefer scanned_at; checked_in_at exists too
    .order("scanned_at", { ascending: false })
    .order("checked_in_at", { ascending: false })
    .limit(80);

  if (guestErr) console.error("[tv] guest_checkins error", guestErr);

  const guestCount = (guestRows ?? []).length;

  const guestRecent: RecentItem[] = (guestRows ?? [])
    .map((r: any) => {
      const atIso = (r?.scanned_at ?? r?.checked_in_at) as string | null;
      if (!isNonEmptyString(atIso)) return null;
      return { atIso, label: "Guest" as const };
    })
    .filter(isRecentItem);

  const recent: RecentItem[] = [...vipRecent, ...guestRecent]
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
