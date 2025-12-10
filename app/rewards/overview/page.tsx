// app/rewards/overview/page.tsx
// Path: /rewards/overview
// Sugarshack Downtown - VIP Growth & Activity Overview
// 30-day view of new VIPs, check-ins, and points flow.

import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

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
};

type DayBucket = {
  date: string; // YYYY-MM-DD
  newVips: number;
  checkins: number;
  pointsAwarded: number;
  pointsRedeemed: number;
};

function formatDateLabel(ymd: string): string {
  const [year, month, day] = ymd.split("-").map((v) => Number(v));
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function RewardsOverviewPage() {
  const session = await getDashboardSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = supabaseServer;

  // --- Utility: date range for last 30 days -------------------------------
  const now = new Date();
  const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000); // 30 days incl today

  const startYmd = `${start.getFullYear()}-${String(
    start.getMonth() + 1
  ).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

  const todayYmd = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

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

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  const activeVipsCount = vipOverview.filter((row) => {
    if (!row.last_scan_at) return false;
    const lastMs = new Date(row.last_scan_at).getTime();
    return !Number.isNaN(lastMs) && nowMs - lastMs <= THIRTY_DAYS_MS;
  }).length;

  const activePercent =
    totalVips > 0 ? (activeVipsCount / totalVips) * 100 : 0;

  // --- 2) New VIPs + visits / points in last 30 days ----------------------

  // 2a) New VIPs based on rewards_users.created_at
  const { data: vipUsersRaw, error: vipUsersError } = await supabase
    .from("rewards_users")
    .select("user_id, created_at, last_scan_at")
    .gte("created_at", start.toISOString());

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
    .select("scan_date, points")
    .gte("scan_date", startYmd);

  if (scansError) {
    console.error("[rewards overview] scans error", scansError);
  }

  const scanRows: ScanRow[] = (scansRaw ?? []).map((row: any) => ({
    scan_date: row.scan_date as string | null,
    points: row.points as number | null,
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

  // Fill for every day in range to keep table dense
  {
    const tmp = new Date(start);
    while (tmp <= now) {
      const ymd = `${tmp.getFullYear()}-${String(tmp.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(tmp.getDate()).padStart(2, "0")}`;
      ensureBucket(ymd);
      tmp.setDate(tmp.getDate() + 1);
    }
  }

  // New VIPs by day
  for (const row of vipUserRows) {
    const created = new Date(row.created_at);
    if (Number.isNaN(created.getTime())) continue;

    const ymd = `${created.getFullYear()}-${String(
      created.getMonth() + 1
    ).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;

    const bucket = ensureBucket(ymd);
    bucket.newVips += 1;
  }

  // Visits + points by scan_date
  for (const row of scanRows) {
    const scanYmd = row.scan_date;
    if (!scanYmd) continue;

    const bucket = ensureBucket(scanYmd);
    bucket.checkins += 1;

    const pts = Number(row.points ?? 0);
    if (!Number.isFinite(pts) || pts === 0) continue;

    if (pts > 0) bucket.pointsAwarded += pts;
    else bucket.pointsRedeemed += Math.abs(pts);
  }

  const timeline: DayBucket[] = Array.from(buckets.values()).sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  );

  const totalNewVipsLast30 = timeline.reduce(
    (sum, d) => sum + d.newVips,
    0
  );
  const totalCheckinsLast30 = timeline.reduce(
    (sum, d) => sum + d.checkins,
    0
  );
  const totalPointsAwardedLast30 = timeline.reduce(
    (sum, d) => sum + d.pointsAwarded,
    0
  );
  const totalPointsRedeemedLast30 = timeline.reduce(
    (sum, d) => sum + d.pointsRedeemed,
    0
  );

  const netPointsLast30 =
    totalPointsAwardedLast30 - totalPointsRedeemedLast30;

  return (
    <DashboardShell
      activeTab="rewards"
      title="VIP rewards overview"
      subtitle="High-level view of your VIP base, recent activity, and point flow over the last 30 days."
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
            value={`${activeVipsCount} (${totalVips > 0 ? activePercent.toFixed(0) : "0"}%)`}
          />
          <SummaryCard
            label="New VIPs (30 days)"
            helper="New rewards profiles created in the last 30 days."
            value={totalNewVipsLast30}
          />
          <SummaryCard
            label="Visits (30 days)"
            helper="Check-ins / scans in the last 30 days."
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

        {/* 30-day timeline table */}
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Last 30 days
              </p>
              <p className="mt-1 text-xs text-slate-500">
                New VIPs, check-ins, and point flow by day. Use this to spot
                strong nights and slow periods.
              </p>
            </div>
            <p className="text-[11px] text-slate-500">
              {formatDateLabel(startYmd)} – {formatDateLabel(todayYmd)}
            </p>
          </div>

          {timeline.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No VIP or scan activity yet in this range.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3 text-left font-semibold">
                      Date
                    </th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      New VIPs
                    </th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      Check-ins
                    </th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      Points awarded
                    </th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      Points redeemed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((day) => (
                    <tr
                      key={day.date}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                        {formatDateLabel(day.date)}
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
        </section>
      </div>
    </DashboardShell>
  );
}

// --- Presentational helper ---------------------------------------------------

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
