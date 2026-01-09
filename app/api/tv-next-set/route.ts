// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv-next-set\route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

function jsonNoStore(body: any, init?: { status?: number }) {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getEtHms(now = new Date()): string {
  // "HH:MM:SS" in ET
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const ss = parts.find((p) => p.type === "second")?.value ?? "00";
  return `${hh}:${mm}:${ss}`;
}

/**
 * Convert an ET-local wall-clock time into an absolute UTC ISO string.
 * Uses Intl timeZoneName: 'shortOffset' (e.g. "GMT-5") when available.
 * Robust across DST because the offset comes from the target date.
 */
function etWallClockToUtcIso(ymd: string, hmss: string): string {
  const [Y, M, D] = ymd.split("-").map((x) => Number(x));
  const [h, m, s] = hmss.split(":").map((x) => Number(x));

  const approxUtcMs = Date.UTC(Y, M - 1, D, h, m, s);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(approxUtcMs));

  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = match?.[1] === "-" ? -1 : 1;
  const offH = match ? Number(match[2]) : 0;
  const offM = match?.[3] ? Number(match[3]) : 0;
  const offsetMinutes = sign * (offH * 60 + offM);

  const utcMs = approxUtcMs - offsetMinutes * 60_000;
  return new Date(utcMs).toISOString();
}

function formatTimeEtFromYmdHms(ymd: string, hmss: string) {
  // Simple label like "9:00 PM" in ET
  const iso = etWallClockToUtcIso(ymd, hmss);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { timeZone: ET_TZ, hour: "numeric", minute: "2-digit" });
}

export async function GET(req: NextRequest) {
  const envKey = process.env.CHECKIN_BOARD_KEY?.trim() ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";

  if (!envKey || key !== envKey) {
    return jsonNoStore({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer;

  const todayEt = getEtYmd(new Date());
  const nowEtHms = getEtHms(new Date());

  // Find next set today:
  // - not cancelled
  // - start_time exists
  // - start_time >= now (ET wall-clock)
  // Order by soonest
  const { data, error } = await supabase
    .from("artist_events")
    .select(
      `
      id,
      event_date,
      start_time,
      end_time,
      title,
      is_cancelled,
      artist:artists ( name )
    `
    )
    .eq("event_date", todayEt)
    .eq("is_cancelled", false)
    .not("start_time", "is", null)
    .gte("start_time", nowEtHms) // compares time-of-day strings
    .order("start_time", { ascending: true })
    .limit(1);

  if (error) {
    return jsonNoStore({ ok: false, error: error.message }, { status: 500 });
  }

  const row = (data ?? [])[0] as any | undefined;
  if (!row) {
    return jsonNoStore({
      ok: true,
      todayEt,
      nowEtHms,
      next: null,
    });
  }

  // Supabase returns time columns commonly as "HH:MM:SS"
  const startHms: string = String(row.start_time ?? "").trim();
  const safeStartHms = startHms.length === 5 ? `${startHms}:00` : startHms; // support "HH:MM"

  const nextStartIso = etWallClockToUtcIso(todayEt, safeStartHms);
  const msUntil = new Date(nextStartIso).getTime() - Date.now();
  const secondsUntil = Math.floor(msUntil / 1000);

  const displayTitle =
    (row.artist?.name && String(row.artist.name).trim().length > 0 ? String(row.artist.name) : null) ||
    (row.title && String(row.title).trim().length > 0 ? String(row.title) : null) ||
    "Next set";

  return jsonNoStore({
    ok: true,
    todayEt,
    nowEtHms,
    next: {
      id: row.id,
      title: displayTitle,
      start_time: safeStartHms,
      startsAtEtLabel: formatTimeEtFromYmdHms(todayEt, safeStartHms),
      nextStartIso,
      secondsUntil,
    },
  });
}
