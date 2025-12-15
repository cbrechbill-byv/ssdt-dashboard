// app/dashboard/RedemptionHealth.tsx
// Path: /dashboard (component used on /dashboard)
// Purpose: Redemption Health card (EST day), showing today + last 7 days stats + data quality flags.

import React from "react";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 0;

type RedemptionRow = {
  id: string;
  user_id: string | null;
  reward_name: string | null;
  points_spent: number | null;
  staff_label: string | null;
  staff_last4: string | null;
  created_at: string;
};

type ScanRow = {
  id: string;
  user_id: string | null;
  scan_date: string; // YYYY-MM-DD
  source: string | null;
  points: number | null;
};

function getEasternYMD(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
}

function ymdToMdy(ymd: string | null): string {
  // Convert "YYYY-MM-DD" -> "MM-DD-YYYY" (no Date parsing; avoids UTC shifts)
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${m}-${d}-${y}`;
}

function estDayStartIso(ymd: string) {
  // Label only
  return `${ymdToMdy(ymd)} 00:00 (ET)`;
}

function formatShortEt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // MM-DD-YYYY h:mm AM/PM
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function RedemptionHealth() {
  const supabase = supabaseServer;

  const now = new Date();
  const todayET = getEasternYMD(now);

  const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); // inclusive window: today + previous 6 days
  const windowStartET = getEasternYMD(sevenDaysAgo);

  // Build an ET-based time window for redemptions using “local midnight ET” boundaries.
  // For Supabase filtering, we use >= dayStart AND < nextDayStart based on ET date strings.
  function etMidnightToUtcIso(ymd: string) {
    const [y, m, d] = ymd.split("-").map((x) => Number(x));
    const approxUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const etOffsetMinutes = (() => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).formatToParts(approxUtc);

      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      const dispY = Number(get("year"));
      const dispM = Number(get("month"));
      const dispD = Number(get("day"));
      const dispH = Number(get("hour"));
      const dispMin = Number(get("minute"));
      const displayedAsMinutes =
        Date.UTC(dispY, dispM - 1, dispD, dispH, dispMin, 0) -
        Date.UTC(dispY, dispM - 1, dispD, 0, 0, 0);

      return displayedAsMinutes / 60000;
    })();

    const corrected = new Date(approxUtc.getTime() - etOffsetMinutes * 60 * 1000);
    return corrected.toISOString();
  }

  const todayStartUtcIso = etMidnightToUtcIso(todayET);
  const tomorrowET = getEasternYMD(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const tomorrowStartUtcIso = etMidnightToUtcIso(tomorrowET);

  const windowStartUtcIso = etMidnightToUtcIso(windowStartET);
  const afterWindowEndET = getEasternYMD(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const windowEndUtcIso = etMidnightToUtcIso(afterWindowEndET);

  const [
    { data: todaysRedemptions, error: todaysRedemptionsError },
    { data: weekRedemptions, error: weekRedemptionsError },
  ] = await Promise.all([
    supabase
      .from("rewards_redemptions")
      .select(
        "id, user_id, reward_name, points_spent, staff_label, staff_last4, created_at"
      )
      .gte("created_at", todayStartUtcIso)
      .lt("created_at", tomorrowStartUtcIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("rewards_redemptions")
      .select(
        "id, user_id, reward_name, points_spent, staff_label, staff_last4, created_at"
      )
      .gte("created_at", windowStartUtcIso)
      .lt("created_at", windowEndUtcIso)
      .order("created_at", { ascending: false }),
  ]);

  if (todaysRedemptionsError) {
    console.error(
      "[RedemptionHealth] todays redemptions error",
      todaysRedemptionsError
    );
  }
  if (weekRedemptionsError) {
    console.error("[RedemptionHealth] week redemptions error", weekRedemptionsError);
  }

  const todays: RedemptionRow[] = (todaysRedemptions ?? []) as RedemptionRow[];
  const week: RedemptionRow[] = (weekRedemptions ?? []) as RedemptionRow[];

  const todayCount = todays.length;
  const weekCount = week.length;
  const avgPerDay = weekCount / 7;

  const uniqueRedeemersToday = new Set(todays.map((r) => r.user_id).filter(Boolean))
    .size;
  const uniqueRedeemersWeek = new Set(week.map((r) => r.user_id).filter(Boolean)).size;

  const pointsSpentToday = todays.reduce(
    (sum, r) => sum + Math.max(0, Number(r.points_spent ?? 0)),
    0
  );
  const pointsSpentWeek = week.reduce(
    (sum, r) => sum + Math.max(0, Number(r.points_spent ?? 0)),
    0
  );

  // Data quality flags
  const missingStaffToday = todays.filter(
    (r) =>
      !(r.staff_label && r.staff_label.trim()) ||
      !(r.staff_last4 && r.staff_last4.trim())
  ).length;
  const missingRewardNameToday = todays.filter(
    (r) => !(r.reward_name && r.reward_name.trim())
  ).length;
  const invalidPointsToday = todays.filter(
    (r) => !Number.isFinite(Number(r.points_spent)) || Number(r.points_spent) <= 0
  ).length;

  const missingStaffWeek = week.filter(
    (r) =>
      !(r.staff_label && r.staff_label.trim()) ||
      !(r.staff_last4 && r.staff_last4.trim())
  ).length;
  const missingRewardNameWeek = week.filter(
    (r) => !(r.reward_name && r.reward_name.trim())
  ).length;
  const invalidPointsWeek = week.filter(
    (r) => !Number.isFinite(Number(r.points_spent)) || Number(r.points_spent) <= 0
  ).length;

  // Top redeemed reward (week)
  const rewardCounts = new Map<string, number>();
  for (const r of week) {
    const name = (r.reward_name ?? "").trim() || "Unknown reward";
    rewardCounts.set(name, (rewardCounts.get(name) ?? 0) + 1);
  }
  const topReward = [...rewardCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  // --- “Orphan” redemptions today (no scan record for user today) ---
  const todayScansRes = await supabase
    .from("rewards_scans")
    .select("id, user_id, scan_date, source, points")
    .eq("scan_date", todayET)
    .order("scanned_at", { ascending: false });

  if (todayScansRes.error) {
    console.error("[RedemptionHealth] today scans error", todayScansRes.error);
  }

  const todayScans: ScanRow[] = (todayScansRes.data ?? []) as ScanRow[];
  const scannedUsersToday = new Set(todayScans.map((s) => s.user_id).filter(Boolean));

  let orphanRedemptionsToday = 0;
  for (const r of todays) {
    if (r.user_id && !scannedUsersToday.has(r.user_id)) orphanRedemptionsToday += 1;
  }

  const hasIssuesToday = missingStaffToday + missingRewardNameToday + invalidPointsToday > 0;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-900">
            Redemption health (EST)
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {ymdToMdy(todayET)} · Tracks reward redemptions and data completeness
            (staff + reward + points).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/rewards"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-amber-50"
          >
            Open Rewards editor
          </Link>
          <Link
            href="/dashboard/tonight"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-amber-50"
          >
            Open Tonight board
          </Link>
        </div>
      </div>

      {/* Errors (non-blocking) */}
      {(todaysRedemptionsError || weekRedemptionsError || todayScansRes.error) && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-xs text-rose-700">
            One or more redemption queries failed. This card may be incomplete.
          </p>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-4 text-xs">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
            Redemptions today
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{todayCount}</p>
          <p className="text-[11px] text-slate-500">
            {uniqueRedeemersToday} unique redeemers
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
            Points spent today
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{pointsSpentToday}</p>
          <p className="text-[11px] text-slate-500">Approved redemptions only</p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
            Last 7 days
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{weekCount}</p>
          <p className="text-[11px] text-slate-500">
            ~{avgPerDay.toFixed(1)}/day · {uniqueRedeemersWeek} unique
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Status</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {hasIssuesToday ? "⚠️" : "✅"}
          </p>
          <p className="text-[11px] text-slate-500">
            {hasIssuesToday ? "Some items need attention" : "No issues detected today"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Data checks */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Data checks (today)
            </p>
            <p className="text-[11px] text-slate-400">
              ET window · {estDayStartIso(todayET)}
            </p>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                Missing staff
              </p>
              <p className="mt-1 text-lg font-semibold text-amber-600">{missingStaffToday}</p>
              <p className="text-[11px] text-slate-500">staff_label or last4 blank</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                Missing reward
              </p>
              <p className="mt-1 text-lg font-semibold text-amber-600">
                {missingRewardNameToday}
              </p>
              <p className="text-[11px] text-slate-500">reward_name blank</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                Invalid points
              </p>
              <p className="mt-1 text-lg font-semibold text-amber-600">{invalidPointsToday}</p>
              <p className="text-[11px] text-slate-500">points_spent ≤ 0</p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Orphan signal
            </p>
            <p className="mt-1 text-xs text-slate-700">
              {orphanRedemptionsToday} redemption{orphanRedemptionsToday === 1 ? "" : "s"} today have no
              matching scan record for that user on {ymdToMdy(todayET)}.
              <span className="text-slate-500">
                {" "}
                (Not always bad — but useful if auto-check-in ever breaks.)
              </span>
            </p>
          </div>
        </div>

        {/* Top reward + recent list */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Redemption trends
          </p>

          <div className="mt-2 text-xs text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Top reward (7d)</span>
              <span className="font-semibold text-slate-900">
                {topReward ? `${topReward[0]} (${topReward[1]})` : "—"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="text-slate-500">Points spent (7d)</span>
              <span className="font-semibold text-slate-900">{pointsSpentWeek}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="text-slate-500">Data issues (7d)</span>
              <span className="font-semibold text-slate-900">
                {missingStaffWeek + missingRewardNameWeek + invalidPointsWeek}
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Most recent (today)
              </p>
              <p className="text-[11px] text-slate-400">
                {todays.length > 0 ? `Last: ${formatShortEt(todays[0].created_at)}` : "—"}
              </p>
            </div>

            {todays.length === 0 ? (
              <p className="mt-2 text-xs text-slate-600">No redemptions yet today.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {todays.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {(r.reward_name ?? "").trim() || "Unknown reward"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatShortEt(r.created_at)}
                        {" · "}
                        {r.staff_label ? r.staff_label : "No staff"}
                        {r.staff_last4 ? ` (${r.staff_last4})` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      -{Math.max(0, Number(r.points_spent ?? 0))} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
