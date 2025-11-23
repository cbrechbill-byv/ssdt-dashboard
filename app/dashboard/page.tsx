import React from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type StatCardProps = {
  label: string;
  helper: string;
  value: string | number;
};

function StatCard({ label, helper, value }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
      <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

// Simple "today" date string (YYYY-MM-DD). We use this to match `scan_date` (DATE).
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// UTC-ish cutoff for "active VIP" (last 30 days)
function getActiveCutoffIso(days: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - days);
  return now.toISOString();
}

type DashboardPageProps = {
  searchParams?: {
    q?: string;
    sort?: string;
  };
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = supabaseServer;

  const today = getTodayDateString();
  const activeCutoffIso = getActiveCutoffIso(30);

  const q = (searchParams?.q ?? "").trim();
  const sort = (searchParams?.sort ?? "last") as "last" | "points" | "visits";

  // ---------------------------------------------------------------------------
  // 1) Today's stats: check-ins, unique VIPs, points
  //    Prefer rewards_daily_summary; fall back to rewards_scans if needed.
  // ---------------------------------------------------------------------------

  let checkinsToday = 0;
  let uniqueVipsToday = 0;
  let pointsToday = 0;

  // Try rewards_daily_summary first (one row per scan_date)
  const {
    data: dailySummaryRows,
    error: dailyError,
  } = await supabase
    .from("rewards_daily_summary")
    .select("scan_date, total_scans, unique_vips_checked_in, total_points_earned")
    .eq("scan_date", today)
    .limit(1);

  if (dailyError) {
    console.error("[VIP Dashboard] Error loading rewards_daily_summary:", dailyError);
  }

  const daily = dailySummaryRows?.[0];

  if (daily) {
    checkinsToday = Number(daily.total_scans ?? 0);
    uniqueVipsToday = Number(daily.unique_vips_checked_in ?? 0);
    pointsToday = Number(daily.total_points_earned ?? 0);
  } else {
    // No summary row for today yet — fall back to raw scans for today's date
    const {
      data: scanRows,
      error: scansError,
    } = await supabase
      .from("rewards_scans")
      .select("user_id, points, scan_date")
      .eq("scan_date", today);

    if (scansError) {
      console.error("[VIP Dashboard] Error loading rewards_scans:", scansError);
    }

    if (scanRows && scanRows.length > 0) {
      checkinsToday = scanRows.length;

      const uniqueUsers = new Set(
        scanRows
          .map((row: any) => row.user_id)
          .filter((id: any) => !!id)
      );
      uniqueVipsToday = uniqueUsers.size;

      pointsToday = scanRows.reduce((sum: number, row: any) => {
        const pts =
          typeof row.points === "number"
            ? row.points
            : parseInt(row.points as any, 10) || 0;
        return sum + pts;
      }, 0);
    }
  }

  // ---------------------------------------------------------------------------
  // 2) VIP base & active VIPs + VIP List
  //    Source of truth: rewards_user_overview
  // ---------------------------------------------------------------------------

  // Decide sort column
  let sortColumn: string = "last_scan_at";
  switch (sort) {
    case "points":
      sortColumn = "total_points";
      break;
    case "visits":
      sortColumn = "total_visits";
      break;
    case "last":
    default:
      sortColumn = "last_scan_at";
      break;
  }

  // Base query for VIPs
  let vipQuery = supabase
    .from("rewards_user_overview")
    .select("user_id, phone, full_name, is_vip, total_points, total_visits, last_scan_at")
    .eq("is_vip", true)
    .not("phone", "is", null);

  // Apply search by phone or name (ILIKE)
  if (q) {
    vipQuery = vipQuery.or(
      `phone.ilike.%${q}%,full_name.ilike.%${q}%`
    );
  }

  // Apply sort
  vipQuery = vipQuery.order(sortColumn, { ascending: sortColumn === "last_scan_at" ? false : false });

  const {
    data: vipOverview,
    error: vipOverviewError,
  } = await vipQuery;

  if (vipOverviewError) {
    console.error("[VIP Dashboard] Error loading rewards_user_overview:", vipOverviewError);
  }

  const vipRows = vipOverview ?? [];

  const vipBase = vipRows.length;

  // Active VIPs = VIPs with last_scan_at in the past 30 days
  const activeVipCount = vipRows.filter((row: any) => {
    if (!row.last_scan_at) return false;
    const last = new Date(row.last_scan_at as string);
    return last.toISOString() >= activeCutoffIso;
  }).length;

  const activeVipPercent =
    vipBase > 0 ? Math.round((activeVipCount / vipBase) * 100) : 0;

  // ---------------------------------------------------------------------------
  // 3) Render dashboard
  // ---------------------------------------------------------------------------

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Top row: 3 key stats */}
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Check-ins today"
            helper="VIPs who checked in with tonight's QR."
            value={checkinsToday}
          />
          <StatCard
            label="Unique VIPs today"
            helper="One per VIP per day."
            value={uniqueVipsToday}
          />
          <StatCard
            label="Points awarded today"
            helper="From today's check-ins and rewards."
            value={pointsToday}
          />
        </section>

        {/* Second row: 2 wider stats */}
        <section className="grid gap-4 md:grid-cols-2">
          <StatCard
            label="VIP base"
            helper="Total unique VIPs with a verified phone number."
            value={vipBase}
          />
          <StatCard
            label="Active VIPs"
            helper="% of VIPs with a recent check-in (last 30 days)."
            value={`${activeVipPercent}%`}
          />
        </section>

        {/* VIP List Table */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                VIP List
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Your active VIPs, their points, and last visit times.
              </p>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <form className="flex items-center gap-2" method="GET">
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="Search by name or phone…"
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <select
                  name="sort"
                  defaultValue={sort}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  <option value="last">Sort by last visit</option>
                  <option value="points">Sort by points</option>
                  <option value="visits">Sort by visits</option>
                </select>
                <button
                  type="submit"
                  className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 shadow-sm"
                >
                  Apply
                </button>
              </form>

              <a
                href="/api/vips/export"
                className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 shadow-sm text-center"
              >
                Export CSV
              </a>
            </div>
          </div>

          {vipRows.length === 0 ? (
            <div className="py-6 text-xs text-slate-400 text-center">
              No VIPs found yet. Once guests join VIP and check in, they&apos;ll appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="py-2 pr-3">VIP</th>
                    <th className="py-2 pr-3">Phone</th>
                    <th className="py-2 pr-3">Points</th>
                    <th className="py-2 pr-3">Visits</th>
                    <th className="py-2">Last Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {vipRows.map((u: any) => {
                    const name = u.full_name || "VIP Guest";
                    const phone = u.phone || "-";
                    const points = u.total_points ?? 0;
                    const visits = u.total_visits ?? 0;
                    const lastVisit = u.last_scan_at
                      ? new Date(u.last_scan_at).toLocaleString()
                      : "-";

                    return (
                      <tr
                        key={u.user_id ?? phone}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="py-2 pr-3 text-slate-900 font-medium">
                          <a
                            href={`/dashboard/vips/${u.user_id}`}
                            className="hover:underline"
                          >
                            {name}
                          </a>
                        </td>
                        <td className="py-2 pr-3 text-slate-700">{phone}</td>
                        <td className="py-2 pr-3">{points}</td>
                        <td className="py-2 pr-3">{visits}</td>
                        <td className="py-2 text-slate-500">{lastVisit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Third row: fan wall + quick actions side by side */}
        <section className="grid gap-4 lg:grid-cols-3">
          {/* Fan wall moderation (main) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                  Fan Wall moderation
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Review and approve fan photos before they show in the app.
                </p>
              </div>
              <button className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 shadow-sm">
                Refresh
              </button>
            </div>
            <div className="px-5 py-8 text-center text-xs text-slate-400">
              No fan photos yet. Once guests start posting from the Photo Booth,
              they&apos;ll appear here for approval.
            </div>
          </div>

          {/* Quick actions (side card) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col">
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              Quick actions
            </p>
            <p className="mt-1 mb-3 text-xs text-slate-500">
              Jump to common Sugarshack Downtown controls.
            </p>

            <div className="space-y-2 text-xs text-slate-700">
              <button
                type="button"
                className="w-full text-left rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <span className="block font-medium text-slate-900">
                  Tonight&apos;s show editor
                </span>
                <span className="block text-[11px] text-slate-500">
                  Update artist, start time, and notes for tonight.
                </span>
              </button>

              <button
                type="button"
                className="w-full text-left rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <span className="block font-medium text-slate-900">
                  Open full Fan Wall
                </span>
                <span className="block text-[11px] text-slate-500">
                  See all pending Photo Booth shots in one place.
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Bottom: exports / reports */}
        <section>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              VIP export &amp; reports
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Download VIP list and activity as CSV for campaigns.
            </p>
            <p className="mt-3 text-xs font-medium text-amber-500">
              Use the &quot;Export CSV&quot; button above the VIP List to
              download your current VIPs.
            </p>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
