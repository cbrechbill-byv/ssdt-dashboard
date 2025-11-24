import React from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

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

type FanWallPost = {
  id: string;
  is_approved: boolean;
  is_hidden: boolean;
};

type VipListRow = {
  phoneLabel: string;
  nameLabel: string;
  points: number;
  visits: number;
  lastVisitLabel: string;
};

function formatDateTimeLabel(value: string | null): string {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";

  return dt.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  // Very light formatting: +1XXXYYYZZZZ
  if (phone.startsWith("+1") && phone.length === 12) {
    return `${phone.slice(0, 2)} ${phone.slice(2, 5)}-${phone.slice(
      5,
      8
    )}-${phone.slice(8)}`;
  }
  return phone;
}

function StatCard(props: {
  label: string;
  helper: string;
  value: string | number;
}) {
  const { label, helper, value } = props;
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
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

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

export default async function DashboardPage() {
  // -------------------------
  // 1. Pull today’s summary
  // -------------------------
  const todayDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC; good enough for now)

  const { data: todayRow, error: todayError } = await supabaseServer
    .from("rewards_daily_summary")
    .select(
      "scan_date, total_scans, unique_vips_checked_in, total_points_earned"
    )
    .eq("scan_date", todayDate)
    .limit(1)
    .single<DailySummary>();

  if (todayError && todayError.code !== "PGRST116") {
    // PGRST116 = row not found; we treat that as 0s
    console.error("[Dashboard] daily summary error:", todayError);
  }

  const checkinsToday = todayRow?.total_scans ?? 0;
  const uniqueVipsToday = todayRow?.unique_vips_checked_in ?? 0;
  const pointsToday = todayRow?.total_points_earned ?? 0;

  // -------------------------
  // 2. VIP overview
  // -------------------------
  const { data: vipOverviewRows, error: vipOverviewError } =
    await supabaseServer
      .from("rewards_user_overview")
      .select(
        "user_id, phone, full_name, is_vip, total_points, total_visits, last_scan_at"
      );

  if (vipOverviewError) {
    console.error("[Dashboard] rewards_user_overview error:", vipOverviewError);
  }

  const allUsers = (vipOverviewRows ?? []) as RewardsUserOverview[];
  const vipUsers = allUsers.filter((u) => u.is_vip);

  const vipBaseCount = vipUsers.length;

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const activeVipsCount = vipUsers.filter((u) => {
    if (!u.last_scan_at) return false;
    const last = new Date(u.last_scan_at).getTime();
    if (Number.isNaN(last)) return false;
    return now - last <= THIRTY_DAYS_MS;
  }).length;

  const activePercentage =
    vipBaseCount > 0 ? (activeVipsCount / vipBaseCount) * 100 : 0;

  // -------------------------
  // 3. Fan wall stats
  // -------------------------
  const { data: fanWallRows, error: fanWallError } = await supabaseServer
    .from("fan_wall_posts")
    .select("id, is_approved, is_hidden");

  if (fanWallError) {
    console.error("[Dashboard] fan wall stats error:", fanWallError);
  }

  const fanPosts = (fanWallRows ?? []) as FanWallPost[];
  const fanTotal = fanPosts.length;
  const fanPending = fanPosts.filter(
    (p) => !p.is_hidden && !p.is_approved
  ).length;
  const fanLive = fanPosts.filter(
    (p) => !p.is_hidden && p.is_approved
  ).length;
  const fanHidden = fanPosts.filter((p) => p.is_hidden).length;

  // -------------------------
  // 4. VIP list (top 5)
  // -------------------------
  const topVipRows = [...vipUsers]
    .sort((a, b) => {
      // Sort by last_scan_at desc, then points desc
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

  // -------------------------
  // 5. Render
  // -------------------------
  return (
    <DashboardShell
      title="Sugarshack Downtown VIP Dashboard"
      subtitle="Check-ins, VIP activity, and fan content at a glance."
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

        {/* Fan Wall overview + Quick actions + VIP list */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)]">
          <div className="space-y-6">
            {/* Fan Wall moderation – high-level stats */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-slate-100">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                    Fan Wall moderation
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    High-level view of Photo Booth posts. Use the Fan Wall tab
                    to review each photo.
                  </p>
                </div>
                <a
                  href="/fan-wall"
                  className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Open Fan Wall
                </a>
              </div>

              <div className="grid gap-4 px-6 py-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                    Pending approval
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-amber-700">
                    {fanPending}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                    Live on Fan Wall
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-700">
                    {fanLive}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                    Hidden
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-rose-700">
                    {fanHidden}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                    Total submissions
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {fanTotal}
                  </p>
                </div>
              </div>
            </section>

            {/* VIP list */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-slate-100">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                    VIP list
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Top VIPs by last visit. Expand to see the full list.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search name or phone…"
                    className="hidden md:block rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    readOnly
                  />
                  <button
                    type="button"
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <th className="px-6 py-2 text-left">VIP</th>
                      <th className="px-3 py-2 text-left">Phone</th>
                      <th className="px-3 py-2 text-right">Points</th>
                      <th className="px-3 py-2 text-right">Visits</th>
                      <th className="px-6 py-2 text-right">Last visit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vipList.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-6 text-center text-xs text-slate-400"
                        >
                          No VIPs yet. Once guests start checking in, they&apos;ll
                          appear here.
                        </td>
                      </tr>
                    )}

                    {vipList.map((row, idx) => (
                      <tr key={`${row.phoneLabel}-${idx}`} className="hover:bg-slate-50">
                        <td className="px-6 py-2">
                          <div className="font-medium text-slate-900">
                            {row.nameLabel}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {row.phoneLabel}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">
                          {row.points}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {row.visits}
                        </td>
                        <td className="px-6 py-2 text-right text-slate-600">
                          {row.lastVisitLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 text-[11px] text-slate-500">
                <span>
                  Showing {vipList.length} of {totalVipCount} VIPs
                </span>
                <button
                  type="button"
                  className="text-xs font-medium text-sky-600 hover:text-sky-500"
                >
                  View full VIP list
                </button>
              </div>
            </section>
          </div>

          {/* Quick actions column */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-6 pt-4 pb-3 border-b border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                Quick actions
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Jump to common Sugarshack Downtown controls.
              </p>
            </div>

            <div className="space-y-2 px-6 py-4">
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
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
