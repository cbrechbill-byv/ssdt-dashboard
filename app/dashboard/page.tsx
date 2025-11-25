import React from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

/* Force dynamic so we always see fresh stats */
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  TYPES                                                             */
/* ------------------------------------------------------------------ */

type DailySummary = {
  scan_date: string;
  total_scans: number | null;
  unique_vips_checked_in: number | null;
  total_points_earned: number | null;
};

type RewardsUserOverview = {
  user_id: string | null;
  phone: string | null;
  full_name: string | null;
  is_vip: boolean | null;
  total_points: number | null;
  total_visits: number | null;
  last_scan_at: string | null;
};

type VipListRow = {
  phoneLabel: string;
  nameLabel: string;
  points: number;
  visits: number;
  lastVisitLabel: string;
};

type StatCardProps = {
  label: string;
  helper: string;
  value: string | number;
};

/* ------------------------------------------------------------------ */
/*  HELPERS                                                           */
/* ------------------------------------------------------------------ */

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

function PercentCard(props: {
  label: string;
  helper: string;
  value: number;
}) {
  const { label, helper, value } = props;
  const clamped = Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
      <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">
        {clamped.toFixed(0)}%
      </p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full bg-emerald-500 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

// Simple "today" date string (YYYY-MM-DD) in local time.
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPhone(phone?: string | null): string {
  if (!phone) return "Unknown";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
      6,
      10
    )}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
  }
  return digits;
}

function formatDateTimeLabel(iso: string | null): string {
  if (!iso) return "No visits yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No visits yet";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                              */
/* ------------------------------------------------------------------ */

export default async function DashboardPage() {
  const supabase = supabaseServer;

  const today = getTodayDateString();

  // 1) Today's stats: check-ins, unique VIPs, points
  let checkinsToday = 0;
  let uniqueVipsToday = 0;
  let pointsToday = 0;

  const {
    data: dailySummaryRows,
    error: dailyError,
  } = await supabase
    .from("rewards_daily_summary")
    .select(
      "scan_date, total_scans, unique_vips_checked_in, total_points_earned"
    )
    .eq("scan_date", today)
    .limit(1);

  if (dailyError) {
    console.error(
      "[VIP Dashboard] Error loading rewards_daily_summary:",
      dailyError
    );
  }

  const daily = dailySummaryRows?.[0] as DailySummary | undefined;

  if (daily) {
    checkinsToday = Number(daily.total_scans ?? 0);
    uniqueVipsToday = Number(daily.unique_vips_checked_in ?? 0);
    pointsToday = Number(daily.total_points_earned ?? 0);
  } else {
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
      uniqueVipsToday = new Set(
        scanRows.map((row: any) => row.user_id ?? "__none__")
      ).size;
      pointsToday = scanRows.reduce(
        (sum: number, row: any) => sum + Number(row.points ?? 0),
        0
      );
    }
  }

  // 2) VIP overview from rewards_user_overview
  const {
    data: vipOverviewRows,
    error: vipOverviewError,
  } = await supabase
    .from("rewards_user_overview")
    .select(
      "user_id, phone, full_name, is_vip, total_points, total_visits, last_scan_at"
    );

  if (vipOverviewError) {
    console.error(
      "[VIP Dashboard] Error loading rewards_user_overview:",
      vipOverviewError
    );
  }

  const allUsers = (vipOverviewRows ?? []) as RewardsUserOverview[];
  const vipUsers = allUsers.filter((u) => u.is_vip);

  const vipBaseCount = vipUsers.length;

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  const activeVipsCount = vipUsers.filter((u) => {
    if (!u.last_scan_at) return false;
    const last = new Date(u.last_scan_at).getTime();
    if (Number.isNaN(last)) return false;
    return nowMs - last <= THIRTY_DAYS_MS;
  }).length;

  const activePercentage =
    vipBaseCount > 0 ? (activeVipsCount / vipBaseCount) * 100 : 0;

  // 3) Fan wall stats (count-only queries)
  const [
    { count: pendingCount, error: pendingError },
    { count: liveCount, error: liveError },
    { count: hiddenCount, error: hiddenError },
    { count: totalCount, error: totalError },
  ] = await Promise.all([
    supabase
      .from("fan_wall_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", false)
      .eq("is_hidden", false),
    supabase
      .from("fan_wall_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", true)
      .eq("is_hidden", false),
    supabase
      .from("fan_wall_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_hidden", true),
    supabase
      .from("fan_wall_posts")
      .select("id", { count: "exact", head: true }),
  ]);

  if (pendingError || liveError || hiddenError || totalError) {
    console.error("[Dashboard] Fan wall stats error:", {
      pendingError,
      liveError,
      hiddenError,
      totalError,
    });
  }

  const fanPending = pendingCount ?? 0;
  const fanLive = liveCount ?? 0;
  const fanHidden = hiddenCount ?? 0;
  const fanTotal = totalCount ?? 0;

  // 4) VIP list (Top 5)
  const topVipRows = [...vipUsers]
    .sort((a, b) => {
      const aTime = a.last_scan_at ? new Date(a.last_scan_at).getTime() : 0;
      const bTime = b.last_scan_at ? new Date(b.last_scan_at).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;

      const aPoints = a.total_points ?? 0;
      const bPoints = b.total_points ?? 0;
      return bPoints - aPoints;
    })
    .slice(0, 5);

  const vipList: VipListRow[] = topVipRows.map((row) => ({
    phoneLabel: formatPhone(row.phone),
    nameLabel: row.full_name || "VIP Guest",
    points: row.total_points ?? 0,
    visits: row.total_visits ?? 0,
    lastVisitLabel: formatDateTimeLabel(row.last_scan_at),
  }));

  const totalVipCount = vipUsers.length;

  // 5) Render
  return (
    <DashboardShell
      title="Sugarshack Downtown VIP Dashboard"
      subtitle="Check-ins, VIP activity, and fan content at a glance." activeTab="dashboard"
    >
      <div className="space-y-6">
        {/* Top stats row */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Check-ins today"
            helper="VIPs who checked in with tonight’s QR."
            value={checkinsToday}
          />
          <StatCard
            label="Unique VIPs today"
            helper="One per phone number per day."
            value={uniqueVipsToday}
          />
          <StatCard
            label="Points awarded today"
            helper="From today’s check-ins and rewards."
            value={pointsToday}
          />
        </div>

        {/* Second stats row */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <StatCard
            label="VIP base"
            helper="Total unique VIPs with a verified phone number."
            value={vipBaseCount}
          />
          <PercentCard
            label="Active VIPs"
            helper="% of VIPs with a recent check-in (last 30 days)."
            value={activePercentage}
          />
        </div>

        {/* Third row: fan wall moderation + quick actions */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Fan Wall moderation stats card */}
          <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                  Fan Wall moderation
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  High-level view of what’s waiting on the Fan Wall.
                </p>
              </div>
              <Link
                href="/fan-wall"
                className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 shadow-sm"
              >
                Open Fan Wall
              </Link>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-4 text-xs">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">
                  Pending
                </span>
                <span className="mt-1 text-xl font-semibold text-amber-600">
                  {fanPending}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  Awaiting approval
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">
                  Live
                </span>
                <span className="mt-1 text-xl font-semibold text-emerald-600">
                  {fanLive}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  Showing in the app
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">
                  Hidden
                </span>
                <span className="mt-1 text-xl font-semibold text-slate-700">
                  {fanHidden}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  Removed or inappropriate
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">
                  Total submissions
                </span>
                <span className="mt-1 text-xl font-semibold text-slate-900">
                  {fanTotal}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  All-time fan uploads
                </span>
              </div>
            </div>
          </section>

          {/* Quick actions card */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col">
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              Quick actions
            </p>
            <p className="mt-1 mb-3 text-xs text-slate-500">
              Jump to common Sugarshack Downtown controls.
            </p>

            <div className="space-y-2 text-xs">
  <Link
    href="/events"
    className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
  >
    <span className="font-medium text-slate-900">
      Tonight’s show editor
    </span>
    <span className="block text-[11px] text-slate-500">
      Open today’s show in Events to edit who’s on stage and the set time.
    </span>
  </Link>

  <Link
    href="/fan-wall"
    className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
  >
    <span className="font-medium text-slate-900">
      Open full Fan Wall
    </span>
    <span className="block text-[11px] text-slate-500">
      Moderate and approve Photo Booth shots.
    </span>
  </Link>

  <Link
    href="/notifications"
    className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
  >
    <span className="font-medium text-slate-900">
      Send push notification
    </span>
    <span className="block text-[11px] text-slate-500">
      Reach VIPs and guests with a new message.
    </span>
  </Link>
</div>
          </section>
        </div>

        {/* VIP list row (bottom of page) */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                Top VIPs
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Showing the most recent and engaged VIPs. Total VIP base:{" "}
                <span className="font-semibold text-slate-900">
                  {totalVipCount}
                </span>
                .
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 shadow-sm"
            >
              Export CSV
            </button>
          </div>

          {vipList.length === 0 ? (
            <p className="text-xs text-slate-400">
              No VIP activity yet. Once guests start checking in, you’ll see
              your top VIPs here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.12em] text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-3 text-left font-semibold">VIP</th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Phone
                    </th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      Points
                    </th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      Visits
                    </th>
                    <th className="py-2 text-right font-semibold">
                      Last visit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vipList.map((row, idx) => (
                    <tr
                      key={`${row.phoneLabel}-${idx}`}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="py-2 pr-3 text-[13px] text-slate-900">
                        {row.nameLabel}
                      </td>
                      <td className="py-2 pr-3 text-[13px] text-slate-700">
                        {row.phoneLabel}
                      </td>
                      <td className="py-2 pr-3 text-right text-[13px] text-slate-900">
                        {row.points}
                      </td>
                      <td className="py-2 pr-3 text-right text-[13px] text-slate-900">
                        {row.visits}
                      </td>
                      <td className="py-2 text-right text-[13px] text-slate-600">
                        {row.lastVisitLabel}
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


