import { supabaseServer } from "@/lib/supabaseServer";
import DashboardShell from "@/components/layout/DashboardShell";
import Link from "next/link";

type HeroStats = {
  pointsAwardedToday: number;
  pointsRedeemedToday: number;
  netPointsToday: number;
  newVipsToday: number;
  totalVips: number;
};

type TopRewardRow = {
  reward_name: string | null;
  redeem_count: number;
  total_points: number;
};

type TopStaffRow = {
  staff_label: string | null;
  redeem_count: number;
  total_points: number;
  last_redeem_at: string | null;
};

type RecentRedemptionRow = {
  created_at: string | null;
  reward_name: string | null;
  points_spent: number | null;
  staff_label: string | null;
  user_id: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

async function fetchHeroStats(): Promise<HeroStats> {
  const supabase = supabaseServer;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD for scan_date

  const startOfToday = new Date(`${todayStr}T00:00:00.000Z`).toISOString();
  const startOfTomorrow = new Date(
    new Date(startOfToday).getTime() + 24 * 60 * 60 * 1000
  ).toISOString();

  // Points awarded today from rewards_scans (positive points)
  const { data: scansToday, error: scansErr } = await supabase
    .from("rewards_scans")
    .select("points")
    .eq("scan_date", todayStr);

  if (scansErr) {
    console.error("[Rewards overview] error loading rewards_scans", scansErr);
  }

  let pointsAwardedToday = 0;
  (scansToday ?? []).forEach((row: any) => {
    const pts = Number(row.points ?? 0);
    if (pts > 0) {
      pointsAwardedToday += pts;
    }
  });

  // Points redeemed today from rewards_redemptions (points_spent > 0)
  const { data: redemptionsToday, error: redeemErr } = await supabase
    .from("rewards_redemptions")
    .select("points_spent, created_at")
    .gte("created_at", startOfToday)
    .lt("created_at", startOfTomorrow);

  if (redeemErr) {
    console.error(
      "[Rewards overview] error loading rewards_redemptions (today)",
      redeemErr
    );
  }

  let pointsRedeemedToday = 0;
  (redemptionsToday ?? []).forEach((row: any) => {
    const pts = Number(row.points_spent ?? 0);
    if (pts > 0) {
      pointsRedeemedToday += pts;
    }
  });

  const netPointsToday = pointsAwardedToday - pointsRedeemedToday;

  // New VIPs today from rewards_users
  const { data: newVipsRows, error: newVipsErr } = await supabase
    .from("rewards_users")
    .select("user_id, created_at")
    .gte("created_at", startOfToday)
    .lt("created_at", startOfTomorrow);

  if (newVipsErr) {
    console.error("[Rewards overview] error loading new VIPs", newVipsErr);
  }

  const newVipsToday = (newVipsRows ?? []).length;

  // Total VIPs (use count)
  const { count: totalVipsCount, error: totalVipsErr } = await supabase
    .from("rewards_users")
    .select("user_id", { count: "exact", head: true });

  if (totalVipsErr) {
    console.error("[Rewards overview] error loading total VIPs", totalVipsErr);
  }

  const totalVips = totalVipsCount ?? 0;

  return {
    pointsAwardedToday,
    pointsRedeemedToday,
    netPointsToday,
    newVipsToday,
    totalVips,
  };
}

async function fetchTopRewards(): Promise<TopRewardRow[]> {
  const supabase = supabaseServer;

  const now = new Date();
  const windowStart = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Pull raw rows and aggregate in JS
  const { data, error } = await supabase
    .from("rewards_redemptions")
    .select("reward_name, points_spent, created_at")
    .gte("created_at", windowStart);

  if (error) {
    console.error("[Rewards overview] error loading top rewards", error);
    return [];
  }

  const byReward = new Map<string, TopRewardRow>();

  (data ?? []).forEach((row: any) => {
    const key = row.reward_name || "Unknown reward";
    const points = Number(row.points_spent ?? 0);
    if (points <= 0) return; // only count positive (spent) points

    const existing = byReward.get(key) ?? {
      reward_name: row.reward_name,
      redeem_count: 0,
      total_points: 0,
    };

    existing.redeem_count += 1;
    existing.total_points += points;

    byReward.set(key, existing);
  });

  return Array.from(byReward.values())
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, 10);
}

async function fetchTopStaff(): Promise<TopStaffRow[]> {
  const supabase = supabaseServer;

  const now = new Date();
  const windowStart = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("rewards_redemptions")
    .select("staff_label, points_spent, created_at")
    .not("staff_label", "is", null)
    .gte("created_at", windowStart);

  if (error) {
    console.error("[Rewards overview] error loading top staff", error);
    return [];
  }

  const byStaff = new Map<string, TopStaffRow>();

  (data ?? []).forEach((row: any) => {
    const label = row.staff_label as string | null;
    if (!label) return;

    const points = Number(row.points_spent ?? 0);
    if (points <= 0) return;

    const createdAt: string | null = row.created_at ?? null;

    const existing = byStaff.get(label) ?? {
      staff_label: label,
      redeem_count: 0,
      total_points: 0,
      last_redeem_at: null,
    };

    existing.redeem_count += 1;
    existing.total_points += points;

    if (
      !existing.last_redeem_at ||
      (createdAt && createdAt > existing.last_redeem_at)
    ) {
      existing.last_redeem_at = createdAt;
    }

    byStaff.set(label, existing);
  });

  return Array.from(byStaff.values())
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, 10);
}

async function fetchRecentRedemptions(): Promise<RecentRedemptionRow[]> {
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("rewards_redemptions")
    .select("created_at, reward_name, points_spent, staff_label, user_id")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error(
      "[Rewards overview] error loading recent redemptions",
      error
    );
    return [];
  }

  return (data ?? []) as any;
}

export default async function RewardsOverviewPage() {
  const [hero, topRewards, topStaff, recent] = await Promise.all([
    fetchHeroStats(),
    fetchTopRewards(),
    fetchTopStaff(),
    fetchRecentRedemptions(),
  ]);

  return (
    <DashboardShell
      activeTab="rewards"
      title="Rewards overview"
      subtitle="High-level view of points awarded, redemptions, and VIP activity."
    >
      <div className="space-y-6">
        {/* Header card with Rewards sub-nav */}
        <div className="rounded-3xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Rewards overview
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Track VIP check-ins, points awarded, and reward redemptions at a
                glance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/rewards"
                className="inline-flex items-center rounded-full bg-yellow-400 px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-yellow-300"
              >
                Rewards menu
              </Link>
              <Link
                href="/rewards/vips"
                className="inline-flex items-center rounded-full border border-slate-300 bg_WHITE px-5 py-2 text-xs font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50"
              >
                VIP users
              </Link>
              <Link
                href="/rewards/staff-codes"
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50"
              >
                Staff codes
              </Link>
              <span className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm">
                Rewards overview
              </span>
            </div>
          </div>
        </div>

        {/* Hero stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <HeroCard
            label="Points awarded today"
            helper="Based on rewards_scans"
            value={hero.pointsAwardedToday}
          />
          <HeroCard
            label="Points redeemed today"
            helper="Based on rewards_redemptions"
            value={hero.pointsRedeemedToday}
          />
          <HeroCard
            label="Net points today"
            helper="Awarded − redeemed"
            value={hero.netPointsToday}
            highlight={hero.netPointsToday < 0 ? "negative" : "positive"}
          />
          <HeroCard
            label="New VIPs today"
            helper="New rewards profiles created"
            value={hero.newVipsToday}
          />
          <HeroCard
            label="Total VIPs"
            helper="All rewards users"
            value={hero.totalVips}
          />
        </div>

        {/* Lower section: top rewards, top staff, recent redemptions */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)]">
          {/* Top rewards */}
          <div className="rounded-3xl bg_WHITE p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify_between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Top rewards (last 30 days)
              </h2>
              <p className="text-[11px] text-slate-500">
                From rewards_redemptions
              </p>
            </div>
            {topRewards.length === 0 ? (
              <p className="text-sm text-slate-600">
                No rewards have been redeemed yet.
              </p>
            ) : (
              <div className="space-y-2">
                {topRewards.map((row, idx) => (
                  <div
                    key={`${row.reward_name ?? "unknown"}-${idx}`}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">
                        {row.reward_name || "Unknown reward"}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {row.redeem_count}{" "}
                        {row.redeem_count === 1 ? "redeem" : "redeems"}
                      </span>
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-900">
                      {row.total_points} pts
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top staff */}
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Top staff (last 30 days)
              </h2>
              <p className="text-[11px] text-slate-500">
                Based on staff_label in rewards_redemptions
              </p>
            </div>
            {topStaff.length === 0 ? (
              <p className="text-sm text-slate-600">
                No staff redemptions recorded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {topStaff.map((row, idx) => (
                  <div
                    key={`${row.staff_label ?? "unknown"}-${idx}`}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">
                        {row.staff_label || "Unknown staff"}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Last redeem: {formatDate(row.last_redeem_at)}
                      </span>
                    </div>
                    <div className="text-right text-xs text-slate-700">
                      <div className="font-semibold">
                        {row.total_points} pts
                      </div>
                      <div className="text-[11px]">
                        {row.redeem_count}{" "}
                        {row.redeem_count === 1 ? "redeem" : "redeems"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent redemptions */}
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Recent redemptions
              </h2>
            <p className="text-[11px] text-slate-500">
                Latest activity from rewards_redemptions
              </p>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-600">
                No redemptions recorded yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {recent.map((row, idx) => (
                  <div
                    key={`${row.created_at ?? "none"}-${idx}`}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">
                        {row.reward_name || "Reward redeemed"}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {formatDate(row.created_at)} {formatTime(row.created_at)}
                        {row.staff_label
                          ? ` · Staff: ${row.staff_label}`
                          : ""}
                      </span>
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-900">
                      {Number(row.points_spent ?? 0)} pts
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

type HeroCardProps = {
  label: string;
  helper: string;
  value: number;
  highlight?: "positive" | "negative";
};

function HeroCard({ label, helper, value, highlight }: HeroCardProps) {
  const valueClass =
    highlight === "negative"
      ? "text-red-600"
      : highlight === "positive"
      ? "text-emerald-600"
      : "text-slate-900";

  return (
    <div className="rounded-3xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${valueClass}`}>
        {value.toLocaleString("en-US")}
      </div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}
