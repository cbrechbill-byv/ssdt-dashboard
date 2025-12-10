// app/rewards/overview/page.tsx
// Path: /rewards/overview
// Rewards overview – at-a-glance stats for points, VIPs, and redemptions.

import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { redirect } from "next/navigation";

type TodayStats = {
  pointsAwarded: number;
  pointsRedeemed: number;
  netPoints: number;
  newVips: number;
  totalVips: number;
};

type TopReward = {
  reward_name: string;
  redemptions: number;
  points_spent: number;
};

type TopStaff = {
  staff_label: string;
  redemptions: number;
  points_spent: number;
};

type RecentRedemption = {
  id: string;
  reward_name: string;
  points_spent: number;
  staff_label: string;
  created_at: string;
};

async function requireDashboardSession() {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  return session;
}

function startOfTodayUTC() {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  );
  return d.toISOString();
}

function daysAgoUTC(days: number) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - days);
  now.setUTCHours(0, 0, 0, 0);
  return now.toISOString();
}

function formatDateTime(dateString: string) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function fetchTodayStats(): Promise<TodayStats> {
  const todayStart = startOfTodayUTC();

  // Points awarded today (from rewards_scans, positive points)
  const { data: scansToday, error: scansError } = await supabaseServer
    .from("rewards_scans")
    .select("points")
    .gte("scanned_at", todayStart);

  if (scansError) {
    console.error("[overview] scansToday error", scansError);
  }

  let pointsAwarded = 0;
  (scansToday ?? []).forEach((row: any) => {
    const pts = Number(row.points ?? 0);
    if (!Number.isFinite(pts)) return;
    if (pts > 0) pointsAwarded += pts;
  });

  // Points redeemed today (from rewards_redemptions)
  const { data: redemptionsToday, error: redError } = await supabaseServer
    .from("rewards_redemptions")
    .select("points_spent, created_at")
    .gte("created_at", todayStart);

  if (redError) {
    console.error("[overview] redemptionsToday error", redError);
  }

  let pointsRedeemed = 0;
  (redemptionsToday ?? []).forEach((row: any) => {
    const pts = Number(row.points_spent ?? 0);
    if (!Number.isFinite(pts)) return;
    pointsRedeemed += pts;
  });

  // VIP counts
  const { data: vipRows, error: vipError } = await supabaseServer
    .from("rewards_users")
    .select("created_at");

  if (vipError) {
    console.error("[overview] rewards_users error", vipError);
  }

  const totalVips = (vipRows ?? []).length;
  const newVips = (vipRows ?? []).filter((row: any) => {
    return (row.created_at as string) >= todayStart;
  }).length;

  return {
    pointsAwarded,
    pointsRedeemed,
    netPoints: pointsAwarded - pointsRedeemed,
    newVips,
    totalVips,
  };
}

async function fetchTopRewards(): Promise<TopReward[]> {
  const since = daysAgoUTC(30);

  const { data, error } = await supabaseServer
    .from("rewards_redemptions")
    .select("reward_name, points_spent, created_at")
    .gte("created_at", since);

  if (error) {
    console.error("[overview] topRewards error", error);
    return [];
  }

  const agg = new Map<string, { redemptions: number; points_spent: number }>();

  (data ?? []).forEach((row: any) => {
    const name = (row.reward_name as string) || "Unknown reward";
    const pts = Number(row.points_spent ?? 0) || 0;
    const entry = agg.get(name) ?? { redemptions: 0, points_spent: 0 };
    entry.redemptions += 1;
    entry.points_spent += pts;
    agg.set(name, entry);
  });

  const result: TopReward[] = Array.from(agg.entries()).map(
    ([reward_name, value]) => ({
      reward_name,
      redemptions: value.redemptions,
      points_spent: value.points_spent,
    })
  );

  result.sort((a, b) => b.redemptions - a.redemptions);

  return result.slice(0, 5);
}

async function fetchTopStaff(): Promise<TopStaff[]> {
  const since = daysAgoUTC(30);

  const { data, error } = await supabaseServer
    .from("rewards_redemptions")
    .select("staff_label, points_spent, created_at")
    .gte("created_at", since);

  if (error) {
    console.error("[overview] topStaff error", error);
    return [];
  }

  const agg = new Map<string, { redemptions: number; points_spent: number }>();

  (data ?? []).forEach((row: any) => {
    const label = (row.staff_label as string) || "Unknown";
    const pts = Number(row.points_spent ?? 0) || 0;
    const entry = agg.get(label) ?? { redemptions: 0, points_spent: 0 };
    entry.redemptions += 1;
    entry.points_spent += pts;
    agg.set(label, entry);
  });

  const result: TopStaff[] = Array.from(agg.entries()).map(
    ([staff_label, value]) => ({
      staff_label,
      redemptions: value.redemptions,
      points_spent: value.points_spent,
    })
  );

  result.sort((a, b) => b.redemptions - a.redemptions);

  return result.slice(0, 5);
}

async function fetchRecentRedemptions(): Promise<RecentRedemption[]> {
  const { data, error } = await supabaseServer
    .from("rewards_redemptions")
    .select("id, reward_name, points_spent, staff_label, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[overview] recentRedemptions error", error);
    return [];
  }

  return (data ?? []) as RecentRedemption[];
}

export default async function RewardsOverviewPage() {
  await requireDashboardSession();

  const [today, topRewards, topStaff, recent] = await Promise.all([
    fetchTodayStats(),
    fetchTopRewards(),
    fetchTopStaff(),
    fetchRecentRedemptions(),
  ]);

  return (
    <DashboardShell
      activeTab="rewards"
      title="Sugarshack Downtown VIP Dashboard"
      subtitle="Rewards overview · Check-ins, points, and redemptions at a glance."
    >
      <div className="space-y-8">
        {/* Top stats row */}
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Points awarded today
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {today.pointsAwarded}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              From QR check-ins and adjustments.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Points redeemed today
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {today.pointsRedeemed}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Points spent on rewards tonight.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Net points today
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                today.netPoints >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {today.netPoints}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Awarded minus redeemed.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              VIPs
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {today.totalVips}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {today.newVips} new VIP
              {today.newVips === 1 ? "" : "s"} today.
            </p>
          </div>
        </section>

        {/* Middle grid: top rewards + staff + recent redemptions */}
        <section className="grid gap-4 lg:grid-cols-3">
          {/* Top rewards */}
          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Top rewards (last 30 days)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Which rewards are being used most often.
            </p>

            {topRewards.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No redemptions yet in this window.
              </p>
            ) : (
              <div className="mt-4 space-y-2 text-sm">
                {topRewards.map((r) => (
                  <div
                    key={r.reward_name}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {r.reward_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {r.redemptions} redeems · {r.points_spent} pts
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top staff */}
          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Top staff (last 30 days)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Who is redeeming the most rewards.
            </p>

            {topStaff.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No redemptions yet in this window.
              </p>
            ) : (
              <div className="mt-4 space-y-2 text-sm">
                {topStaff.map((s) => (
                  <div
                    key={s.staff_label}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {s.staff_label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.redemptions} redeems · {s.points_spent} pts
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent redemptions */}
          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent redemptions
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              The last 10 rewards redeemed by any staff member.
            </p>

            {recent.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No redemptions yet.
              </p>
            ) : (
              <div className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1 text-sm">
                {recent.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between rounded-2xl bg-slate-50 px-4 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {r.reward_name || "Reward"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {r.points_spent} pts ·{" "}
                        {r.staff_label || "Unknown staff"}
                      </p>
                    </div>
                    <p className="ml-2 shrink-0 text-[11px] text-slate-500">
                      {formatDateTime(r.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
