// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\rewards\overview\page.tsx
// app/rewards/overview/page.tsx
// Path: /rewards/overview
// Sugarshack Downtown - VIP Rewards Overview
//
// ✅ Aligned to Tonight page sources + rules:
// - VIP scan activity = rewards_scans (scan_date is ET day string)
// - Redemptions = rewards_redemptions (created_at filtered by ET day bounds -> UTC ISO)
// - New VIPs = rewards_users (created_at filtered by ET day bounds -> UTC ISO)
// - Active VIPs (30d) = rewards_user_overview.last_scan_at within ET 30-day window (numeric compare)
//
// ✅ More rewards-oriented (less redundant with Tonight):
// - Focus on redemption adoption + reward mix + points economy + liability
// - Avoid “Tonight” operational KPIs (people tonight / guest conversion / live pace)
//
// NOTE:
// - This file intentionally does NOT treat negative points in rewards_scans as redemptions,
//   because Tonight uses rewards_redemptions as the source of truth.

import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

type RewardsUserOverview = {
  user_id: string | null;
  is_vip: boolean | null;
  total_points: number | null;
  total_visits: number | null;
  last_scan_at: string | null;
};

type RewardsUserRow = {
  user_id: string;
  created_at: string;
};

type ScanRow = {
  user_id: string;
  scan_date: string | null; // YYYY-MM-DD (ET)
  points: number | null;
  scanned_at: string | null; // timestamptz
  source?: string | null;
};

type RedemptionRow = {
  user_id: string | null;
  reward_name: string | null;
  points_spent: number | null;
  created_at: string; // timestamptz
};

type DayBucket = {
  date: string; // YYYY-MM-DD
  newVips: number;
  scanEvents: number;
  uniqueScanners: number;
  pointsAwarded: number;
  redemptions: number;
  pointsSpent: number;
};

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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

function formatShortDateTimeEt(iso: string | null | undefined): string {
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

/**
 * Convert an ET-local wall-clock time into an absolute UTC ISO string.
 * Uses Intl timeZoneName: 'shortOffset' (e.g. "GMT-5") when available.
 * Robust across DST because the offset comes from the target date.
 * (Same helper pattern as Tonight page)
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pctChange(newVal: number, baseline: number): number {
  if (!Number.isFinite(newVal) || !Number.isFinite(baseline)) return 0;
  if (baseline === 0) return newVal === 0 ? 0 : 100;
  return ((newVal - baseline) / baseline) * 100;
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function formatInt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

function TonePill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "emerald" | "amber" | "rose";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : tone === "rose"
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-200 text-slate-700";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}

function StatCard({
  label,
  value,
  helper,
  meta,
}: {
  label: string;
  value: React.ReactNode;
  helper: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </div>
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
  const trendLabel = hasTrend ? `${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend).toFixed(0)}%` : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
        {trendLabel ? (
          <span className={`text-[11px] font-semibold ${trend >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {trendLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

export default async function RewardsOverviewPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/login");

  const supabase = supabaseServer;

  // ---- Date windows (ET) ---------------------------------------------------
  const todayEt = getEtYmd();
  const start30Ymd = addDaysEtYmd(todayEt, -29); // inclusive
  const start7Ymd = addDaysEtYmd(todayEt, -6); // inclusive

  // Timestamp windows for timestamptz tables
  const start30Utc = etWallClockToUtcIso(start30Ymd, "00:00:00");
  const endTodayUtc = etWallClockToUtcIso(todayEt, "23:59:59");
  const start7Utc = etWallClockToUtcIso(start7Ymd, "00:00:00");

  const start30Ms = new Date(start30Utc).getTime();
  const start7Ms = new Date(start7Utc).getTime();
  const endTodayMs = new Date(endTodayUtc).getTime();

  // ---- 1) VIP base + activity (rewards_user_overview) ----------------------
  const { data: overviewData, error: overviewError } = await supabase
    .from("rewards_user_overview")
    .select("user_id, is_vip, total_points, total_visits, last_scan_at");

  if (overviewError) console.error("[rewards/overview] rewards_user_overview error", overviewError);

  const overviewRows: RewardsUserOverview[] = (overviewData ?? []) as RewardsUserOverview[];
  const vipOverview = overviewRows.filter((r) => !!r.is_vip);
  const totalVips = vipOverview.length;

  // ✅ Active VIPs (30d) - numeric compare (not string compare)
  const activeVipsCount = vipOverview.filter((r) => {
    if (!r.last_scan_at) return false;
    const t = new Date(r.last_scan_at).getTime();
    return Number.isFinite(t) && t >= start30Ms && t <= endTodayMs;
  }).length;

  const activePercent = totalVips > 0 ? (activeVipsCount / totalVips) * 100 : 0;

  // Points liability (sum of VIP total_points)
  const pointsLiability = vipOverview.reduce((sum, r) => sum + Number(r.total_points ?? 0), 0);

  // ---- 2) New VIPs (rewards_users.created_at) ------------------------------
  const { data: vipUsersRaw, error: vipUsersError } = await supabase
    .from("rewards_users")
    .select("user_id, created_at")
    .gte("created_at", start30Utc)
    .lte("created_at", endTodayUtc);

  if (vipUsersError) console.error("[rewards/overview] rewards_users error", vipUsersError);

  const vipUserRows: RewardsUserRow[] = (vipUsersRaw ?? []).map((row: any) => ({
    user_id: String(row.user_id),
    created_at: String(row.created_at),
  }));

  // ---- 3) Scan events + points (rewards_scans.scan_date) -------------------
  const { data: scansRaw, error: scansError } = await supabase
    .from("rewards_scans")
    .select("user_id, scan_date, points, scanned_at, source")
    .gte("scan_date", start30Ymd)
    .lte("scan_date", todayEt);

  if (scansError) console.error("[rewards/overview] rewards_scans error", scansError);

  const scans: ScanRow[] = (scansRaw ?? []).map((row: any) => ({
    user_id: String(row.user_id),
    scan_date: (row.scan_date as string | null) ?? null,
    points: (row.points as number | null) ?? null,
    scanned_at: (row.scanned_at as string | null) ?? null,
    source: (row.source as string | null) ?? null,
  }));

  // ---- 4) Redemptions (rewards_redemptions.created_at) ---------------------
  const { data: redRaw, error: redErr } = await supabase
    .from("rewards_redemptions")
    .select("user_id, reward_name, points_spent, created_at")
    .gte("created_at", start30Utc)
    .lte("created_at", endTodayUtc)
    .order("created_at", { ascending: false });

  if (redErr) console.error("[rewards/overview] rewards_redemptions error", redErr);

  const redemptions: RedemptionRow[] = (redRaw ?? []) as RedemptionRow[];

  // ---- 5) Build dense 30-day buckets --------------------------------------
  const buckets = new Map<string, DayBucket>();

  function ensureBucket(ymd: string): DayBucket {
    const existing = buckets.get(ymd);
    if (existing) return existing;

    const b: DayBucket = {
      date: ymd,
      newVips: 0,
      scanEvents: 0,
      uniqueScanners: 0,
      pointsAwarded: 0,
      redemptions: 0,
      pointsSpent: 0,
    };
    buckets.set(ymd, b);
    return b;
  }

  // Fill for every day in range
  {
    let cursor = start30Ymd;
    for (let i = 0; i < 30; i++) {
      ensureBucket(cursor);
      cursor = addDaysEtYmd(cursor, 1);
    }
  }

  // New VIPs by created_at day (ET)
  for (const row of vipUserRows) {
    const created = new Date(row.created_at);
    const t = created.getTime();
    if (!Number.isFinite(t)) continue;
    const ymd = toEtYmd(created);
    if (ymd < start30Ymd || ymd > todayEt) continue;
    ensureBucket(ymd).newVips += 1;
  }

  // Scans + awarded points by scan_date
  const uniqueByDay = new Map<string, Set<string>>();
  for (const s of scans) {
    const ymd = s.scan_date;
    if (!ymd) continue;
    if (ymd < start30Ymd || ymd > todayEt) continue;

    const b = ensureBucket(ymd);
    b.scanEvents += 1;

    const uid = s.user_id ? String(s.user_id) : "";
    if (uid) {
      if (!uniqueByDay.has(ymd)) uniqueByDay.set(ymd, new Set<string>());
      uniqueByDay.get(ymd)!.add(uid);
    }

    const pts = Number(s.points ?? 0);
    if (Number.isFinite(pts) && pts > 0) b.pointsAwarded += pts; // awarded only
  }

  for (const [ymd, set] of uniqueByDay.entries()) {
    ensureBucket(ymd).uniqueScanners = set.size;
  }

  // Redemptions + points spent by created_at day (ET)
  for (const r of redemptions) {
    const created = new Date(r.created_at);
    const t = created.getTime();
    if (!Number.isFinite(t)) continue;

    const ymd = toEtYmd(created);
    if (ymd < start30Ymd || ymd > todayEt) continue;

    const b = ensureBucket(ymd);
    b.redemptions += 1;
    const spent = Number(r.points_spent ?? 0);
    if (Number.isFinite(spent) && spent > 0) b.pointsSpent += spent;
  }

  const timeline: DayBucket[] = Array.from(buckets.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  const last7 = timeline.filter((d) => d.date >= start7Ymd);

  // ---- 6) Totals (30d + 7d) -----------------------------------------------
  const totalNewVips30 = timeline.reduce((sum, d) => sum + d.newVips, 0);
  const totalScanEvents30 = timeline.reduce((sum, d) => sum + d.scanEvents, 0);
  const totalAwarded30 = timeline.reduce((sum, d) => sum + d.pointsAwarded, 0);
  const totalRedemptions30 = timeline.reduce((sum, d) => sum + d.redemptions, 0);
  const totalSpent30 = timeline.reduce((sum, d) => sum + d.pointsSpent, 0);
  const netPoints30 = totalAwarded30 - totalSpent30;

  const totalNewVips7 = last7.reduce((sum, d) => sum + d.newVips, 0);
  const totalScanEvents7 = last7.reduce((sum, d) => sum + d.scanEvents, 0);
  const totalAwarded7 = last7.reduce((sum, d) => sum + d.pointsAwarded, 0);
  const totalRedemptions7 = last7.reduce((sum, d) => sum + d.redemptions, 0);
  const totalSpent7 = last7.reduce((sum, d) => sum + d.pointsSpent, 0);
  const netPoints7 = totalAwarded7 - totalSpent7;

  // Unique scanners (30d overall)
  const uniqueScanners30 = new Set<string>();
  for (const s of scans) {
    if (!s.user_id) continue;
    const ymd = s.scan_date;
    if (!ymd) continue;
    if (ymd < start30Ymd || ymd > todayEt) continue;
    uniqueScanners30.add(String(s.user_id));
  }

  // Unique redeemers (30d + 7d)
  const uniqueRedeemers30 = new Set<string>();
  const uniqueRedeemers7 = new Set<string>();

  for (const r of redemptions) {
    const uid = r.user_id ? String(r.user_id) : "";
    if (!uid) continue;
    uniqueRedeemers30.add(uid);

    const t = new Date(r.created_at).getTime();
    if (Number.isFinite(t) && t >= start7Ms) uniqueRedeemers7.add(uid);
  }

  // Redemption adoption rates (people)
  const redeemerRate30 = activeVipsCount > 0 ? (uniqueRedeemers30.size / activeVipsCount) * 100 : 0;
  const redeemerRate7 = activeVipsCount > 0 ? (uniqueRedeemers7.size / activeVipsCount) * 100 : 0;

  // Avg spend per redemption (30d)
  const avgPointsPerRedemption30 = totalRedemptions30 > 0 ? totalSpent30 / totalRedemptions30 : 0;

  // Spend per active VIP (30d) — useful “how much value you delivered”
  const spendPerActiveVip30 = activeVipsCount > 0 ? totalSpent30 / activeVipsCount : 0;

  // Pace comparisons (7-day vs 30-day)
  const paceRedemptions7 = totalRedemptions7 / 7;
  const paceRedemptions30 = totalRedemptions30 / 30;
  const redemptionsTrendPct = pctChange(paceRedemptions7, paceRedemptions30);

  const paceSpent7 = totalSpent7 / 7;
  const paceSpent30 = totalSpent30 / 30;
  const spendTrendPct = pctChange(paceSpent7, paceSpent30);

  // Top rewards (30d): count + points
  const rewardAgg = new Map<string, { count: number; points: number }>();
  for (const r of redemptions) {
    const name = (r.reward_name ?? "Reward").trim() || "Reward";
    const spent = Number(r.points_spent ?? 0);
    const entry = rewardAgg.get(name) ?? { count: 0, points: 0 };
    entry.count += 1;
    entry.points += Number.isFinite(spent) && spent > 0 ? spent : 0;
    rewardAgg.set(name, entry);
  }

  const topRewards = Array.from(rewardAgg.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  const topReward30 = topRewards[0]?.[0] ?? null;

  // Recent redemptions (last 12)
  const recentRedemptions = redemptions.slice(0, 12);

  // Simple health badges (rewards-oriented)
  // - If redeemer rate is low, it means people aren’t cashing in.
  // - If liability is huge vs spend pace, staff should promote redeeming.
  const redeemerTone30 =
    redeemerRate30 >= 35 ? "emerald" : redeemerRate30 >= 18 ? "amber" : "rose";

  const liabilityVsSpendDays =
    totalSpent30 > 0 ? pointsLiability / (totalSpent30 / 30) : Infinity; // days to “burn down” at current spend pace
  const liabilityTone =
    liabilityVsSpendDays <= 60 ? "emerald" : liabilityVsSpendDays <= 120 ? "amber" : "rose";

  return (
    <DashboardShell
      activeTab="rewards"
      title="VIP rewards overview"
      subtitle={`Rewards adoption + redemption performance. Timezone: ${ET_TZ} (aligned to Tonight).`}
    >
      <div className="space-y-6">
        {/* KPI Row 1: Rewards adoption + value delivered (NOT Tonight redundant) */}
        <section className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Redeemers (30 days)"
            value={formatInt(uniqueRedeemers30.size)}
            meta={<TonePill tone={redeemerTone30 as any}>{clamp(redeemerRate30, 0, 999).toFixed(0)}%</TonePill>}
            helper={
              <>
                Unique VIPs who redeemed in last 30 days.{" "}
                <span className="text-slate-400">Rate = redeemers ÷ active VIPs.</span>
              </>
            }
          />

          <StatCard
            label="Redemptions (30 days)"
            value={formatInt(totalRedemptions30)}
            meta={
              <span className="text-[10px] font-semibold text-slate-500">
                {topReward30 ? `Top: ${topReward30}` : "Top: —"}
              </span>
            }
            helper={
              <>
                Total redemption events (rewards_redemptions).{" "}
                <span className="text-slate-400">{formatInt(uniqueRedeemers30.size)} unique redeemers.</span>
              </>
            }
          />

          <StatCard
            label="Value delivered (30 days)"
            value={`${formatCompact(totalSpent30)} pts`}
            meta={<TonePill tone="amber">{`${formatCompact(spendPerActiveVip30)} / active VIP`}</TonePill>}
            helper={
              <>
                Points spent on rewards.{" "}
                <span className="text-slate-400">Avg spent per active VIP.</span>
              </>
            }
          />

          <StatCard
            label="Points liability"
            value={`${formatCompact(pointsLiability)} pts`}
            meta={<TonePill tone={liabilityTone as any}>{Number.isFinite(liabilityVsSpendDays) ? `${Math.round(liabilityVsSpendDays)}d` : "—"}</TonePill>}
            helper={
              <>
                Sum of VIP total_points outstanding.{" "}
                <span className="text-slate-400">Badge ≈ days to burn down at current spend pace.</span>
              </>
            }
          />
        </section>

        {/* KPI Row 2: Points economy + growth (keep it rewards-related) */}
        <section className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Points awarded (30 days)"
            value={`${formatCompact(totalAwarded30)} pts`}
            helper="Sum of positive points from rewards_scans."
          />
          <StatCard
            label="Net points (30 days)"
            value={`${netPoints30 > 0 ? "+" : ""}${formatCompact(netPoints30)} pts`}
            meta={
              <TonePill tone={netPoints30 <= 0 ? "emerald" : netPoints30 < pointsLiability * 0.1 ? "amber" : "slate"}>
                {netPoints30 <= 0 ? "Burning down" : "Growing"}
              </TonePill>
            }
            helper="Awarded minus spent. (Higher net = bigger outstanding balance.)"
          />
          <StatCard
            label="New VIPs (30 days)"
            value={formatInt(totalNewVips30)}
            helper="New rewards profiles created in last 30 days."
          />
          <StatCard
            label="Active VIPs (30 days)"
            value={
              <>
                {formatInt(activeVipsCount)}{" "}
                <span className="text-sm font-semibold text-slate-500">
                  ({totalVips > 0 ? activePercent.toFixed(0) : "0"}%)
                </span>
              </>
            }
            helper="VIPs with last_scan_at within the last 30 ET days."
          />
        </section>

        {/* Performance snapshot (focus on rewards adoption + spend pace) */}
        <section className="rounded-3xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Rewards performance snapshot
              </p>
              <p className="mt-1 text-xs text-slate-500">
                7-day pace vs 30-day pace for redemption adoption + value delivered.
              </p>
            </div>
            <p className="text-[11px] text-slate-500">
              {formatDateLabelEt(start30Ymd)} – {formatDateLabelEt(todayEt)}
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {/* Pace panel */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                Pace (7 days vs 30 days)
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <MiniStat
                  label="Redemptions pace"
                  value={`${paceRedemptions7.toFixed(1)}/day`}
                  sub={`30-day avg: ${paceRedemptions30.toFixed(1)}/day`}
                  trendPct={redemptionsTrendPct}
                />
                <MiniStat
                  label="Spend pace"
                  value={`${formatCompact(paceSpent7)}/day`}
                  sub={`30-day avg: ${formatCompact(paceSpent30)}/day`}
                  trendPct={spendTrendPct}
                />
                <MiniStat
                  label="Redeemer rate (7 days)"
                  value={`${clamp(redeemerRate7, 0, 999).toFixed(0)}%`}
                  sub={`30-day rate: ${clamp(redeemerRate30, 0, 999).toFixed(0)}%`}
                  trendPct={pctChange(redeemerRate7, redeemerRate30)}
                />
                <MiniStat
                  label="Avg points / redemption"
                  value={`${avgPointsPerRedemption30.toFixed(0)} pts`}
                  sub={`30-day total: ${formatCompact(totalSpent30)} pts`}
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">7-day totals</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-900">
                    {formatInt(totalRedemptions7)} redeems · {formatCompact(totalSpent7)} pts · {formatInt(uniqueRedeemers7.size)} redeemers
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">7-day net</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-900">
                    {netPoints7 > 0 ? `+${formatCompact(netPoints7)}` : formatCompact(netPoints7)} pts
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Window</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-900">
                    {formatDateLabelEt(start7Ymd)} → {formatDateLabelEt(todayEt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick “what to do” panel */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">What this means</p>

              <div className="mt-3 space-y-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Adoption</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {uniqueRedeemers30.size} redeemers{" "}
                    <span className="text-slate-500">({clamp(redeemerRate30, 0, 999).toFixed(0)}%)</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    If this is low, promote “Redeem now” at the register + signage.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Reward mix</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{topReward30 ?? "—"}</p>
                  <p className="text-[11px] text-slate-500">Your most redeemed reward in the last 30 days.</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Liability</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatCompact(pointsLiability)} pts</p>
                  <p className="text-[11px] text-slate-500">
                    Big liability means VIPs have points. Make redeeming easy + visible.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rewards section */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Top rewards (30 days)
              </p>

              {topRewards.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No redemptions yet in this window.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {topRewards.map(([name, agg]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-slate-900">{name}</p>
                        <p className="text-[11px] text-slate-500">{formatCompact(agg.points)} pts delivered</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{agg.count}</p>
                        <p className="text-[11px] text-slate-500">redeems</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Recent redemptions
              </p>

              {recentRedemptions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No recent redemptions.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {recentRedemptions.map((r, idx) => {
                    const name = (r.reward_name ?? "Reward").trim() || "Reward";
                    const spent = Number(r.points_spent ?? 0);
                    return (
                      <div
                        key={`${r.created_at}-${idx}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-slate-900">{name}</p>
                          <p className="text-[11px] text-slate-500">{formatShortDateTimeEt(r.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{spent > 0 ? `-${formatInt(spent)}` : "—"}</p>
                          <p className="text-[11px] text-slate-500">points</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Daily table (last 7 days) */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Last 7 days (daily)
              </p>
              <p className="text-[11px] text-slate-400">ET day buckets</p>
            </div>

            {last7.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No activity yet in the last 7 days.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                      <th className="py-2 pr-3 text-left font-semibold">Date</th>
                      <th className="py-2 pr-3 text-right font-semibold">New VIPs</th>
                      <th className="py-2 pr-3 text-right font-semibold">Scan events</th>
                      <th className="py-2 pr-3 text-right font-semibold">Unique VIPs</th>
                      <th className="py-2 pr-3 text-right font-semibold">+Pts</th>
                      <th className="py-2 pr-3 text-right font-semibold">Redeems</th>
                      <th className="py-2 pr-3 text-right font-semibold">Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {last7.map((day) => (
                      <tr key={day.date} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {formatDateLabelEt(day.date)}
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-900 text-right">{day.newVips}</td>
                        <td className="py-2 pr-3 text-[11px] text-slate-900 text-right">{day.scanEvents}</td>
                        <td className="py-2 pr-3 text-[11px] text-slate-900 text-right">{day.uniqueScanners}</td>
                        <td className="py-2 pr-3 text-[11px] text-emerald-700 text-right">{day.pointsAwarded}</td>
                        <td className="py-2 pr-3 text-[11px] text-slate-900 text-right">{day.redemptions}</td>
                        <td className="py-2 pr-3 text-[11px] text-rose-700 text-right">
                          {day.pointsSpent > 0 ? `-${day.pointsSpent}` : "0"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Small footer note */}
          <p className="mt-4 text-[11px] text-slate-400">
            Notes: “Scan events” counts rewards_scans rows (any source). “Redemptions” uses rewards_redemptions (source of truth).
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}
