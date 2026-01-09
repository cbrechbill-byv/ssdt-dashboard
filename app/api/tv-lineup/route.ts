// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv-lineup\route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

type LineupResponse =
  | {
      ok: true;
      dateEt: string;
      now: null | {
        label: string; // artist name or title
        startTime: string | null; // "HH:MM:SS" (from DB)
        endTime: string | null; // "HH:MM:SS" (from DB)
      };
      next: null | {
        label: string;
        startTime: string; // "HH:MM:SS"
      };
      nextStartsInSec: number | null;
    }
  | { ok: false; error: string };

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function jsonNoStore(body: LineupResponse, init?: { status?: number }) {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

function etNowMinutesSinceMidnight(now = new Date()): number {
  // Extract hour/min/sec in ET using Intl parts so DST is always correct.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const ss = Number(parts.find((p) => p.type === "second")?.value ?? "0");

  return hh * 60 + mm + ss / 60;
}

function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const s = String(t);
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3] ?? "0");
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return null;
  return hh * 60 + mm + ss / 60;
}

function minutesToSecondsDelta(nowMin: number, startMin: number): number {
  return Math.max(0, Math.round((startMin - nowMin) * 60));
}

type ArtistRel = { name: string | null };

type EventRow = {
  id: string;
  event_date: string; // YYYY-MM-DD
  start_time: string | null; // "HH:MM:SS"
  end_time: string | null; // "HH:MM:SS"
  title: string | null;
  is_cancelled: boolean;
  artist_id: string | null;

  // IMPORTANT: Supabase may return a single object OR an array depending on relationship shape
  artists?: ArtistRel | ArtistRel[] | null;
};

function coerceArtist(rel: EventRow["artists"]): ArtistRel | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

function labelForEvent(e: EventRow): string {
  const a = coerceArtist(e.artists);
  const artistName = (a?.name ?? "").trim();
  if (artistName) return artistName;

  const title = (e.title ?? "").trim();
  if (title) return title;

  return "Live Music";
}

export async function GET(req: NextRequest) {
  try {
    const dateEt = getEtYmd(new Date());
    const supabase = supabaseServer;

    // Pull today's events + artist name if present
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
        artist_id,
        artists:artist_id ( name )
      `
      )
      .eq("event_date", dateEt)
      .eq("is_cancelled", false)
      .order("start_time", { ascending: true });

    if (error) return jsonNoStore({ ok: false, error: error.message }, { status: 500 });

    const events = ((data ?? []) as unknown as EventRow[])
      .filter((e) => !!e.start_time) // must have a start to participate in now/next
      .map((e) => ({
        ...e,
        startMin: timeToMinutes(e.start_time),
        endMin: timeToMinutes(e.end_time),
      }))
      .filter((e: any) => Number.isFinite(e.startMin))
      .sort((a: any, b: any) => (a.startMin ?? 0) - (b.startMin ?? 0));

    const nowMin = etNowMinutesSinceMidnight(new Date());

    // Find "next" as the first event that starts after now
    const nextEvent: any = events.find((e: any) => (e.startMin ?? 0) > nowMin) ?? null;

    // Find "now" as an event that started and hasn't ended yet.
    // If end_time is missing, treat it as "now" until the next event starts (or end of day).
    let nowEvent: any = null;

    for (let i = 0; i < events.length; i++) {
      const e: any = events[i];
      const startMin = e.startMin ?? 0;

      // Determine effective end
      let endMin: number;
      if (Number.isFinite(e.endMin)) {
        endMin = e.endMin;
      } else {
        // if no explicit end, end at next event start; otherwise end of day
        const nextStart = i + 1 < events.length ? (events[i + 1].startMin ?? 1440) : 1440;
        endMin = nextStart;
      }

      if (startMin <= nowMin && nowMin < endMin) {
        nowEvent = e;
        break;
      }
    }

    const nextStartsInSec =
      nextEvent && Number.isFinite(nextEvent.startMin) ? minutesToSecondsDelta(nowMin, nextEvent.startMin) : null;

    return jsonNoStore({
      ok: true,
      dateEt,
      now: nowEvent
        ? {
            label: labelForEvent(nowEvent),
            startTime: nowEvent.start_time ?? null,
            endTime: nowEvent.end_time ?? null,
          }
        : null,
      next: nextEvent
        ? {
            label: labelForEvent(nextEvent),
            startTime: nextEvent.start_time!,
          }
        : null,
      nextStartsInSec,
    });
  } catch (e: any) {
    return jsonNoStore({ ok: false, error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}
