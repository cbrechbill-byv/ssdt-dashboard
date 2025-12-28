// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\dashboard\venue-health\page.tsx
// app/dashboard/venue-health/page.tsx
// Path: /dashboard/venue-health
// Purpose: Historical Venue Health trends (attendance + VIP/guest mix + conversions + redemptions),
// correlated with scheduled events/artists.
// Notes:
// - All “today” logic uses America/New_York (ET).
// - Attendance definitions match Tonight page:
//   Total People = unique VIP users (scan_date) + unique guest devices (day_et)
// - Event label rules:
//   If artist_id exists -> Artist name
//   Else -> "SSDT Event (Title)" (or "SSDT Event" if title blank)

import React from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 0;

const ET_TZ = "America/New_York";

type ScanRow = {
  id: string;
  user_id: string;
  points: number;
  scanned_at: string;
  scan_date: string; // YYYY-MM-DD (ET)
  source: string | null;
  note: string | null;
};

type GuestCheckinRow = {
  id: string;
  guest_device_id: string | null;
  device_id: string | null; // legacy/optional
  platform: string | null;
  app_version: string | null;
  source: string | null;
  day_et: string | null; // YYYY-MM-DD (ET)
  scanned_at: string | null; // timestamptz
  checked_in_at: string | null; // legacy/optional
};

type GuestDeviceLinkRow = {
  guest_device_id: string;
  user_id: string;
  linked_at: string | null; // timestamptz
};

type RedemptionRow = {
  id: string;
  user_id: string;
  reward_name: string;
  points_spent: number;
  created_at: string; // timestamptz
};

type ArtistEventRow = {
  id: string;
  artist_id: string | null;
  event_date: string; // date -> YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  is_cancelled: boolean;
};

type ArtistMini = {
  id: string;
  name: string;
};

type Grouping = "day" | "week" | "month";
type RangeDays = 7 | 30 | 90;
type TrendMetric = "total" | "vip" | "guest";

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Date-only strings MUST NOT be parsed as Date("YYYY-MM-DD") (UTC midnight).
// Use a noon-UTC anchor so it formats safely in ET.
function addDaysEtYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  if (!y || !m || !d) return ymd;
  const safeUtc = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return safeUtc.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateEt(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  if (!y || !m || !d) return ymd;
  const safeUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    month: "short",
    day: "numeric",
  }).format(safeUtc);
}

function formatMonthLabel(ym: string): string {
  // ym = YYYY-MM
  const [y, m] = ym.split("-").map((n) => Number(n));
  if (!y || !m) return ym;
  const safeUtc = new Date(Date.UTC(y, m - 1, 15, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    month: "short",
    year: "numeric",
  }).format(safeUtc);
}

function etIsoToEtYmd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return getEtYmd();
  return d.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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

function getWeekStartEt(ymd: string): string {
  // Week starts on Monday (ET). Use safe noon UTC anchors for date math.
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  if (!y || !m || !d) return ymd;

  const safeUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    weekday: "short",
  }).format(safeUtc);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const w = map[weekday] ?? 0;
  // shift back to Monday
  const shift = w === 0 ? 6 : w - 1;
  return addDaysEtYmd(ymd, -shift);
}

function getMonthKey(ymd: string): string {
  return ymd.slice(0, 7); // YYYY-MM
}

function normalizeEventLabel(
  ev: { artist_id: string | null; title: string | null },
  artistName: string | null
): string {
  if (ev.artist_id && artistName && artistName.trim().length > 0)
    return artistName.trim();
  const t = (ev.title ?? "").trim();
  if (t.length > 0) return `SSDT Event (${t})`;
  return "SSDT Event";
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode;
  helper: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "emerald" | "amber";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-200 text-slate-700";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function buildQueryString(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s.length ? `?${s}` : "";
}

// ✅ Next-safe helper: searchParams values can be string | string[] | undefined
function spValue(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

type PeriodAgg = {
  key: string;

  // true uniques across the period
  vipUsers: Set<string>;
  guestDevices: Set<string>;
  conversions: Set<string>;

  // counts
  vipScans: number;
  guestRows: number;
  pointsEarned: number;

  redemptionsCount: number;
  pointsSpent: number;

  // derived
  label: string;
  eventLabel: string;
  eventCount: number;
};

export default async function VenueHealthPage({
  searchParams,
}: {
  // ✅ Next 16: searchParams can sometimes be a Promise in App Router under certain conditions
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = supabaseServer;

  // ✅ CRITICAL FIX: always resolve searchParams first (avoids Next/Turbopack sourcemap bug)
  const sp = (await Promise.resolve(searchParams)) ?? {};

  const rangeRaw = spValue(sp.range);
  const groupRaw = spValue(sp.group);
  const metricRaw = spValue(sp.metric);

  const range: RangeDays = rangeRaw === "7" ? 7 : rangeRaw === "90" ? 90 : 30;
  const group: Grouping =
    groupRaw === "week" ? "week" : groupRaw === "month" ? "month" : "day";

  const metric: TrendMetric =
    metricRaw === "vip" ? "vip" : metricRaw === "guest" ? "guest" : "total";

  const todayEt = getEtYmd();
  const startEt = addDaysEtYmd(todayEt, -(range - 1));

  const rangeStartUtc = etWallClockToUtcIso(startEt, "00:00:00");
  const rangeEndUtc = etWallClockToUtcIso(todayEt, "23:59:59");

  const [{ data: scansData, error: scansError }, { data: guestData, error: guestErr }] =
    await Promise.all([
      supabase
        .from("rewards_scans")
        .select("id, user_id, points, scanned_at, scan_date, source, note")
        .gte("scan_date", startEt)
        .lte("scan_date", todayEt)
        .order("scanned_at", { ascending: false }),
      supabase
        .from("guest_checkins")
        .select(
          "id, guest_device_id, device_id, platform, app_version, source, day_et, scanned_at, checked_in_at"
        )
        .gte("day_et", startEt)
        .lte("day_et", todayEt)
        .order("scanned_at", { ascending: false }),
    ]);

  if (scansError) console.error("[venue-health] rewards_scans error", scansError);
  if (guestErr) console.error("[venue-health] guest_checkins error", guestErr);

  const scans: ScanRow[] = (scansData ?? []) as ScanRow[];
  const guestCheckins: GuestCheckinRow[] = (guestData ?? []) as GuestCheckinRow[];

  const [{ data: linksData, error: linksErr }, { data: redData, error: redErr }] =
    await Promise.all([
      supabase
        .from("guest_device_links")
        .select("guest_device_id, user_id, linked_at")
        .gte("linked_at", rangeStartUtc)
        .lte("linked_at", rangeEndUtc)
        .order("linked_at", { ascending: false }),
      supabase
        .from("rewards_redemptions")
        .select("id, user_id, reward_name, points_spent, created_at")
        .gte("created_at", rangeStartUtc)
        .lte("created_at", rangeEndUtc)
        .order("created_at", { ascending: false }),
    ]);

  if (linksErr) console.error("[venue-health] guest_device_links error", linksErr);
  if (redErr) console.error("[venue-health] rewards_redemptions error", redErr);

  const links: GuestDeviceLinkRow[] = (linksData ?? []) as unknown as GuestDeviceLinkRow[];
  const redemptions: RedemptionRow[] = (redData ?? []) as RedemptionRow[];

  const { data: eventsData, error: eventsErr } = await supabase
    .from("artist_events")
    .select("id, artist_id, event_date, start_time, end_time, title, is_cancelled")
    .gte("event_date", startEt)
    .lte("event_date", todayEt)
    .eq("is_cancelled", false)
    .order("event_date", { ascending: false })
    .order("start_time", { ascending: true });

  if (eventsErr) console.error("[venue-health] artist_events error", eventsErr);

  const events: ArtistEventRow[] = (eventsData ?? []) as ArtistEventRow[];
  const artistIds = Array.from(
    new Set(events.map((e) => e.artist_id).filter((x): x is string => !!x))
  );

  let artists: ArtistMini[] = [];
  if (artistIds.length > 0) {
    const { data: artistsData, error: artistsError } = await supabase
      .from("artists")
      .select("id, name")
      .in("id", artistIds);

    if (artistsError) console.error("[venue-health] artists lookup error", artistsError);
    artists = (artistsData ?? []) as ArtistMini[];
  }

  const artistNameById = new Map<string, string>();
  for (const a of artists) {
    if (a?.id && a?.name) artistNameById.set(a.id, a.name);
  }

  function periodKeyFromYmd(ymd: string): string {
    if (group === "month") return getMonthKey(ymd);
    if (group === "week") return getWeekStartEt(ymd);
    return ymd;
  }

  function periodLabelFromKey(key: string): string {
    if (group === "month") return formatMonthLabel(key);
    if (group === "week") return `Week of ${formatDateEt(key)}`;
    return formatDateEt(key);
  }

  const periodAgg = new Map<string, PeriodAgg>();

  function getOrInitPeriod(key: string): PeriodAgg {
    let p = periodAgg.get(key);
    if (!p) {
      p = {
        key,
        vipUsers: new Set<string>(),
        guestDevices: new Set<string>(),
        conversions: new Set<string>(),
        vipScans: 0,
        guestRows: 0,
        pointsEarned: 0,
        redemptionsCount: 0,
        pointsSpent: 0,
        label: periodLabelFromKey(key),
        eventLabel: "—",
        eventCount: 0,
      };
      periodAgg.set(key, p);
    }
    return p;
  }

  for (const s of scans) {
    const ymd = s.scan_date;
    const k = periodKeyFromYmd(ymd);
    const p = getOrInitPeriod(k);

    if (s.user_id) p.vipUsers.add(String(s.user_id));
    p.vipScans += 1;
    p.pointsEarned += Number(s.points ?? 0);
  }

  for (const g of guestCheckins) {
    const ymd = (g.day_et ?? "").trim();
    if (!ymd) continue;

    const dev = (g.guest_device_id || g.device_id) ?? null;
    const k = periodKeyFromYmd(ymd);
    const p = getOrInitPeriod(k);

    p.guestRows += 1;
    if (dev && String(dev).trim().length > 0) p.guestDevices.add(String(dev));
  }

  for (const l of links) {
    const iso = l.linked_at ?? null;
    if (!iso) continue;

    const ymd = etIsoToEtYmd(iso);
    const k = periodKeyFromYmd(ymd);
    const p = getOrInitPeriod(k);

    if (l.guest_device_id) p.conversions.add(String(l.guest_device_id));
  }

  for (const r of redemptions) {
    const ymd = etIsoToEtYmd(r.created_at);
    const k = periodKeyFromYmd(ymd);
    const p = getOrInitPeriod(k);

    p.redemptionsCount += 1;
    p.pointsSpent += Number(r.points_spent ?? 0);
  }

  const eventsByDay = new Map<string, ArtistEventRow[]>();
  for (const e of events) {
    if (!e.event_date) continue;
    const day = e.event_date;
    const arr = eventsByDay.get(day) ?? [];
    arr.push(e);
    eventsByDay.set(day, arr);
  }

  const dayList: string[] = [];
  for (let i = 0; i < range; i++) dayList.push(addDaysEtYmd(startEt, i));

  const dayMeta = new Map<
    string,
    { eventLabel: string; eventCount: number; artistId: string | null }
  >();

  for (const day of dayList) {
    const evs = (eventsByDay.get(day) ?? [])
      .filter((x) => !x.is_cancelled)
      .sort((a, b) => {
        const aT = a.start_time ?? "99:99:99";
        const bT = b.start_time ?? "99:99:99";
        return aT < bT ? -1 : aT > bT ? 1 : 0;
      });

    if (evs.length === 0) {
      dayMeta.set(day, { eventLabel: "—", eventCount: 0, artistId: null });
      continue;
    }

    const head = evs[0];
    const name = head.artist_id ? artistNameById.get(head.artist_id) ?? null : null;
    const label = normalizeEventLabel(head, name);

    dayMeta.set(day, {
      eventLabel: evs.length > 1 ? `${label} (+${evs.length - 1} more)` : label,
      eventCount: evs.length,
      artistId: head.artist_id ?? null,
    });
  }

  for (const key of periodAgg.keys()) {
    const p = getOrInitPeriod(key);
    const daysInPeriod = dayList.filter((d) => periodKeyFromYmd(d) === key);
    if (daysInPeriod.length === 0) continue;

    let bestDay = daysInPeriod[0];
    let bestPeople = -1;

    for (const day of daysInPeriod) {
      const vipSet = new Set<string>();
      for (const s of scans) if (s.scan_date === day && s.user_id) vipSet.add(String(s.user_id));

      const guestSet = new Set<string>();
      for (const g of guestCheckins) {
        if (g.day_et === day) {
          const dev = (g.guest_device_id || g.device_id) ?? null;
          if (dev && String(dev).trim().length > 0) guestSet.add(String(dev));
        }
      }

      const people = vipSet.size + guestSet.size;
      if (people > bestPeople) {
        bestPeople = people;
        bestDay = day;
      }
    }

    const meta = dayMeta.get(bestDay) ?? { eventLabel: "—", eventCount: 0, artistId: null };
    p.eventLabel = meta.eventLabel;
    p.eventCount = meta.eventCount;
  }

  const keysChrono = dayList.map((d) => periodKeyFromYmd(d));
  const seen = new Set<string>();
  const periodKeys = keysChrono.filter((k) => {
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  for (const k of periodKeys) getOrInitPeriod(k);

  const series = periodKeys.map((k) => {
    const p = getOrInitPeriod(k);
    const uniqueVips = p.vipUsers.size;
    const uniqueGuests = p.guestDevices.size;
    const totalPeople = uniqueVips + uniqueGuests;
    const conv = p.conversions.size;
    const convRate = pct(conv, uniqueGuests);

    return {
      key: k,
      label: p.label,
      eventLabel: p.eventLabel,
      eventCount: p.eventCount,

      uniqueVips,
      uniqueGuests,
      totalPeople,

      vipScans: p.vipScans,
      guestRows: p.guestRows,
      pointsEarned: p.pointsEarned,

      conversions: conv,
      conversionRate: convRate,

      redemptionsCount: p.redemptionsCount,
      pointsSpent: p.pointsSpent,
    };
  });

  const sumPeople = series.reduce((s, x) => s + x.totalPeople, 0);
  const sumVip = series.reduce((s, x) => s + x.uniqueVips, 0);
  const sumGuest = series.reduce((s, x) => s + x.uniqueGuests, 0);
  const sumConversions = series.reduce((s, x) => s + x.conversions, 0);
  const sumRedemptions = series.reduce((s, x) => s + x.redemptionsCount, 0);
  const sumPointsEarned = series.reduce((s, x) => s + x.pointsEarned, 0);
  const sumPointsSpent = series.reduce((s, x) => s + x.pointsSpent, 0);

  const avgPeople = series.length ? Math.round((sumPeople / series.length) * 10) / 10 : 0;

  const best = [...series].sort((a, b) => b.totalPeople - a.totalPeople)[0] ?? null;

  const dailyRows = dayList.map((day) => {
    const vipSet = new Set<string>();
    let vipScans = 0;
    let pointsEarned = 0;

    for (const s of scans) {
      if (s.scan_date !== day) continue;
      vipScans += 1;
      pointsEarned += Number(s.points ?? 0);
      if (s.user_id) vipSet.add(String(s.user_id));
    }

    const guestSet = new Set<string>();
    let guestRows = 0;

    for (const g of guestCheckins) {
      if (g.day_et !== day) continue;
      guestRows += 1;
      const dev = (g.guest_device_id || g.device_id) ?? null;
      if (dev && String(dev).trim().length > 0) guestSet.add(String(dev));
    }

    const convSet = new Set<string>();
    for (const l of links) {
      const iso = l.linked_at ?? null;
      if (!iso) continue;
      const ymd = etIsoToEtYmd(iso);
      if (ymd !== day) continue;
      if (l.guest_device_id) convSet.add(String(l.guest_device_id));
    }

    let redCount = 0;
    let pointsSpent = 0;
    for (const r of redemptions) {
      const ymd = etIsoToEtYmd(r.created_at);
      if (ymd !== day) continue;
      redCount += 1;
      pointsSpent += Number(r.points_spent ?? 0);
    }

    const meta = dayMeta.get(day) ?? { eventLabel: "—", eventCount: 0, artistId: null };
    const uniqueVips = vipSet.size;
    const uniqueGuests = guestSet.size;
    const people = uniqueVips + uniqueGuests;

    return {
      day,
      dayLabel: formatDateEt(day),
      eventLabel: meta.eventLabel,
      uniqueVips,
      uniqueGuests,
      people,
      vipScans,
      pointsEarned,
      conversions: convSet.size,
      conversionRate: pct(convSet.size, uniqueGuests),
      redemptions: redCount,
      pointsSpent,
      artistId: meta.artistId,
    };
  });

  const topNights = [...dailyRows].sort((a, b) => b.people - a.people).slice(0, 10);

  const artistAgg = new Map<
    string,
    {
      artistId: string;
      name: string;
      nights: number;
      peopleSum: number;
      vipSum: number;
      guestSum: number;
      convSum: number;
      bestPeople: number;
      bestDay: string;
    }
  >();

  for (const d of dailyRows) {
    if (!d.artistId) continue;
    const artistName = artistNameById.get(d.artistId) ?? "Unknown artist";

    let a = artistAgg.get(d.artistId);
    if (!a) {
      a = {
        artistId: d.artistId,
        name: artistName,
        nights: 0,
        peopleSum: 0,
        vipSum: 0,
        guestSum: 0,
        convSum: 0,
        bestPeople: 0,
        bestDay: d.day,
      };
      artistAgg.set(d.artistId, a);
    }

    a.nights += 1;
    a.peopleSum += d.people;
    a.vipSum += d.uniqueVips;
    a.guestSum += d.uniqueGuests;
    a.convSum += d.conversions;

    if (d.people > a.bestPeople) {
      a.bestPeople = d.people;
      a.bestDay = d.day;
    }
  }

  const topArtists = Array.from(artistAgg.values())
    .map((a) => {
      const avgPeople2 = a.nights ? Math.round((a.peopleSum / a.nights) * 10) / 10 : 0;
      const vipPct = pct(a.vipSum, a.peopleSum);
      const convPct = pct(a.convSum, a.guestSum);
      return {
        ...a,
        avgPeople: avgPeople2,
        vipPct,
        convPct,
        bestDayLabel: formatDateEt(a.bestDay),
      };
    })
    .sort((a, b) => b.avgPeople - a.avgPeople)
    .slice(0, 12);

  // Keep everything sticky to query params
  const baseParams = { range: String(range), group, metric };

  // Trend metric helpers
  const metricLabel =
    metric === "vip" ? "VIP uniques" : metric === "guest" ? "Guest uniques" : "Total people";

  const metricValue = (s: (typeof series)[number]) =>
    metric === "vip" ? s.uniqueVips : metric === "guest" ? s.uniqueGuests : s.totalPeople;

  const maxMetric = Math.max(1, ...series.map((s) => metricValue(s)));

  let bestIdx = 0;
  for (let i = 1; i < series.length; i++) {
    if (metricValue(series[i]) > metricValue(series[bestIdx])) bestIdx = i;
  }

  return (
    <DashboardShell
      title="Venue Health"
      subtitle={`Trends + event correlation (${range}d, ${group}) · Timezone: ${ET_TZ}`}
      activeTab="dashboard"
    >
      <div className="space-y-8">
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Historical trends</h2>
              <p className="mt-1 text-sm text-slate-500">
                Attendance is{" "}
                <span className="font-semibold">unique VIPs + unique guest devices</span>. Conversions are{" "}
                <span className="font-semibold">guest devices linked to VIP</span>.
              </p>
            </div>

            {/* ✅ UPDATED: clean segmented controls (range + grouping) */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {/* Range (Last 7 / 30 / 90) */}
              <div className="inline-flex w-full overflow-hidden rounded-full border border-slate-200 bg-slate-50 sm:w-auto">
                <Link
                  href={
                    "/dashboard/venue-health" +
                    buildQueryString({ ...baseParams, range: 7 })
                  }
                  className={`px-4 py-2 text-xs font-semibold transition ${
                    range === 7 ? "bg-white text-slate-900" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  Last 7
                </Link>
                <Link
                  href={
                    "/dashboard/venue-health" +
                    buildQueryString({ ...baseParams, range: 30 })
                  }
                  className={`px-4 py-2 text-xs font-semibold transition ${
                    range === 30 ? "bg-white text-slate-900" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  Last 30
                </Link>
                <Link
                  href={
                    "/dashboard/venue-health" +
                    buildQueryString({ ...baseParams, range: 90 })
                  }
                  className={`px-4 py-2 text-xs font-semibold transition ${
                    range === 90 ? "bg-white text-slate-900" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  Last 90
                </Link>
              </div>

              {/* Grouping (Daily / Weekly / Monthly) */}
              <div className="inline-flex w-full overflow-hidden rounded-full border border-slate-200 bg-slate-50 sm:w-auto">
                <Link
                  href={
                    "/dashboard/venue-health" +
                    buildQueryString({ range, group: "day", metric })
                  }
                  className={`px-4 py-2 text-xs font-semibold transition ${
                    group === "day" ? "bg-white text-slate-900" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  Daily
                </Link>
                <Link
                  href={
                    "/dashboard/venue-health" +
                    buildQueryString({ range, group: "week", metric })
                  }
                  className={`px-4 py-2 text-xs font-semibold transition ${
                    group === "week" ? "bg-white text-slate-900" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  Weekly
                </Link>
                <Link
                  href={
                    "/dashboard/venue-health" +
                    buildQueryString({ range, group: "month", metric })
                  }
                  className={`px-4 py-2 text-xs font-semibold transition ${
                    group === "month" ? "bg-white text-slate-900" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  Monthly
                </Link>
              </div>
            </div>
          </div>

          {best ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <Pill tone="emerald">Best {group}</Pill>
              <span className="font-semibold text-slate-900">{best.label}</span>
              <span className="text-slate-500">·</span>
              <span className="font-semibold text-slate-900">{best.totalPeople}</span>
              <span className="text-slate-500">people</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-600">{best.eventLabel}</span>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Total people"
            value={sumPeople}
            helper={
              <>
                In selected range.{" "}
                <span className="text-slate-400">(Unique VIPs + unique guests per period)</span>
              </>
            }
          />
          <StatCard label="Avg per period" value={avgPeople} helper="Average people per day/week/month." />
          <StatCard
            label="VIP share"
            value={`${pct(sumVip, sumPeople)}%`}
            helper={
              <>
                VIP uniques: <span className="font-semibold text-slate-700">{sumVip}</span>
              </>
            }
          />
          <StatCard
            label="Guest → VIP"
            value={`${sumConversions} (${pct(sumConversions, sumGuest)}%)`}
            helper={
              <>
                From unique guests: <span className="font-semibold text-slate-700">{sumGuest}</span>
              </>
            }
          />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="VIP scan volume"
            value={series.reduce((s, x) => s + x.vipScans, 0)}
            helper="Total rewards_scans rows in range."
          />
          <StatCard
            label="Points earned"
            value={sumPointsEarned > 0 ? `+${sumPointsEarned}` : sumPointsEarned}
            helper="Points awarded from VIP scans."
          />
          <StatCard
            label="Redemptions"
            value={`${sumRedemptions}`}
            helper={
              <>
                Points spent: <span className="font-semibold text-slate-700">{sumPointsSpent}</span>
              </>
            }
          />
        </section>

        {/* ✅ NEW TREND: SVG LINE + AREA (scales for 7/30/90) + metric toggle */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Trend</h2>
              <p className="mt-1 text-sm text-slate-500">
                {metricLabel} per {group}. Hover points for exact values. Timezone: {ET_TZ}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Metric toggle */}
              <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                <Link
                  href={"/dashboard/venue-health" + buildQueryString({ range, group, metric: "total" })}
                  className={`px-4 py-2 text-xs font-semibold transition ${
                    metric === "total" ? "bg-white text-slate-900" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  Total
                </Link>
                <Link
                  href={"/dashboard/venue-health" + buildQueryString({ range, group, metric: "vip" })}
                  className={`px-4 py-2 text-xs font-semibold transition ${
                    metric === "vip" ? "bg-white text-slate-900" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  VIPs
                </Link>
                <Link
                  href={"/dashboard/venue-health" + buildQueryString({ range, group, metric: "guest" })}
                  className={`px-4 py-2 text-xs font-semibold transition ${
                    metric === "guest" ? "bg-white text-slate-900" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  Guests
                </Link>
              </div>

              <p className="text-xs text-slate-500">
                ET range: {formatDateEt(startEt)} → {formatDateEt(todayEt)}
              </p>
            </div>
          </div>

          {series.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No data in this range.</p>
          ) : (
            <div className="mt-5">
              <div className="rounded-3xl border border-slate-100 bg-slate-50 px-5 py-5">
                {(() => {
                  const W = 980; // virtual width for stable math (scales to container)
                  const H = 180;
                  const padX = 18;
                  const padTop = 14;
                  const padBottom = 34;

                  const n = series.length;
                  const xStep = n > 1 ? (W - padX * 2) / (n - 1) : 0;

                  const toX = (i: number) => padX + i * xStep;
                  const toY = (v: number) => {
                    const t = v / (maxMetric || 1);
                    const usable = H - padTop - padBottom;
                    return padTop + (1 - t) * usable;
                  };

                  const points = series.map((s, i) => ({
                    x: toX(i),
                    y: toY(metricValue(s)),
                    label: s.label,
                    metric: metricValue(s),
                    totalPeople: s.totalPeople,
                    uniqueVips: s.uniqueVips,
                    uniqueGuests: s.uniqueGuests,
                    eventLabel: s.eventLabel,
                  }));

                  const lineD = points
                    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
                    .join(" ");

                  const areaD = [
                    `M ${points[0].x.toFixed(2)} ${(H - padBottom).toFixed(2)}`,
                    ...points.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`),
                    `L ${points[points.length - 1].x.toFixed(2)} ${(H - padBottom).toFixed(2)}`,
                    "Z",
                  ].join(" ");

                  // Label cadence: fewer labels when there are many points
                  const step = n <= 10 ? 1 : n <= 20 ? 2 : n <= 45 ? 4 : n <= 70 ? 6 : 10;

                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                          <Pill tone="slate">Max</Pill>
                          <span className="font-semibold text-slate-900">{maxMetric}</span>
                          <span className="text-slate-500">{metric === "total" ? "people" : "uniques"}</span>
                          <span className="text-slate-400">·</span>
                          <Pill tone="emerald">Best</Pill>
                          <span className="font-semibold text-slate-900">{series[bestIdx]?.label}</span>
                          <span className="text-slate-500">({metricValue(series[bestIdx])})</span>
                        </div>

                        <p className="text-[11px] text-slate-400">Hover points for details.</p>
                      </div>

                      <div className="mt-4">
                        <svg
                          viewBox={`0 0 ${W} ${H}`}
                          className="h-48 w-full"
                          role="img"
                          aria-label="Venue health trend over time"
                          preserveAspectRatio="none"
                        >
                          {/* baseline */}
                          <line
                            x1={padX}
                            y1={H - padBottom}
                            x2={W - padX}
                            y2={H - padBottom}
                            stroke="rgba(148,163,184,0.6)"
                            strokeWidth="1"
                          />

                          {/* area */}
                          <path d={areaD} fill="rgba(148,163,184,0.25)" />

                          {/* line */}
                          <path
                            d={lineD}
                            fill="none"
                            stroke="rgba(71,85,105,0.9)"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />

                          {/* points */}
                          {points.map((p, i) => {
                            const isBest = i === bestIdx;
                            const showLabel = i % step === 0 || i === n - 1 || i === 0;

                            return (
                              <g key={`${p.x}-${p.y}`}>
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={isBest ? 4.5 : 3.3}
                                  fill={isBest ? "rgba(16,185,129,0.95)" : "rgba(71,85,105,0.95)"}
                                >
                                  <title>
                                    {`${p.label}: ${p.metric} ${
                                      metric === "total" ? "people" : "uniques"
                                    } • (Total ${p.totalPeople} / VIP ${p.uniqueVips} / Guests ${p.uniqueGuests}) • ${p.eventLabel}`}
                                  </title>
                                </circle>

                                {/* x labels */}
                                {showLabel ? (
                                  <text
                                    x={p.x}
                                    y={H - 12}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="rgba(100,116,139,0.95)"
                                    fontWeight="600"
                                  >
                                    {p.label.replace("Week of ", "")}
                                  </text>
                                ) : null}
                              </g>
                            );
                          })}
                        </svg>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">Works for 7 / 30 / 90</span>
                        <span className="text-slate-400">·</span>
                        <span>Line shows trend</span>
                        <span className="text-slate-400">·</span>
                        <span>Dots are exact periods</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Top nights</h2>
              <p className="mt-1 text-sm text-slate-500">
                Highest attendance days (VIP + guest). Uses fallback: artist name or SSDT Event (Title).
              </p>
            </div>
            <p className="text-xs text-slate-500">Showing top 10</p>
          </div>

          {topNights.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No nights found in range.</p>
          ) : (
            <>
              <div className="mt-5 grid gap-3 border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.8fr)]">
                <span>Date</span>
                <span>Event</span>
                <span className="text-right">People</span>
                <span className="text-right">VIPs</span>
                <span className="text-right">Guests</span>
                <span className="text-right">Conv</span>
                <span className="text-right">Redeem</span>
              </div>

              <div className="mt-1 space-y-2">
                {topNights.map((r) => (
                  <div
                    key={r.day}
                    className="grid items-center gap-3 rounded-3xl bg-slate-50 px-4 py-3 text-xs shadow-sm md:grid-cols-[minmax(0,1.1fr)_minmax(0,2.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.8fr)]"
                  >
                    <div className="text-[13px] font-semibold text-slate-900">{r.dayLabel}</div>

                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-slate-900">{r.eventLabel}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        VIP scans: {r.vipScans} · Points earned: {r.pointsEarned > 0 ? `+${r.pointsEarned}` : r.pointsEarned}
                      </div>
                    </div>

                    <div className="text-right font-semibold text-slate-900">{r.people}</div>
                    <div className="text-right text-slate-900">{r.uniqueVips}</div>
                    <div className="text-right text-slate-900">{r.uniqueGuests}</div>
                    <div className="text-right text-slate-900">
                      {r.conversions} <span className="text-[11px] font-semibold text-slate-500">({r.conversionRate}%)</span>
                    </div>
                    <div className="text-right text-slate-900">{r.redemptions}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Top artists (by avg attendance)</h2>
              <p className="mt-1 text-sm text-slate-500">
                Only nights with an <span className="font-semibold">artist_id</span> are included (SSDT Events without an artist are excluded).
              </p>
            </div>
            <p className="text-xs text-slate-500">Showing top 12</p>
          </div>

          {topArtists.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No artist-linked nights found in this range.</p>
          ) : (
            <>
              <div className="mt-5 grid gap-3 border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
                <span>Artist</span>
                <span className="text-right">Nights</span>
                <span className="text-right">Avg people</span>
                <span className="text-right">VIP %</span>
                <span className="text-right">Conv %</span>
              </div>

              <div className="mt-1 space-y-2">
                {topArtists.map((a) => (
                  <div
                    key={a.artistId}
                    className="grid items-center gap-3 rounded-3xl bg-slate-50 px-4 py-3 text-xs shadow-sm md:grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-slate-900">{a.name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Best night: {a.bestPeople} people · {a.bestDayLabel}
                      </div>
                    </div>

                    <div className="text-right text-slate-900">{a.nights}</div>
                    <div className="text-right font-semibold text-slate-900">{a.avgPeople}</div>
                    <div className="text-right text-slate-900">{a.vipPct}%</div>
                    <div className="text-right text-slate-900">{a.convPct}%</div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[11px] text-slate-400">
                Note: Weekly/monthly “uniques” are unique across the period (not sum of daily uniques).
              </p>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
