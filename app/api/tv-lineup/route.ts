// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv-lineup\route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

/**
 * tv-lineup
 * Returns Now/Next lineup info for the TV board status strip.
 * Uses artist_events + artists relationship.
 */

type EventRow = {
  id: string;
  event_date: string; // YYYY-MM-DD
  start_time: string | null; // ISO string or null depending on schema
  end_time: string | null; // ISO string or null
  title: string | null;
  is_cancelled: boolean | null;
  artist_id: string | null;

  // Supabase relationship returns an ARRAY for nested select
  artists?: { name: string | null }[] | null;
};

function jsonNoStore(body: any, init?: ResponseInit) {
  return new NextResponse(JSON.stringify(body), {
    ...(init || {}),
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(init?.headers || {}),
    },
  });
}

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function toIsoFromMaybe(value: any): string | null {
  if (!value) return null;
  // If it's already a string ISO, keep it.
  if (typeof value === "string") return value;
  // If it's a Date, toISOString.
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function pickArtistName(row: EventRow): string | null {
  const a = row.artists;
  if (!a) return null;
  if (Array.isArray(a)) return a[0]?.name ?? null;
  // Shouldn't happen, but keep safe
  return (a as any)?.name ?? null;
}

function normalizeLabel(row: EventRow): string {
  const artistName = pickArtistName(row);
  const t = (row.title || "").trim();
  const a = (artistName || "").trim();

  // Prefer artist name; fallback to title; fallback to "Live Music"
  if (a && t) return `${a} — ${t}`;
  if (a) return a;
  if (t) return t;
  return "Live Music";
}

function parseDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function secondsUntil(now: Date, futureIso: string | null): number | null {
  if (!futureIso) return null;
  const f = parseDate(futureIso);
  if (!f) return null;
  return Math.max(0, Math.floor((f.getTime() - now.getTime()) / 1000));
}

export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseServer;
    const todayEt = getEtYmd();

    // Pull today’s artist events (not cancelled)
    // NOTE: This assumes table name `artist_events` as per your project brief.
    // If your actual table is different, this is the only line to adjust.
    const { data, error } = await supabase
      .from("artist_events")
      .select(
        "id,event_date,start_time,end_time,title,is_cancelled,artist_id,artists(name)"
      )
      .eq("event_date", todayEt)
      .or("is_cancelled.is.null,is_cancelled.eq.false")
      .order("start_time", { ascending: true });

    if (error) return jsonNoStore({ ok: false, error: error.message }, { status: 500 });

    const rows: EventRow[] = (Array.isArray(data) ? (data as unknown as EventRow[]) : []).filter(Boolean);

    // Only events with a start_time can participate in now/next
    const events = rows
      .filter((e) => !!e.start_time)
      .map((e) => ({
        ...e,
        start_time: toIsoFromMaybe(e.start_time),
        end_time: toIsoFromMaybe(e.end_time),
        label: normalizeLabel(e),
      }))
      .filter((e) => !!e.start_time) as Array<
      EventRow & { start_time: string; end_time: string | null; label: string }
    >;

    const now = new Date();

    // Find "now": an event whose window includes now (start <= now < end)
    // If end_time is missing, treat it as "unknown duration" (don’t claim now; just use as upcoming)
    const current =
      events.find((e) => {
        const s = parseDate(e.start_time);
        if (!s) return false;
        if (s.getTime() > now.getTime()) return false;

        if (!e.end_time) return false; // require end_time to confidently declare "now"
        const en = parseDate(e.end_time);
        if (!en) return false;

        return now.getTime() >= s.getTime() && now.getTime() < en.getTime();
      }) ?? null;

    // Find next:
    // - If there is a current event: next is the next start_time after current.start_time
    // - Otherwise: next is the next start_time after now
    const next =
      (current
        ? events.find((e) => parseDate(e.start_time)?.getTime()! > parseDate(current.start_time)?.getTime()!)
        : events.find((e) => parseDate(e.start_time)?.getTime()! > now.getTime())) ?? null;

    const payload: TvLineupResponse = {
      ok: true,
      dateEt: todayEt,
      now: current
        ? {
            label: (current as any).label,
            startTime: current.start_time ?? null,
            endTime: current.end_time ?? null,
          }
        : null,
      next: next
        ? {
            label: (next as any).label,
            startTime: next.start_time!,
          }
        : null,
      nextStartsInSec: secondsUntil(now, next?.start_time ?? null),
    };

    return jsonNoStore(payload);
  } catch (e: any) {
    return jsonNoStore({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
