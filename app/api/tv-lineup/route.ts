// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv-lineup\route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";
const DEFAULT_LEAD_MINUTES = 120;

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

      // Helpful for dashboard preview/debug (safe to ignore in UI)
      countdownLeadMinutes: number;
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
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  is_cancelled: boolean;
  artist_id: string | null;

  // Supabase may return a single object OR an array depending on relationship shape
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

async function loadLeadMinutes(): Promise<number> {
  try {
    const { data, error } = await supabaseServer
      .from("tv_lineup_settings")
      .select("countdown_lead_minutes")
      .eq("id", "default")
      .maybeSingle();

    if (error) return DEFAULT_LEAD_MINUTES;

    const n = Number((data as any)?.countdown_lead_minutes);
    if (!Number.isFinite(n)) return DEFAULT_LEAD_MINUTES;

    // clamp 0..1440
    return Math.max(0, Math.min(24 * 60, Math.floor(n)));
  } catch {
    return DEFAULT_LEAD_MINUTES;
  }
}

export async function GET(_req: NextRequest) {
  try {
    const dateEt = getEtYmd(new Date());
    const leadMinutes = await loadLeadMinutes();

    const { data, error } = await supabaseServer
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
      .filter((e) => !!e.start_time)
      .map((e) => ({
        ...e,
        startMin: timeToMinutes(e.start_time),
        endMin: timeToMinutes(e.end_time),
      }))
      .filter((e: any) => Number.isFinite(e.startMin))
      .sort((a: any, b: any) => (a.startMin ?? 0) - (b.startMin ?? 0));

    const nowMin = etNowMinutesSinceMidnight(new Date());

    const nextEvent: any = events.find((e: any) => (e.startMin ?? 0) > nowMin) ?? null;

    let nowEvent: any = null;
    for (let i = 0; i < events.length; i++) {
      const e: any = events[i];
      const startMin = e.startMin ?? 0;

      let endMin: number;
      if (Number.isFinite(e.endMin)) {
        endMin = e.endMin;
      } else {
        const nextStart = i + 1 < events.length ? (events[i + 1].startMin ?? 1440) : 1440;
        endMin = nextStart;
      }

      if (startMin <= nowMin && nowMin < endMin) {
        nowEvent = e;
        break;
      }
    }

    let nextStartsInSec =
      nextEvent && Number.isFinite(nextEvent.startMin) ? minutesToSecondsDelta(nowMin, nextEvent.startMin) : null;

    /**
     * ✅ Lead window gating (ONLY before the FIRST set begins)
     * Hide the long countdown during the day until we're within leadMinutes of the first set.
     */
    const firstEvent: any = events.length > 0 ? events[0] : null;
    const firstStartMin: number | null = firstEvent && Number.isFinite(firstEvent.startMin) ? firstEvent.startMin : null;

    if (firstStartMin != null && nowMin < firstStartMin) {
      const leadSec = leadMinutes * 60;
      const secUntilFirst = minutesToSecondsDelta(nowMin, firstStartMin);

      const isNextFirst = nextEvent && firstEvent && nextEvent.id === firstEvent.id;

      if (isNextFirst && secUntilFirst > leadSec) {
        nextStartsInSec = null;
      }
    }

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
      countdownLeadMinutes: leadMinutes,
    });
  } catch (e: any) {
    return jsonNoStore({ ok: false, error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}
