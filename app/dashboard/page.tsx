// Path: app/dashboard/page.tsx
// Purpose: Main Sugarshack Downtown overview (check-ins, VIP health, fan wall, quick actions, Top VIPs).

import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/dashboardAuth";
import React from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Force dynamic so the dashboard always shows fresh stats.
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getDashboardSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = supabaseServer;

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

  type ScanRow = {
    user_id: string | null;
    points: number | null;
    scan_date: string;
    source: string | null;
    created_at: string | null;
  };

  function getTodayDateStringET(): string {
    // IMPORTANT: Rewards “one check-in per night” logic is Eastern time.
    // Use ET date string to prevent UTC drift in dashboard stats.
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
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

  function formatTimeOnlyET(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const today = getTodayDateStringET();

  // -----------------------------
  // 1) Today’s rewards_scans stats
  // -----------------------------
  let checkinsToday = 0;
  let uniqueVipsToday = 0;
  let pointsAwardedToday = 0;
  let pointsRedeemedToday = 0;

  const { data: scanRows } = await supabase
    .from("rewards_scans")
    .select("user_id, points, scan_date, source, created_at")
    .eq("scan_date", today);

  const rows = (scanRows ?? []) as ScanRow[];

  if (rows.length) {
    const checkinRows = rows.filter(
      (row) => (row.source ?? "").toLowerCase() === "qr-checkin"
    );

    checkinsToday = checkinRows.length;

    // Avoid counting "__none__" as a unique VIP if user_id is null
    const uniqueIds = new Set(
      checkinRows
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id))
    );
    uniqueVipsToday = uniqueIds.size;

    for (const row of rows) {
      const pts = Number(row.points ?? 0);
      if (!Number.isFinite(pts) || pts === 0) continue;
      if (pts > 0) pointsAwardedToday += pts;
      else pointsRedeemedToday += Math.abs(pts);
    }
  }

  const netPointsToday = pointsAwardedToday - pointsRedeemedToday;

  // -----------------------------
  // 1b) Tonight Snapshot (recent activity)
  // -----------------------------
  const sortedByCreated = [...rows].sort((a, b) => {
    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bt - at;
  });

  const recentCheckins = sortedByCreated
    .filter((r) => (r.source ?? "").toLowerCase() === "qr-checkin")
    .slice(0, 10);

  // If your redemption system records negative points in rewards_scans, this shows them.
  // If redemptions live in rewards_redemptions instead, we’ll switch in Sprint 1 Run 2.
  const recentRedemptions = sortedByCreated
    .filter((r) => Number(r.points ?? 0) < 0)
    .slice(0, 10);

  // -----------------------------
  // 2) VIP overview via rewards_user_overview
  // -----------------------------
  const { data: vipOverviewRows } = await supabase
    .from("rewards_user_overview")
    .select(
      "user_id, phone, full_name, is_vip, total_points, total_visits, last_scan_at"
    );

  const allUsers = (vipOverviewRows ?? []) as RewardsUserOverview[];
  const vipUsers = allUsers.filter((u) => u.is_vip);

  const vipBaseCount = vipUsers.length;
  const totalVipCount = vipBaseCount;

  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  const activeVipsCount = vipUsers.filter((u) => {
    if (!u.last_scan_at) return false;
    const last = new Date(u.last_scan_at).getTime();
    return !Number.isNaN(last) && nowMs - last <= THIRTY_DAYS;
  }).length;

  const activePercentage =
    vipBaseCount > 0 ? (activeVipsCount / vipBaseCount) * 100 : 0;

  // -----------------------------
  // 3) Fan Wall stats
  // -----------------------------
  const [
    { count: pendingCount },
    { count: liveCount },
    { count: hiddenCount },
    { count: totalCount },
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
    supabase.from("fan_wall_posts").select("id", { count: "exact", head: true }),
  ]);

  const fanPending = pendingCount ?? 0;
  const fanLive = liveCount ?? 0;
  const fanHidden = hiddenCount ?? 0;
  const fanTotal = totalCount ?? 0;

  // -----------------------------
  // 4) Top VIPs list
  // -----------------------------
  const topVipRows = [...vipUsers]
    .sort((a, b) => {
      const aTime = a.last_scan_at ? new Date(a.last_scan_at).getTime() : 0;
      const bTime = b.last_scan_at ? new Date(b.last_scan_at).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return (b.total_points ?? 0) - (a.total_points ?? 0);
    })
    .slice(0, 5);

  const vipList: VipListRow[] = topVipRows.map((row) => ({
    phoneLabel: formatPhone(row.phone),
    nameLabel: row.full_name || "VIP Guest",
    points: row.total_points ?? 0,
    visits: row.total_visits ?? 0,
    lastVisitLabel: formatDateTimeLabel(row.last_scan_at),
  }));

  // -----------------------------
  // Render
  // -----------------------------

  return (
    <DashboardShell
      title="Sugarshack Downtown VIP Dashboard"
      subtitle="Check-ins, VIP activity, and fan content at a glance."
      activeTab="dashboard"
    >
      <div className="space-y-6">
        {/* Top stat row */}
        <div className="grid gap-4 md:grid-cols-5">
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
            helper="Points given from check-ins and boosts."
            value={pointsAwardedToday}
          />
          <StatCard
            label="Points redeemed today"
            helper="Points spent on rewards today."
            value={pointsRedeemedToday}
          />
          <StatCard
            label="Net points today"
            helper="Awarded minus redeemed (today only)."
            value={netPointsToday}
          />
        </div>

        {/* NEW: Tonight snapshot (incorporates key value of Tonight Board) */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                Tonight snapshot
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Recent activity feed for today ({today}, Eastern).
              </p>
            </div>

            <Link
              href="/dashboard/tonight"
              className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 shadow-sm"
            >
              Open full Tonight Board
            </Link>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Recent check-ins
              </p>

              {recentCheckins.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">
                  No check-ins yet today.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-[0.12em] text-slate-500 border-b border-slate-100">
                        <th className="py-2 pr-3 text-left font-semibold">
                          Time (ET)
                        </th>
                        <th className="py-2 pr-3 text-left font-semibold">
                          User
                        </th>
                        <th className="py-2 text-right font-semibold">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentCheckins.map((r, idx) => (
                        <tr
                          key={`checkin-${r.user_id ?? "na"}-${idx}`}
                          className="border-b border-slate-50 last:border-0"
                        >
                          <td className="py-2 pr-3 text-[13px] text-slate-700">
                            {formatTimeOnlyET(r.created_at) || "—"}
                          </td>
                          <td className="py-2 pr-3 text-[13px] text-slate-900">
                            {r.user_id ? r.user_id.slice(0, 8) : "Guest"}
                          </td>
                          <td className="py-2 text-right text-[13px] text-slate-900">
                            {Number(r.points ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Recent redemptions
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                If redemptions are stored in a dedicated table, we’ll switch this
                to it next run.
              </p>

              {recentRedemptions.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">
                  No redemptions recorded in scans today.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-[0.12em] text-slate-500 border-b border-slate-100">
                        <th className="py-2 pr-3 text-left font-semibold">
                          Time (ET)
                        </th>
                        <th className="py-2 pr-3 text-left font-semibold">
                          User
                        </th>
                        <th className="py-2 text-right font-semibold">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRedemptions.map((r, idx) => (
                        <tr
                          key={`redeem-${r.user_id ?? "na"}-${idx}`}
                          className="border-b border-slate-50 last:border-0"
                        >
                          <td className="py-2 pr-3 text-[13px] text-slate-700">
                            {formatTimeOnlyET(r.created_at) || "—"}
                          </td>
                          <td className="py-2 pr-3 text-[13px] text-slate-900">
                            {r.user_id ? r.user_id.slice(0, 8) : "Guest"}
                          </td>
                          <td className="py-2 text-right text-[13px] text-slate-900">
                            {Math.abs(Number(r.points ?? 0))}
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

        {/* VIP base + active percentage */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <StatCard
            label="VIP base"
            helper="Total unique VIPs with a rewards profile."
            value={vipBaseCount}
          />
          <PercentCard
            label="Active VIPs"
            helper="% of VIPs with a recent check-in (last 30 days)."
            value={activePercentage}
          />
        </div>

        {/* Fan wall + Quick actions */}
        <div className="grid gap-4 lg:grid-cols-3">
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
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Pending
                </p>
                <p className="mt-1 text-xl font-semibold text-amber-600">
                  {fanPending}
                </p>
                <p className="text-[11px] text-slate-500">Awaiting approval</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Live
                </p>
                <p className="mt-1 text-xl font-semibold text-emerald-600">
                  {fanLive}
                </p>
                <p className="text-[11px] text-slate-500">Showing in the app</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Hidden
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-700">
                  {fanHidden}
                </p>
                <p className="text-[11px] text-slate-500">Removed/hidden</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Total submissions
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {fanTotal}
                </p>
                <p className="text-[11px] text-slate-500">All-time photos</p>
              </div>
            </div>
          </section>

          {/* Quick actions */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              Quick actions
            </p>
            <p className="mt-1 mb-3 text-xs text-slate-500">
              Jump to common Sugarshack Downtown controls.
            </p>

            <div className="space-y-2 text-xs">
              <Link
                href="/dashboard/tonight"
                className="block w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 hover:bg-amber-100"
              >
                <p className="font-medium text-slate-900">
                  Tonight&apos;s live board
                </p>
                <p className="text-[11px] text-slate-600">
                  See today&apos;s check-ins, points, and redemptions in real
                  time.
                </p>
              </Link>

              <Link
                href="/events"
                className="block w-full rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <p className="font-medium text-slate-900">
                  Tonight’s show editor
                </p>
                <p className="text-[11px] text-slate-500">
                  Edit tonight’s performers & times.
                </p>
              </Link>

              <Link
                href="/fan-wall"
                className="block w-full rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <p className="font-medium text-slate-900">
                  Open full Fan Wall
                </p>
                <p className="text-[11px] text-slate-500">
                  Moderate & approve Photo Booth shots.
                </p>
              </Link>

              <Link
                href="/notifications"
                className="block w-full rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <p className="font-medium text-slate-900">
                  Send push notification
                </p>
                <p className="text-[11px] text-slate-500">
                  Reach VIPs and guests instantly.
                </p>
              </Link>
            </div>
          </section>
        </div>

        {/* Top VIPs */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                Top VIPs
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Uses{" "}
                <code className="font-mono text-[10px]">
                  rewards_user_overview
                </code>{" "}
                (same points as the mobile app). Total VIPs:{" "}
                <span className="font-semibold text-slate-900">
                  {totalVipCount}
                </span>
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
            <p className="text-xs text-slate-400">No VIP activity yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.12em] text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-3 text-left font-semibold">VIP</th>
                    <th className="py-2 pr-3 text-left font-semibold">Phone</th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      Points
                    </th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      Visits
                    </th>
                    <th className="py-2 text-right font-semibold">Last visit</th>
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

// -----------------------------
// Presentational components
// -----------------------------

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

function PercentCard({
  label,
  helper,
  value,
}: {
  label: string;
  helper: string;
  value: number;
}) {
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
