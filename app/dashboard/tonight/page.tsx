// app/dashboard/tonight/page.tsx
// Path: /dashboard/tonight
// Live "Tonight's Check-Ins" board for Sugarshack Downtown.
// Shows who checked in today, their lifetime points/visits, and any redemptions today.

import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { TonightAutoRefresh } from "./AutoRefreshClient";

export const revalidate = 0; // always fresh when requested

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

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
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

  // --- 1) Figure out "today" (YYYY-MM-DD) for scan_date filter ----------------
  const todayDate = new Date().toISOString().slice(0, 10); // simple UTC date; matches how scan_date is stored

  // --- 2) Pull today's scans --------------------------------------------------
  const { data: scansData, error: scansError } = await supabase
    .from("rewards_scans")
    .select("id, user_id, points, scanned_at, source, note")
    .eq("scan_date", todayDate)
    .order("scanned_at", { ascending: false });

  if (scansError) {
    console.error("[tonight] scans error", scansError);
  }

  const scans: ScanRow[] = (scansData ?? []) as ScanRow[];

  const userIds = Array.from(
    new Set(scans.map((s) => s.user_id).filter(Boolean))
  );

  // --- 3) Pull VIP overview rows for those users ------------------------------
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

  // --- 4) Pull today's redemptions -------------------------------------------
  const dayStart = `${todayDate}T00:00:00+00:00`;
  const dayEnd = `${todayDate}T23:59:59+00:00`;

  const { data: redemptionsData, error: redemptionsError } = await supabase
    .from("rewards_redemptions")
    .select("user_id, reward_name, points_spent, created_at")
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd)
    .order("created_at", { ascending: false });

  if (redemptionsError) {
    console.error("[tonight] redemptions error", redemptionsError);
  }

  const redemptions: RedemptionRow[] = (redemptionsData ?? []) as RedemptionRow[];

  // --- 5) Aggregate per user --------------------------------------------------
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
      subtitle="Live VIP check-ins, points and redemptions for tonight only."
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
            </div>
            {tonightRows.length > 0 && (
              <p className="text-xs text-slate-500">
                Last update: {formatShortDateTime(new Date().toISOString())}
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
                    row.lastRedemptionAt ??
                    row.lastScanToday ??
                    row.lastScan ??
                    null;

                  return (
                    <div
                      key={row.userId}
                      className="grid items-center gap-3 rounded-3xl bg-slate-50 px-4 py-3 text-xs shadow-sm md:grid-cols-[minmax(0,2.1fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.6fr)]"
                    >
                      {/* Guest name / VIP badge – NOW CLICKABLE */}
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
                          <span className="text-[11px] text-slate-500">
                            {row.email}
                          </span>
                        )}
                      </div>

                      {/* Phone */}
                      <div className="text-[13px] text-slate-900">
                        {row.phone || "—"}
                      </div>

                      {/* Lifetime points */}
                      <div className="text-right font-semibold text-slate-900">
                        {row.lifetimePoints}
                      </div>

                      {/* Lifetime visits */}
                      <div className="text-right text-slate-900">
                        {row.lifetimeVisits}
                      </div>

                      {/* Check-ins today */}
                      <div className="text-right text-slate-900">
                        {row.checkinsToday}
                      </div>

                      {/* Points today */}
                      <div className="text-right text-slate-900">
                        {row.pointsToday > 0 ? `+${row.pointsToday}` : row.pointsToday}
                      </div>

                      {/* Last activity time */}
                      <div className="text-slate-900">
                        {formatTime(lastActivity)}
                      </div>

                      {/* Reward today */}
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
