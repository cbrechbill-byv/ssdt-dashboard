// app/rewards/overview/page.tsx
// Path: /rewards/overview
// Sugarshack Downtown - VIP Growth & Activity Overview
// Option A: Replace the “Last 30 days” daily table card with a more meaningful
// performance snapshot (7-day pace vs 30-day pace, redemption rate, top nights)
// while keeping the top summary + points flow cards.

import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

type RewardsUserOverview = {
  user_id: string | null;
  is_vip: boolean | null;
  last_scan_at: string | null;
};

type RewardsUserRow = {
  user_id: string;
  created_at: string;
  last_scan_at: string | null;
};

type ScanRow = {
  scan_date: string | null;
  points: number | null;
  source?: string | null;
};

type DayBucket = {
  date: string; // YYYY-MM-DD
  newVips: number;
  checkins: number;
  pointsAwarded: number;
  pointsRedeemed: number;
};

function getEtNow(): Date {
  // Creates a Date aligned to ET clock (safe for server rendering)
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: ET_TZ,
    })
  );
}

function toEtYmd(d: Date): string {
  return d.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Date-only strings MUST NOT be parsed as Date("YYYY-MM-DD") (UTC midnight).
// Use a noon-UTC anchor so it formats safely in ET.
function formatDateLabelEt(ymd: string): string {
  const [year, month, day] = ymd.split("-").map((v) => Number(v));
  if (!year || !month || !day) return ymd;

  const safeUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    month: "short",
    day: "numeric",
  }).format(safeUtc);
}

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

function pctChange(newVal: number, baseline: number): number {
  if (!Number.isFinite(newVal) || !Number.isFinite(baseline)) return 0;
  if (baseline === 0) return newVal === 0 ? 0 : 100;
  return ((newVal - baseline) / baseline) * 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export default async function RewardsOverviewPage() {
  const session = await getDashboardSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = supabaseServer;

  // --- Utility: date ranges aligned to ET -------------------------------
  const nowEt = getEtNow();
  const todayYmd = toEtYmd(nowEt);

  const start30Ymd = addDaysEtYmd(todayYmd, -29); // 30 days incl today
  const start7Ymd = addDaysEtYmd(todayYmd, -6); // 7 days incl today

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  // --- 1) Total VIPs + active VIPs (via rewards_user_overview) ------------
  const { data: overviewData, error: overviewError } = await supabase
    .from("rewards_user_overview")
    .select("user_id, is_vip, last_scan_at");

  if (overviewError) {
    console.error("[rewards overview] overview error", overviewError);
  }

  const overviewRows: RewardsUserOverview[] =
    (overviewData ?? []) as RewardsUserOverview[];

  const vipOverview = overviewRows.filter((row) => row.is_vip);
  const totalVips = vipOverview.length;

  const activeVipsCount = vipOverview.filter((row) => {
    if (!row.last_scan_at) return false;
    const lastMs = new Date(row.last_scan_at).getTime();
    return !Number.isNaN(lastMs) && nowMs - lastMs <= THIRTY_DAYS_MS;
  }).length;

  const activePercent = totalVips > 0 ? (activeVipsCount / totalVips) * 100 : 0;

  // --- 2) New VIPs + scans/points in last 30 days ------------------------
  // 2a) New VIPs based on rewards_users.created_at
  // Use ET-aligned boundary by taking ET “now” minus 29 days
  const start30DateEt = new Date(nowEt.getTime() - 29 * 24 * 60 * 60 * 1000);

  const { data: vipUsersRaw, error: vipUsersError } = await supabase
    .from("rewards_users")
    .select("user_id, created_at, last_scan_at")
    .gte("created_at", start30DateEt.toISOString());

  if (vipUsersError) {
    console.error("[rewards overview] vip users error", vipUsersError);
  }

  const vipUserRows: RewardsUserRow[] = (vipUsersRaw ?? []).map((row: any) => ({
    user_id: row.user_id as string,
    created_at: row.created_at as string,
    last_scan_at: row.last_scan_at as string | null,
  }));

  // 2b) Scans (visits + points) based on rewards_scans.scan_date
  const { data: scansRaw, error: scansError } = await supabase
    .from("rewards_scans")
    .select("scan_date, points, source")
    .gte("scan_date", start30Ymd);

  if (scansError) {
    console.error("[rewards overview] scans error", scansError);
  }

  const scanRows: ScanRow[] = (scansRaw ?? []).map((row: any) => ({
    scan_date: row.scan_date as string | null,
    points: row.points as number | null,
    source: row.source as string | null,
  }));

  // --- 3) Build 30-day buckets in memory ----------------------------------
  const buckets = new Map<string, DayBucket>();

  function ensureBucket(ymd: string): DayBucket {
    const existing = buckets.get(ymd);
    if (existing) return existing;
    const bucket: DayBucket = {
      date: ymd,
      newVips: 0,
      checkins: 0,
      pointsAwarded: 0,
      pointsRedeemed: 0,
    };
    buckets.set(ymd, bucket);
    return bucket;
  }

  // Fill for every day in range to keep dense
  {
    let cursor = start30Ymd;
    for (let i = 0; i < 30; i++) {
      ensureBucket(cursor);
      cursor = addDaysEtYmd(cursor, 1);
    }
  }

  // New VIPs by created_at day (rendered in ET)
  for (const row of vipUserRows) {
    const created = new Date(row.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const ymd = toEtYmd(created);
    if (ymd < start30Ymd || ymd > todayYmd) continue;
    ensureBucket(ymd).newVips += 1;
  }

  // Visits + points by scan_date
  for (const row of scanRows) {
    const scanYmd = row.scan_date;
    if (!scanYmd) continue;
    if (scanYmd < start30Ymd || scanYmd > todayYmd) continue;

    const bucket = ensureBucket(scanYmd);

    // If you want “check-ins” to mean only QR check-ins, uncomment this filter.
    // Otherwise, we count all scans as “visits/scans”.
    // const isCheckin = (row.source ?? "").toLowerCase() === "qr-checkin";
    // if (!isCheckin) continue;

    bucket.checkins += 1;

    const pts = Number(row.points ?? 0);
    if (!Number.isFinite(pts) || pts === 0) continue;

    if (pts > 0) bucket.pointsAwarded += pts;
    else bucket.pointsRedeemed += Math.abs(pts);
  }

  const timeline: DayBucket[] = Array.from(buckets.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  // --- 4) Compute 30-day totals ------------------------------------------
  const totalNewVipsLast30 = timeline.reduce((sum, d) => sum + d.newVips, 0);
  const totalCheckinsLast30 = timeline.reduce((sum, d) => sum + d.checkins, 0);
  const totalPointsAwardedLast30 = timeline.reduce(
    (sum, d) => sum + d.pointsAwarded,
    0
  );
  const totalPointsRedeemedLast30 = timeline.reduce(
    (sum, d) => sum + d.pointsRedeemed,
    0
  );
  const netPointsLast30 = totalPointsAwardedLast30 - totalPointsRedeemedLast30;

  // --- 5) Compute 7-day snapshot + pace comparisons ----------------------
  const last7 = timeline.filter((d) => d.date >= start7Ymd);

  const totalNewVipsLast7 = last7.reduce((sum, d) => sum + d.newVips, 0);
  const totalCheckinsLast7 = last7.reduce((sum, d) => sum + d.checkins, 0);
  const totalPointsAwardedLast7 = last7.reduce(
    (sum, d) => sum + d.pointsAwarded,
    0
  );
  const totalPointsRedeemedLast7 = last7.reduce(
    (sum, d) => sum + d.pointsRedeemed,
    0
  );
  const netPointsLast7 = totalPointsAwardedLast7 - totalPointsRedeemedLast7;

  const paceCheckins7 = totalCheckinsLast7 / 7;
  const paceCheckins30 = totalCheckinsLast30 / 30;

  const paceNewVips7 = totalNewVipsLast7 / 7;
  const paceNewVips30 = totalNewVipsLast30 / 30;

  const paceAward7 = totalPointsAwardedLast7 / 7;
  const paceAward30 = totalPointsAwardedLast30 / 30;

  const paceRedeem7 = totalPointsRedeemedLast7 / 7;
  const paceRedeem30 = totalPointsRedeemedLast30 / 30;

  const checkinsTrendPct = pctChange(paceCheckins7, paceCheckins30);
  const newVipsTrendPct = pctChange(paceNewVips7, paceNewVips30);

  // Redemption rate (points redeemed per points awarded)
  const redemptionRate30 =
    totalPointsAwardedLast30 > 0
      ? (totalPointsRedeemedLast30 / totalPointsAwardedLast30) * 100
      : 0;

  // “Redeem intensity” (points redeemed per scan)
  const redeemPerScan30 =
    totalCheckinsLast30 > 0
      ? totalPointsRedeemedLast30 / totalCheckinsLast30
      : 0;

  // Top nights in last 30 days by checkins
  const topNights = [...timeline]
    .filter((d) => d.checkins > 0)
    .sort((a, b) => b.checkins - a.checkins)
    .slice(0, 5);

  const bestNight = topNights[0] ?? null;

  return (
    <DashboardShell
      activeTab="rewards"
      title="VIP rewards overview"
      subtitle="High-level view of your VIP base, recent activity, and point flow. (Timezone: America/New_York)"
    >
      <div className="space-y-6">
        {/* Top summary cards */}
        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Total VIPs"
            helper="Guests flagged as VIP in the rewards system."
            value={totalVips}
          />
          <SummaryCard
            label="Active VIPs (30 days)"
            helper="VIPs with at least one visit in the last 30 days."
            value={`${activeVipsCount} (${
              totalVips > 0 ? activePercent.toFixed(0) : "0"
            }%)`}
          />
          <SummaryCard
            label="New VIPs (30 days)"
            helper="New rewards profiles created in the last 30 days."
            value={totalNewVipsLast30}
          />
          <SummaryCard
            label="Visits / scans (30 days)"
            helper="Scans in the last 30 days."
            value={totalCheckinsLast30}
          />
        </section>

        {/* Points flow cards */}
        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Points awarded (30 days)"
            helper="All positive points from check-ins and boosts."
            value={totalPointsAwardedLast30}
          />
          <SummaryCard
            label="Points redeemed (30 days)"
            helper="Points spent on rewards in the last 30 days."
            value={totalPointsRedeemedLast30}
          />
          <SummaryCard
            label="Net points (30 days)"
            helper="Awarded minus redeemed."
            value={netPointsLast30}
          />
        </section>

        {/* OPTION A: Better “bottom card” */}
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Performance snapshot
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Quick “are we up or down?” view using 7-day pace vs 30-day pace,
                plus redemption signals and top nights.
              </p>
            </div>
            <p className="text-[11px] text-slate-500">
              {formatDateLabelEt(start30Ymd)} – {formatDateLabelEt(todayYmd)}
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {/* Left: 7-day vs 30-day pace */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                Pace (7 days vs 30 days)
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <MiniStat
                  label="Check-ins pace"
                  value={`${paceCheckins7.toFixed(1)}/day`}
                  sub={`30-day avg: ${paceCheckins30.toFixed(1)}/day`}
                  trendPct={checkinsTrendPct}
                />
                <MiniStat
                  label="New VIPs pace"
                  value={`${paceNewVips7.toFixed(1)}/day`}
                  sub={`30-day avg: ${paceNewVips30.toFixed(1)}/day`}
                  trendPct={newVipsTrendPct}
                />
                <MiniStat
                  label="Points awarded pace"
                  value={`${paceAward7.toFixed(0)}/day`}
                  sub={`30-day avg: ${paceAward30.toFixed(0)}/day`}
                />
                <MiniStat
                  label="Points redeemed pace"
                  value={`${paceRedeem7.toFixed(0)}/day`}
                  sub={`30-day avg: ${paceRedeem30.toFixed(0)}/day`}
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
                <KpiPill
                  label="7-day totals"
                  value={`${totalCheckinsLast7} scans · ${totalNewVipsLast7} new VIPs`}
                />
                <KpiPill
                  label="7-day net points"
                  value={`${netPointsLast7} net`}
                />
                <KpiPill
                  label="Window"
                  value={`${formatDateLabelEt(start7Ymd)} → ${formatDateLabelEt(
                    todayYmd
                  )}`}
                />
              </div>
            </div>

            {/* Right: Redemption + best night */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                Redemption health
              </p>

              <div className="mt-3 space-y-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    Redemption rate (30 days)
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {clamp(redemptionRate30, 0, 999).toFixed(0)}%
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Points redeemed ÷ points awarded
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    Redeem per scan (30 days)
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {redeemPerScan30.toFixed(1)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Avg points redeemed per scan
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    Best night (30 days)
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {bestNight
                      ? `${bestNight.checkins} scans`
                      : "No activity"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {bestNight ? formatDateLabelEt(bestNight.date) : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Top nights list + last 7 days mini table */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Top nights (by scans)
              </p>

              {topNights.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No scan activity yet in this range.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {topNights.map((d) => (
                    <div
                      key={d.date}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-900">
                          {formatDateLabelEt(d.date)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {d.newVips} new VIPs · {d.pointsAwarded} awarded ·{" "}
                          {d.pointsRedeemed} redeemed
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {d.checkins}
                        </p>
                        <p className="text-[11px] text-slate-500">scans</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Last 7 days (daily)
              </p>

              {last7.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No activity yet in the last 7 days.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                        <th className="py-2 pr-3 text-left font-semibold">
                          Date
                        </th>
                        <th className="py-2 pr-3 text-right font-semibold">
                          New
                        </th>
                        <th className="py-2 pr-3 text-right font-semibold">
                          Scans
                        </th>
                        <th className="py-2 pr-3 text-right font-semibold">
                          +Pts
                        </th>
                        <th className="py-2 pr-3 text-right font-semibold">
                          -Pts
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {last7.map((day) => (
                        <tr
                          key={day.date}
                          className="border-b border-slate-50 last:border-0"
                        >
                          <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                            {formatDateLabelEt(day.date)}
                          </td>
                          <td className="py-2 pr-3 text-[11px] text-slate-900 text-right">
                            {day.newVips}
                          </td>
                          <td className="py-2 pr-3 text-[11px] text-slate-900 text-right">
                            {day.checkins}
                          </td>
                          <td className="py-2 pr-3 text-[11px] text-emerald-700 text-right">
                            {day.pointsAwarded}
                          </td>
                          <td className="py-2 pr-3 text-[11px] text-rose-700 text-right">
                            {day.pointsRedeemed}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

// --- Presentational helpers ------------------------------------------------

type SummaryCardProps = {
  label: string;
  helper: string;
  value: string | number;
};

function SummaryCard({ label, helper, value }: SummaryCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  trendPct,
}: {
  label: string;
  value: string;
  sub: string;
  trendPct?: number;
}) {
  const hasTrend = typeof trendPct === "number" && Number.isFinite(trendPct);
  const trend = hasTrend ? trendPct! : 0;
  const trendLabel = hasTrend
    ? `${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend).toFixed(0)}%`
    : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
          {label}
        </p>
        {trendLabel && (
          <span className="text-[11px] font-semibold text-slate-700">
            {trendLabel}
          </span>
        )}
      </div>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

function KpiPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-900">{value}</p>
    </div>
  );
}
