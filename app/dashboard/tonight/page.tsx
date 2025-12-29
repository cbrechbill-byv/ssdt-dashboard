// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\dashboard\tonight\page.tsx
// app/dashboard/tonight/page.tsx
// Path: /dashboard/tonight
// Purpose: Live "Tonight's Check-Ins" board for Sugarshack Downtown.
// Shows VIP check-ins (rewards_scans) + Guest check-ins (guest_checkins), lifetime points/visits,
// and any redemptions today.
// Fix: ALL “today” logic America/New_York, and render timestamps in America/New_York.
//
// Mobile usability fix (NO UI redesign):
// - Reduce section padding on small screens (px-4 sm:px-6 lg:px-8).
// - Wrap VIP + Guest "tables" in overflow-x-auto + min-width so columns remain readable on phones.
// - Desktop layout remains unchanged.

import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { TonightAutoRefresh } from "./AutoRefreshClient";

export const revalidate = 0; // always fresh when requested

const ET_TZ = "America/New_York";

type ScanRow = {
  id: string;
  user_id: string;
  points: number;
  scanned_at: string;
  source: string;
  note: string | null;
};

type VipOverviewRow = {
  user_id: string;
  phone: string | null;
  full_name: string | null;
  email: string | null;
  zip: string | null;
  is_vip: boolean | null;
  total_points: number | null;
  total_visits: number | null;
  first_scan_at: string | null;
  last_scan_at: string | null;
};

type RedemptionRow = {
  user_id: string;
  reward_name: string;
  points_spent: number;
  created_at: string;
};

type GuestCheckinRow = {
  id: string;
  guest_device_id: string | null;
  device_id: string | null; // legacy/optional
  platform: string | null;
  app_version: string | null;
  source: string | null;
  qr_code: string | null;
  day_et: string | null; // date
  scanned_at: string | null; // timestamptz
  checked_in_at: string | null; // legacy/optional
};

type TonightRow = {
  userId: string;
  name: string;
  phone: string;
  email: string;
  isVip: boolean;
  lifetimePoints: number;
  lifetimeVisits: number;
  firstScan: string | null;
  lastScan: string | null;
  checkinsToday: number;
  pointsToday: number;
  firstScanToday: string | null;
  lastScanToday: string | null;
  redemptionsToday: number;
  lastRedemptionName: string | null;
  lastRedemptionAt: string | null;
};

// ✅ FIX: guest_device_links now uses linked_at (not first/last_linked_at)
type GuestDeviceLinkRow = {
  guest_device_id: string;
  user_id: string;
  linked_at: string | null;
};

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
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

function formatTimeEt(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    timeZone: ET_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDateTimeEt(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: ET_TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPhoneLocal(raw: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits;
}

function shortDevice(id: string | null | undefined) {
  if (!id) return "—";
  const s = String(id);
  if (s.length <= 8) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function getGuestTimestampIso(g: GuestCheckinRow): string | null {
  // prefer scanned_at, fall back to checked_in_at
  return g.scanned_at ?? g.checked_in_at ?? null;
}

// 15-min bucket label + sortKey in ET
function bucket15mEtWithKey(iso: string): { label: string; sortKey: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);

  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "00";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";

  const hour12 = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour12) || !Number.isFinite(minute)) return null;

  const bucketMin = Math.floor(minute / 15) * 15;
  const bucketMinStr = String(bucketMin).padStart(2, "0");

  // Convert 12h -> minutes since midnight for sorting
  const isPM = String(dayPeriod).toLowerCase().includes("pm");
  let hour24 = hour12 % 12;
  if (isPM) hour24 += 12;
  const sortKey = hour24 * 60 + bucketMin;

  return { label: `${hour12}:${bucketMinStr} ${dayPeriod}`, sortKey };
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
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
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

  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}

// ✅ NEW: Pace badge based on UNIQUE people in last 30 minutes
function getPaceBadge(last30UniquePeople: number): {
  label: "Busy" | "Steady" | "Slow";
  tone: "emerald" | "amber" | "slate";
} {
  // Tune thresholds any time:
  // Busy: 25+ unique people / 30 min
  // Steady: 10–24
  // Slow: <10
  if (last30UniquePeople >= 25) return { label: "Busy", tone: "emerald" };
  if (last30UniquePeople >= 10) return { label: "Steady", tone: "amber" };
  return { label: "Slow", tone: "slate" };
}

export default async function TonightDashboardPage() {
  const supabase = supabaseServer;

  // ✅ 1) "Today" in Florida time
  const todayEt = getEtYmd();

  // ✅ deltas window
  const thirtyMinAgoIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // ✅ 2) VIP scans today
  const { data: scansData, error: scansError } = await supabase
    .from("rewards_scans")
    .select("id, user_id, points, scanned_at, source, note")
    .eq("scan_date", todayEt)
    .order("scanned_at", { ascending: false });

  if (scansError) console.error("[tonight] scans error", scansError);

  const scans: ScanRow[] = (scansData ?? []) as ScanRow[];

  const userIds = Array.from(new Set(scans.map((s) => s.user_id).filter(Boolean)));

  // ✅ 3) VIP overview rows
  let vipOverviewRows: VipOverviewRow[] = [];
  if (userIds.length > 0) {
    const { data, error } = await supabase
      .from("rewards_user_overview")
      .select(
        "user_id, phone, full_name, email, zip, is_vip, total_points, total_visits, first_scan_at, last_scan_at"
      )
      .in("user_id", userIds);

    if (error) console.error("[tonight] rewards_user_overview error", error);
    else vipOverviewRows = (data ?? []) as VipOverviewRow[];
  }

  // ✅ 4) Redemptions today (ET boundaries -> UTC ISO)
  const dayStartUtc = etWallClockToUtcIso(todayEt, "00:00:00");
  const dayEndUtc = etWallClockToUtcIso(todayEt, "23:59:59");

  const { data: redemptionsData, error: redemptionsError } = await supabase
    .from("rewards_redemptions")
    .select("user_id, reward_name, points_spent, created_at")
    .gte("created_at", dayStartUtc)
    .lte("created_at", dayEndUtc)
    .order("created_at", { ascending: false });

  if (redemptionsError) console.error("[tonight] redemptions error", redemptionsError);

  const redemptions: RedemptionRow[] = (redemptionsData ?? []) as RedemptionRow[];

  // ✅ 5) Guest check-ins today
  const { data: guestData, error: guestError } = await supabase
    .from("guest_checkins")
    .select(
      "id, guest_device_id, device_id, platform, app_version, source, qr_code, day_et, scanned_at, checked_in_at"
    )
    .eq("day_et", todayEt)
    .order("scanned_at", { ascending: false });

  if (guestError) console.error("[tonight] guest_checkins error", guestError);

  const guestCheckins: GuestCheckinRow[] = (guestData ?? []) as GuestCheckinRow[];

  // 6) Aggregate VIP per user (existing behavior)
  const userAgg = new Map<string, TonightRow>();

  for (const scan of scans) {
    const userId = scan.user_id;
    if (!userId) continue;

    let row = userAgg.get(userId);
    if (!row) {
      const overview = vipOverviewRows.find((v) => v.user_id === userId);

      row = {
        userId,
        name:
          (overview?.full_name && overview.full_name.trim().length > 0
            ? overview.full_name
            : "Unknown guest") ?? "Unknown guest",
        phone: formatPhoneLocal(overview?.phone ?? null),
        email: overview?.email ?? "",
        isVip: overview?.is_vip ?? false,
        lifetimePoints: overview?.total_points ?? 0,
        lifetimeVisits: overview?.total_visits ?? 0,
        firstScan: overview?.first_scan_at ?? null,
        lastScan: overview?.last_scan_at ?? null,
        checkinsToday: 0,
        pointsToday: 0,
        firstScanToday: null,
        lastScanToday: null,
        redemptionsToday: 0,
        lastRedemptionName: null,
        lastRedemptionAt: null,
      };

      userAgg.set(userId, row);
    }

    row.checkinsToday += 1;
    row.pointsToday += scan.points;

    if (!row.firstScanToday || scan.scanned_at < row.firstScanToday) row.firstScanToday = scan.scanned_at;
    if (!row.lastScanToday || scan.scanned_at > row.lastScanToday) row.lastScanToday = scan.scanned_at;
  }

  for (const r of redemptions) {
    const userId = r.user_id;
    if (!userId) continue;

    let row = userAgg.get(userId);
    if (!row) {
      const overview = vipOverviewRows.find((v) => v.user_id === userId);

      row = {
        userId,
        name:
          (overview?.full_name && overview.full_name.trim().length > 0
            ? overview.full_name
            : "Unknown guest") ?? "Unknown guest",
        phone: formatPhoneLocal(overview?.phone ?? null),
        email: overview?.email ?? "",
        isVip: overview?.is_vip ?? false,
        lifetimePoints: overview?.total_points ?? 0,
        lifetimeVisits: overview?.total_visits ?? 0,
        firstScan: overview?.first_scan_at ?? null,
        lastScan: overview?.last_scan_at ?? null,
        checkinsToday: 0,
        pointsToday: 0,
        firstScanToday: null,
        lastScanToday: null,
        redemptionsToday: 0,
        lastRedemptionName: null,
        lastRedemptionAt: null,
      };

      userAgg.set(userId, row);
    }

    row.redemptionsToday += 1;
    if (!row.lastRedemptionAt || r.created_at > row.lastRedemptionAt) {
      row.lastRedemptionAt = r.created_at;
      row.lastRedemptionName = r.reward_name;
    }
  }

  const tonightRows: TonightRow[] = Array.from(userAgg.values()).sort((a, b) => {
    const aKey = a.lastScanToday ?? a.lastRedemptionAt ?? a.lastScan ?? "";
    const bKey = b.lastScanToday ?? b.lastRedemptionAt ?? b.lastScan ?? "";
    return aKey < bKey ? 1 : aKey > bKey ? -1 : 0;
  });

  // Summary stats (VIP)
  const totalVipVisitsToday = scans.length; // scan rows
  const uniqueVipCount = tonightRows.length; // distinct VIP users with scans today
  const totalPointsToday = scans.reduce((sum, s) => sum + (s.points ?? 0), 0);
  const totalRedemptionsToday = redemptions.length;

  // Summary stats (Guest)
  const totalGuestCheckinsToday = guestCheckins.length;

  const guestDeviceIdsToday = Array.from(
    new Set(
      guestCheckins
        .map((g) => g.guest_device_id || g.device_id)
        .filter((x): x is string => !!x && String(x).trim().length > 0)
        .map((x) => String(x))
    )
  );
  const uniqueGuestDevicesToday = guestDeviceIdsToday.length;

  const totalPeopleTonight = uniqueVipCount + uniqueGuestDevicesToday;

  // ✅ Guest → VIP conversion metric (Guests tonight who became VIP tonight)
  let guestToVipConversionsToday = 0;

  // deltas (last 30 min)
  const vipVisitsLast30 = scans.filter((s) => !!s.scanned_at && s.scanned_at >= thirtyMinAgoIso).length;
  const guestsLast30 = guestCheckins.filter((g) => {
    const ts = getGuestTimestampIso(g);
    return !!ts && ts >= thirtyMinAgoIso;
  }).length;

  // ✅ NEW: UNIQUE people last 30 min (VIP users + guest devices), used for pace badge
  const vipUniqueLast30 = new Set<string>();
  for (const s of scans) {
    if (!s.user_id) continue;
    if (s.scanned_at && s.scanned_at >= thirtyMinAgoIso) vipUniqueLast30.add(String(s.user_id));
  }

  const guestUniqueLast30 = new Set<string>();
  for (const g of guestCheckins) {
    const ts = getGuestTimestampIso(g);
    if (!ts || ts < thirtyMinAgoIso) continue;
    const dev = (g.guest_device_id || g.device_id) ?? null;
    if (!dev || String(dev).trim().length === 0) continue;
    guestUniqueLast30.add(String(dev));
  }

  const last30UniquePeople = vipUniqueLast30.size + guestUniqueLast30.size;
  const pace = getPaceBadge(last30UniquePeople);

  let guestToVipConversionsLast30 = 0;

  if (guestDeviceIdsToday.length > 0) {
    const { data: linksData, error: linksErr } = await supabase
      .from("guest_device_links")
      .select("guest_device_id, user_id, linked_at")
      .in("guest_device_id", guestDeviceIdsToday);

    if (linksErr) {
      console.error("[tonight] guest_device_links error", JSON.stringify(linksErr));
    } else {
      const links = (linksData ?? []) as unknown as GuestDeviceLinkRow[];

      const start = new Date(dayStartUtc).getTime();
      const end = new Date(dayEndUtc).getTime();
      const last30 = new Date(thirtyMinAgoIso).getTime();

      const convertedSet = new Set<string>();
      const convertedSetLast30 = new Set<string>();

      for (const l of links) {
        const ts = l.linked_at ?? null;
        if (!ts) continue;
        const t = new Date(ts).getTime();
        if (Number.isNaN(t)) continue;

        if (t >= start && t <= end) convertedSet.add(String(l.guest_device_id));
        if (t >= last30 && t <= end) convertedSetLast30.add(String(l.guest_device_id));
      }

      guestToVipConversionsToday = convertedSet.size;
      guestToVipConversionsLast30 = convertedSetLast30.size;
    }
  }

  const guestToVipConversionRate =
    uniqueGuestDevicesToday > 0
      ? Math.round((guestToVipConversionsToday / uniqueGuestDevicesToday) * 1000) / 10
      : 0;

  // Peak time buckets (VIP + Guest together, 15-min)
  const bucketCounts = new Map<string, number>();
  const bucketSortKey = new Map<string, number>();

  for (const s of scans) {
    const bk = bucket15mEtWithKey(s.scanned_at);
    if (!bk) continue;
    bucketCounts.set(bk.label, (bucketCounts.get(bk.label) ?? 0) + 1);
    bucketSortKey.set(bk.label, bk.sortKey);
  }
  for (const g of guestCheckins) {
    const ts = getGuestTimestampIso(g);
    if (!ts) continue;
    const bk = bucket15mEtWithKey(ts);
    if (!bk) continue;
    bucketCounts.set(bk.label, (bucketCounts.get(bk.label) ?? 0) + 1);
    bucketSortKey.set(bk.label, bk.sortKey);
  }

  const peakBuckets = Array.from(bucketCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const peakWindowLabel = peakBuckets.length > 0 ? peakBuckets[0][0] : null;
  const peakWindowCount = peakBuckets.length > 0 ? peakBuckets[0][1] : 0;

  // Activity strip series (chronological; keep last ~28 buckets)
  const chartSeriesAll = Array.from(bucketCounts.entries())
    .map(([label, count]) => ({ label, count, sortKey: bucketSortKey.get(label) ?? 0 }))
    .sort((a, b) => a.sortKey - b.sortKey);

  const chartSeries =
    chartSeriesAll.length > 28 ? chartSeriesAll.slice(chartSeriesAll.length - 28) : chartSeriesAll;

  // Guest diagnostics (ops)
  const missingDeviceCount = guestCheckins.filter(
    (g) =>
      !(g.guest_device_id || g.device_id) || String(g.guest_device_id || g.device_id).trim().length === 0
  ).length;

  const platformCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();

  for (const g of guestCheckins) {
    const p = (g.platform ?? "Unknown").trim() || "Unknown";
    platformCounts.set(p, (platformCounts.get(p) ?? 0) + 1);

    const s = (g.source ?? "Unknown").trim() || "Unknown";
    sourceCounts.set(s, (sourceCounts.get(s) ?? 0) + 1);
  }

  const topPlatform = Array.from(platformCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const topSource = Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const guestRecent = guestCheckins.slice(0, 30);

  // Summary sentence
  const tonightSummary = `Tonight so far: ${totalPeopleTonight} people — ${uniqueVipCount} VIPs, ${uniqueGuestDevicesToday} guests · ${guestToVipConversionsToday} new VIPs (${guestToVipConversionRate}%).`;

  // ===== Activity line helpers (match Venue Health) =====
  const activityMetricValue = (x: { count: number }) => x.count;
  const activityMax = Math.max(1, ...chartSeries.map((x) => activityMetricValue(x)));

  let activityBestIdx = 0;
  for (let i = 1; i < chartSeries.length; i++) {
    if (activityMetricValue(chartSeries[i]) > activityMetricValue(chartSeries[activityBestIdx])) activityBestIdx = i;
  }

  return (
    <DashboardShell
      title="Tonight at Sugarshack"
      subtitle={`Live VIP + Guest check-ins, points and redemptions for tonight only. (Timezone: ${ET_TZ})`}
      activeTab="dashboard"
    >
      <TonightAutoRefresh intervalMs={20000} />

      <div className="space-y-8">
        {/* HERO SUMMARY (ops-first) */}
        <section className="rounded-3xl border border-slate-100 bg-white px-4 py-6 shadow-sm sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900">
                {tonightSummary}
                <span
                  className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    pace.tone === "emerald"
                      ? "bg-emerald-100 text-emerald-700"
                      : pace.tone === "amber"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                  title={`Unique people in last 30 minutes: ${last30UniquePeople} (VIP users + guest devices)`}
                >
                  {pace.label}
                </span>
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Last 30 min: {last30UniquePeople} unique people (VIP: {vipUniqueLast30.size}, Guests:{" "}
                {guestUniqueLast30.size}) · +{guestToVipConversionsLast30} new VIP links.
              </p>

              <p className="mt-1 text-[11px] text-slate-400">
                {peakWindowLabel
                  ? `Peak window so far: ${peakWindowLabel} (${peakWindowCount} check-ins).`
                  : "Peak window so far: —"}
              </p>
            </div>

            {/* ✅ Removed pills per request */}
          </div>
        </section>

        {/* PRIMARY KPIs (balanced: 4) */}
        <section className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Total people tonight"
            value={totalPeopleTonight}
            helper="Unique VIPs + unique guest devices (ET day)."
          />
          <StatCard
            label="Unique VIPs"
            value={uniqueVipCount}
            helper={
              <>
                VIP users with activity today.{" "}
                <span className="text-slate-400">(+{vipUniqueLast30.size} unique last 30 min)</span>
              </>
            }
          />
          <StatCard
            label="Unique guests"
            value={uniqueGuestDevicesToday}
            helper={
              <>
                Device-based (1/device/day).{" "}
                <span className="text-slate-400">(+{guestUniqueLast30.size} unique last 30 min)</span>
              </>
            }
          />
          <StatCard
            label="Guest → VIP"
            value={
              <>
                {guestToVipConversionsToday}{" "}
                <span className="text-sm font-semibold text-slate-500">({guestToVipConversionRate}%)</span>
              </>
            }
            helper={
              <>
                Guest devices linked to VIP today.{" "}
                <span className="text-slate-400">(+{guestToVipConversionsLast30} last 30 min)</span>
              </>
            }
          />
        </section>

        {/* SECONDARY KPIs (details: 3) */}
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard label="VIP scan volume" value={totalVipVisitsToday} helper="All rewards_scans rows today (any source)." />
          <StatCard
            label="Points net today"
            value={totalPointsToday > 0 ? `+${totalPointsToday}` : totalPointsToday}
            helper="VIP points earned today (from scans)."
          />
          <StatCard label="Redemptions today" value={totalRedemptionsToday} helper="All rewards_redemptions today (ET day bounds)." />
        </section>

        {/* Activity over time */}
        <section className="rounded-3xl border border-slate-100 bg-white px-4 py-6 shadow-sm sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Activity over time</h2>
              <p className="mt-1 text-sm text-slate-500">
                Check-ins per 15-minute bucket (VIP + Guest combined). Hover points for exact values.
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {peakWindowLabel
                  ? `Peak window so far: ${peakWindowLabel} (${peakWindowCount} check-ins).`
                  : "Peak window so far: —"}
              </p>
            </div>
            <p className="text-xs text-slate-500">Last update: {formatShortDateTimeEt(new Date().toISOString())}</p>
          </div>

          {chartSeries.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No check-ins recorded yet today.</p>
          ) : (
            <div className="mt-5">
              <div className="rounded-3xl border border-slate-100 bg-slate-50 px-5 py-5">
                {(() => {
                  const W = 980;
                  const H = 180;
                  const padX = 18;
                  const padTop = 14;
                  const padBottom = 34;

                  const n = chartSeries.length;
                  const xStep = n > 1 ? (W - padX * 2) / (n - 1) : 0;

                  const toX = (i: number) => padX + i * xStep;
                  const toY = (v: number) => {
                    const t = v / (activityMax || 1);
                    const usable = H - padTop - padBottom;
                    return padTop + (1 - t) * usable;
                  };

                  const points = chartSeries.map((s, i) => ({
                    x: toX(i),
                    y: toY(activityMetricValue(s)),
                    label: s.label,
                    count: s.count,
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

                  const step = n <= 10 ? 1 : n <= 16 ? 2 : n <= 24 ? 3 : 4;

                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                          <Pill tone="slate">Max</Pill>
                          <span className="font-semibold text-slate-900">{activityMax}</span>
                          <span className="text-slate-500">per bucket</span>
                          <span className="text-slate-400">·</span>
                          <Pill tone="emerald">Peak</Pill>
                          <span className="font-semibold text-slate-900">{chartSeries[activityBestIdx]?.label}</span>
                          <span className="text-slate-500">({chartSeries[activityBestIdx]?.count})</span>
                        </div>

                        <p className="text-[11px] text-slate-400">15-minute buckets · ET time</p>
                      </div>

                      <div className="mt-4">
                        <svg
                          viewBox={`0 0 ${W} ${H}`}
                          className="h-48 w-full"
                          role="img"
                          aria-label="Tonight activity over time"
                          preserveAspectRatio="none"
                        >
                          <line
                            x1={padX}
                            y1={H - padBottom}
                            x2={W - padX}
                            y2={H - padBottom}
                            stroke="rgba(148,163,184,0.6)"
                            strokeWidth="1"
                          />

                          <path d={areaD} fill="rgba(148,163,184,0.25)" />

                          <path
                            d={lineD}
                            fill="none"
                            stroke="rgba(71,85,105,0.9)"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />

                          {points.map((p, i) => {
                            const isPeak = i === activityBestIdx;
                            const showLabel = i % step === 0 || i === n - 1 || i === 0;

                            return (
                              <g key={`${p.x}-${p.y}`}>
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={isPeak ? 4.5 : 3.3}
                                  fill={isPeak ? "rgba(16,185,129,0.95)" : "rgba(71,85,105,0.95)"}
                                >
                                  <title>{`${p.label}: ${p.count} check-ins`}</title>
                                </circle>

                                {showLabel ? (
                                  <text
                                    x={p.x}
                                    y={H - 12}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="rgba(100,116,139,0.95)"
                                    fontWeight="600"
                                  >
                                    {p.label.replace(":00", "")}
                                  </text>
                                ) : null}
                              </g>
                            );
                          })}
                        </svg>
                      </div>

                      <p className="mt-3 text-[11px] text-slate-400">
                        Hover a dot to see exact counts. Labels are intentionally sparse to keep the chart clean.
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </section>

        {/* GUEST DIAGNOSTICS (ops) */}
        <section className="rounded-3xl border border-slate-100 bg-white px-4 py-6 shadow-sm sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Guest diagnostics</h2>
              <p className="mt-1 text-sm text-slate-500">Quick signals that help catch device / scanning issues fast.</p>
            </div>
            <p className="text-xs text-slate-500">Timezone: {ET_TZ}</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Top platform</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{topPlatform}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Top source</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{topSource}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Missing device id</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {missingDeviceCount}{" "}
                <span className="text-xs font-semibold text-slate-500">
                  ({totalGuestCheckinsToday > 0 ? Math.round((missingDeviceCount / totalGuestCheckinsToday) * 100) : 0}
                  %)
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* VIP TABLE */}
        <section className="rounded-3xl border border-slate-100 bg-white px-4 py-6 shadow-sm sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Tonight&apos;s VIP guests</h2>
              <p className="mt-1 text-sm text-slate-500">Recognize VIPs and watch points &amp; redemptions roll in.</p>
              <p className="mt-1 text-[11px] text-slate-400">Timezone: {ET_TZ} (Florida time)</p>
            </div>
          </div>

          {tonightRows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No VIP check-ins recorded for today yet. Once VIPs scan the QR code, you&apos;ll see them here.
            </p>
          ) : (
            <>
              {/* ✅ Mobile-safe: horizontal scroll wrapper for the whole "table" */}
              <div className="mt-5 overflow-x-auto rounded-2xl">
                <div className="min-w-[980px]">
                  <div className="grid gap-3 border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[minmax(0,2.1fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.6fr)]">
                    <span>Guest</span>
                    <span>Phone</span>
                    <span className="text-right">Lifetime pts</span>
                    <span className="text-right">Lifetime visits</span>
                    <span className="text-right">Check-ins today</span>
                    <span className="text-right">Points today</span>
                    <span>Last activity</span>
                    <span>Reward today</span>
                  </div>

                  <div className="mt-1 space-y-2">
                    {tonightRows.map((row) => {
                      const lastActivityIso = row.lastRedemptionAt ?? row.lastScanToday ?? row.lastScan ?? null;

                      const lastType =
                        row.lastRedemptionAt && (!row.lastScanToday || row.lastRedemptionAt >= row.lastScanToday)
                          ? "redemption"
                          : "scan";

                      return (
                        <div
                          key={row.userId}
                          className="grid items-center gap-3 rounded-3xl bg-slate-50 px-4 py-3 text-xs shadow-sm md:grid-cols-[minmax(0,2.1fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.6fr)]"
                        >
                          <div className="flex flex-col gap-0.5">
                            <Link
                              href={`/rewards/vips/${row.userId}/insights`}
                              className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-900 hover:text-amber-600"
                            >
                              <span className="truncate">{row.name}</span>
                              {row.isVip && <Pill tone="emerald">VIP</Pill>}
                              <Pill tone={lastType === "redemption" ? "amber" : "slate"}>
                                {lastType === "redemption" ? "Redemption" : "Scan"}
                              </Pill>
                            </Link>
                            {row.email && <span className="text-[11px] text-slate-500">{row.email}</span>}
                          </div>

                          <div className="text-[13px] text-slate-900">{row.phone || "—"}</div>

                          <div className="text-right font-semibold text-slate-900">{row.lifetimePoints}</div>

                          <div className="text-right text-slate-900">{row.lifetimeVisits}</div>

                          <div className="text-right text-slate-900">{row.checkinsToday}</div>

                          <div className="text-right text-slate-900">
                            {row.pointsToday > 0 ? `+${row.pointsToday}` : row.pointsToday}
                          </div>

                          <div className="text-slate-900">{formatTimeEt(lastActivityIso)}</div>

                          <div className="text-slate-900">
                            {row.redemptionsToday > 0
                              ? `${row.redemptionsToday}× ${row.lastRedemptionName ?? "Reward"}`
                              : "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* GUEST TABLE */}
        <section className="rounded-3xl border border-slate-100 bg-white px-4 py-6 shadow-sm sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Tonight&apos;s guest check-ins</h2>
              <p className="mt-1 text-sm text-slate-500">
                Guests are tracked by device (one per device per ET day). Great for sponsor analytics.
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Timezone: {ET_TZ} (Florida time)</p>
            </div>

            {guestRecent.length > 0 && <p className="text-xs text-slate-500">Showing most recent {guestRecent.length}</p>}
          </div>

          {guestCheckins.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No guest check-ins recorded for today yet.</p>
          ) : (
            <>
              {/* ✅ Mobile-safe: horizontal scroll wrapper for the whole "table" */}
              <div className="mt-5 overflow-x-auto rounded-2xl">
                <div className="min-w-[720px]">
                  <div className="grid gap-3 border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                    <span>Time</span>
                    <span>Device</span>
                    <span>Platform</span>
                    <span>Source</span>
                    <span>App version</span>
                  </div>

                  <div className="mt-1 space-y-2">
                    {guestRecent.map((g) => {
                      const ts = getGuestTimestampIso(g);
                      const device = (g.guest_device_id || g.device_id) ?? null;

                      return (
                        <div
                          key={g.id}
                          className="grid items-center gap-3 rounded-3xl bg-slate-50 px-4 py-3 text-xs shadow-sm md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]"
                        >
                          <div className="text-[13px] font-semibold text-slate-900">{formatTimeEt(ts)}</div>
                          <div className="text-slate-900">{shortDevice(device)}</div>
                          <div className="text-slate-900">{g.platform || "—"}</div>
                          <div className="text-slate-900">{g.source || "—"}</div>
                          <div className="text-slate-900">{g.app_version || "—"}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
