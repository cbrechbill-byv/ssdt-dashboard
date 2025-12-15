// app/dashboard/tonight/page.tsx
// Path: /dashboard/tonight
// Purpose: Live "Tonight's Check-Ins" board for Sugarshack Downtown.
// Shows who checked in today, their lifetime points/visits, and any redemptions today.
// Sprint 8: Fix “off by a day” + time drift by making ALL “today” logic America/New_York,
//          and rendering timestamptz timestamps in America/New_York.
//
// Why you were seeing issues:
// - You were doing `new Date().toISOString().slice(0,10)` which is a UTC day.
//   After ~7pm–8pm ET (depending on DST), UTC is already “tomorrow”, so your “today” filters shift.
// - You also filtered redemptions by UTC dayStart/dayEnd which can exclude/include the wrong rows for ET “today”.
// Fix: compute ET date, convert ET day boundaries to UTC ISO strings for timestamptz filtering, and display with timeZone.

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
 * This is robust across DST because the offset comes from the target date.
 */
function etWallClockToUtcIso(ymd: string, hmss: string): string {
  // ymd: "YYYY-MM-DD", hmss: "HH:MM:SS"
  const [Y, M, D] = ymd.split("-").map((x) => Number(x));
  const [h, m, s] = hmss.split(":").map((x) => Number(x));

  // Start with a UTC timestamp with the same wall-clock components.
  // We'll then adjust it by the ET offset for that moment.
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
  // tzPart looks like "GMT-5" or "GMT-4" (DST)
  const match = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = match?.[1] === "-" ? -1 : 1;
  const offH = match ? Number(match[2]) : 0;
  const offM = match?.[3] ? Number(match[3]) : 0;
  const offsetMinutes = sign * (offH * 60 + offM);

  // ET local time = UTC + offsetMinutes
  // => UTC = local - offsetMinutes
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

export default async function TonightDashboardPage() {
  const supabase = supabaseServer;

  // ✅ 1) "Today" in Florida time (matches your intended business day)
  const todayEt = getEtYmd();

  // ✅ 2) Pull today's scans (scan_date is DATE, so compare with ET YYYY-MM-DD)
  const { data: scansData, error: scansError } = await supabase
    .from("rewards_scans")
    .select("id, user_id, points, scanned_at, source, note")
    .eq("scan_date", todayEt)
    .order("scanned_at", { ascending: false });

  if (scansError) {
    console.error("[tonight] scans error", scansError);
  }

  const scans: ScanRow[] = (scansData ?? []) as ScanRow[];

  const userIds = Array.from(new Set(scans.map((s) => s.user_id).filter(Boolean)));

  // ✅ 3) VIP overview rows for those users
  let vipOverviewRows: VipOverviewRow[] = [];
  if (userIds.length > 0) {
    const { data, error } = await supabase
      .from("rewards_user_overview")
      .select(
        "user_id, phone, full_name, email, zip, is_vip, total_points, total_visits, first_scan_at, last_scan_at"
      )
      .in("user_id", userIds);

    if (error) {
      console.error("[tonight] rewards_user_overview error", error);
    } else {
      vipOverviewRows = (data ?? []) as VipOverviewRow[];
    }
  }

  // ✅ 4) Pull today's redemptions using ET-day boundaries converted to UTC ISO (created_at is timestamptz)
  const dayStartUtc = etWallClockToUtcIso(todayEt, "00:00:00");
  const dayEndUtc = etWallClockToUtcIso(todayEt, "23:59:59");

  const { data: redemptionsData, error: redemptionsError } = await supabase
    .from("rewards_redemptions")
    .select("user_id, reward_name, points_spent, created_at")
    .gte("created_at", dayStartUtc)
    .lte("created_at", dayEndUtc)
    .order("created_at", { ascending: false });

  if (redemptionsError) {
    console.error("[tonight] redemptions error", redemptionsError);
  }

  const redemptions: RedemptionRow[] = (redemptionsData ?? []) as RedemptionRow[];

  // 5) Aggregate per user
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

    if (!row.firstScanToday || scan.scanned_at < row.firstScanToday) {
      row.firstScanToday = scan.scanned_at;
    }
    if (!row.lastScanToday || scan.scanned_at > row.lastScanToday) {
      row.lastScanToday = scan.scanned_at;
    }
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

  // Summary stats
  const totalVisitsToday = scans.length;
  const uniqueVipCount = tonightRows.length;
  const totalPointsToday = scans.reduce((sum, s) => sum + (s.points ?? 0), 0);
  const totalRedemptionsToday = redemptions.length;

  return (
    <DashboardShell
      title="Tonight at Sugarshack"
      subtitle={`Live VIP check-ins, points and redemptions for tonight only. (Timezone: ${ET_TZ})`}
      activeTab="dashboard"
    >
      {/* Auto-refresh this board every ~20 seconds */}
      <TonightAutoRefresh intervalMs={20000} />

      <div className="space-y-8">
        {/* Summary cards */}
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Visits today
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {totalVisitsToday}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Total scans recorded with today&apos;s date.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Unique VIPs today
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {uniqueVipCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Distinct guests who checked in or redeemed.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Points net today
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {totalPointsToday > 0 ? `+${totalPointsToday}` : totalPointsToday}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Positive check-ins minus any negative adjustments.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rewards redeemed today
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {totalRedemptionsToday}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Number of rewards redeemed from the menu.
            </p>
          </div>
        </section>

        {/* Tonight's guests table */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Tonight&apos;s VIP guests
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Use this as a live board at the host stand or bar to recognize
                frequent visitors and watch points &amp; redemptions roll in.
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Timezone: {ET_TZ} (Florida time)
              </p>
            </div>
            {tonightRows.length > 0 && (
              <p className="text-xs text-slate-500">
                Last update: {formatShortDateTimeEt(new Date().toISOString())}
              </p>
            )}
          </div>

          {tonightRows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No check-ins recorded for today yet. Once guests scan the QR code
              from the app, you&apos;ll see them here.
            </p>
          ) : (
            <>
              {/* Header row */}
              <div className="mt-5 grid gap-3 border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[minmax(0,2.1fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.6fr)]">
                <span>Guest</span>
                <span>Phone</span>
                <span className="text-right">Lifetime pts</span>
                <span className="text-right">Lifetime visits</span>
                <span className="text-right">Check-ins today</span>
                <span className="text-right">Points today</span>
                <span>Last activity</span>
                <span>Reward today</span>
              </div>

              {/* Rows */}
              <div className="mt-1 space-y-2">
                {tonightRows.map((row) => {
                  const lastActivity =
                    row.lastRedemptionAt ?? row.lastScanToday ?? row.lastScan ?? null;

                  return (
                    <div
                      key={row.userId}
                      className="grid items-center gap-3 rounded-3xl bg-slate-50 px-4 py-3 text-xs shadow-sm md:grid-cols-[minmax(0,2.1fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.6fr)]"
                    >
                      {/* Guest name / VIP badge – clickable */}
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/rewards/vips/${row.userId}/insights`}
                          className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-900 hover:text-amber-600"
                        >
                          <span>{row.name}</span>
                          {row.isVip && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              VIP
                            </span>
                          )}
                        </Link>
                        {row.email && (
                          <span className="text-[11px] text-slate-500">{row.email}</span>
                        )}
                      </div>

                      <div className="text-[13px] text-slate-900">{row.phone || "—"}</div>

                      <div className="text-right font-semibold text-slate-900">
                        {row.lifetimePoints}
                      </div>

                      <div className="text-right text-slate-900">{row.lifetimeVisits}</div>

                      <div className="text-right text-slate-900">{row.checkinsToday}</div>

                      <div className="text-right text-slate-900">
                        {row.pointsToday > 0 ? `+${row.pointsToday}` : row.pointsToday}
                      </div>

                      <div className="text-slate-900">{formatTimeEt(lastActivity)}</div>

                      <div className="text-slate-900">
                        {row.redemptionsToday > 0
                          ? `${row.redemptionsToday}× ${row.lastRedemptionName ?? "Reward"}`
                          : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
