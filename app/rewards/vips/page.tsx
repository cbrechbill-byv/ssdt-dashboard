import { supabaseServer } from "@/lib/supabaseServer";
import DashboardShell from "@/components/layout/DashboardShell";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { revalidatePath } from "next/cache";
import Link from "next/link";

type OverviewRow = {
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

type RedemptionAggRow = {
  user_id: string;
  redemption_count: number;
  total_points_redeemed: number;
  last_redeem_at: string | null;
  last_reward_name: string | null;
};

type VipWithStats = {
  user_id: string;
  phone: string | null;
  full_name: string | null;
  email: string | null;
  zip: string | null;
  is_vip: boolean;
  total_points: number;
  total_visits: number;
  first_scan_at: string | null;
  last_scan_at: string | null;
  redemption_count: number;
  total_points_redeemed: number;
  last_redeem_at: string | null;
  last_reward_name: string | null;
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

async function fetchVipOverview(): Promise<VipWithStats[]> {
  const supabase = supabaseServer;

  // 1) Overview from rewards_user_overview (single source of truth for points)
  const { data: overviewRows, error: overviewErr } = await supabase
    .from("rewards_user_overview")
    .select(
      "user_id, phone, full_name, email, zip, is_vip, total_points, total_visits, first_scan_at, last_scan_at"
    )
    .order("last_scan_at", { ascending: false });

  if (overviewErr) {
    console.error(
      "[VIP overview] error loading rewards_user_overview",
      overviewErr
    );
    return [];
  }

  const overview = (overviewRows ?? []) as OverviewRow[];

  if (overview.length === 0) {
    return [];
  }

  const userIds = overview.map((row) => row.user_id).filter(Boolean);

  // 2) Redemption aggregates from rewards_redemptions
  const { data: redemptionRows, error: redemptionErr } = await supabase
    .from("rewards_redemptions")
    .select("user_id, points_spent, created_at, reward_name")
    .in("user_id", userIds);

  if (redemptionErr) {
    console.error(
      "[VIP overview] error loading rewards_redemptions aggregates",
      redemptionErr
    );
  }

  const redemptionAgg: Record<string, RedemptionAggRow> = {};

  (redemptionRows ?? []).forEach((row: any) => {
    const uid: string = row.user_id;
    if (!uid) return;

    const pointsSpent = Number(row.points_spent ?? 0);
    const createdAt: string | null = row.created_at ?? null;
    const rewardName: string | null = row.reward_name ?? null;

    if (!redemptionAgg[uid]) {
      redemptionAgg[uid] = {
        user_id: uid,
        redemption_count: 0,
        total_points_redeemed: 0,
        last_redeem_at: null,
        last_reward_name: null,
      };
    }

    redemptionAgg[uid].redemption_count += 1;
    redemptionAgg[uid].total_points_redeemed += pointsSpent;

    const currentLast = redemptionAgg[uid].last_redeem_at;
    if (!currentLast || (createdAt && createdAt > currentLast)) {
      redemptionAgg[uid].last_redeem_at = createdAt;
      redemptionAgg[uid].last_reward_name = rewardName;
    }
  });

  // 3) Combine
  const combined: VipWithStats[] = overview.map((row) => {
    const agg = redemptionAgg[row.user_id];

    return {
      user_id: row.user_id,
      phone: row.phone,
      full_name: row.full_name,
      email: row.email,
      zip: row.zip,
      is_vip: !!row.is_vip,
      total_points: Number(row.total_points ?? 0),
      total_visits: Number(row.total_visits ?? 0),
      first_scan_at: row.first_scan_at,
      last_scan_at: row.last_scan_at,
      redemption_count: agg?.redemption_count ?? 0,
      total_points_redeemed: agg?.total_points_redeemed ?? 0,
      last_redeem_at: agg?.last_redeem_at ?? null,
      last_reward_name: agg?.last_reward_name ?? null,
    };
  });

  return combined;
}

// SERVER ACTION: adjust VIP points using rewards_scans + audit log
export async function adjustVipPoints(formData: FormData) {
  "use server";

  const userId = String(formData.get("user_id") || "");
  const phone = (formData.get("phone") as string | null) ?? null;
  const currentPoints = Number(formData.get("current_points") ?? 0);
  const newPoints = Number(formData.get("new_points") ?? 0);

  if (!userId || Number.isNaN(currentPoints) || Number.isNaN(newPoints)) {
    return;
  }

  const diff = newPoints - currentPoints;
  if (diff === 0) {
    return;
  }

  const supabase = supabaseServer;
  const session = await getDashboardSession();

  const actor_email = session?.email ?? "unknown";
  const actor_role = session?.role ?? "unknown";

  const today = new Date().toISOString().slice(0, 10);

  // 1) Adjust today's rewards_scans row for this user
  const { data: existingScan, error: scanErr } = await supabase
    .from("rewards_scans")
    .select("id, points, metadata")
    .eq("user_id", userId)
    .eq("scan_date", today)
    .maybeSingle();

  if (scanErr) {
    console.error("[VIP adjust] error loading rewards_scans row", scanErr);
  }

  if (existingScan) {
    const newPointsToday = Number(existingScan.points ?? 0) + diff;

    const { error: updateErr } = await supabase
      .from("rewards_scans")
      .update({
        points: newPointsToday,
        metadata: {
          ...(existingScan.metadata || {}),
          last_dashboard_adjustment: {
            from: currentPoints,
            to: newPoints,
            diff,
            at: new Date().toISOString(),
          },
        },
      })
      .eq("id", existingScan.id);

    if (updateErr) {
      console.error("[VIP adjust] error updating rewards_scans row", updateErr);
    }
  } else {
    const { error: insertErr } = await supabase.from("rewards_scans").insert({
      user_id: userId,
      points: diff,
      source: "dashboard-adjust",
      qr_code: "DASHBOARD_ADJUST",
      scan_date: today,
      note: "Manual adjustment from VIP dashboard",
      metadata: {
        from: currentPoints,
        to: newPoints,
        diff,
        at: new Date().toISOString(),
      },
    });

    if (insertErr) {
      console.error("[VIP adjust] error inserting rewards_scans row", insertErr);
    }
  }

  // 2) Audit log
  const { error: logErr } = await supabase.from("dashboard_audit_log").insert({
    actor_email,
    actor_role,
    action: "update",
    entity: "rewards_user_points",
    entity_id: userId,
    details: {
      phone: phone,
      old_points: currentPoints,
      new_points: newPoints,
      diff,
      source: "rewards-vips-page",
    },
  });

  if (logErr) {
    console.error("[VIP adjust] error writing dashboard_audit_log", logErr);
  }

  revalidatePath("/rewards/vips");
}

export default async function VipUsersPage() {
  const vips = await fetchVipOverview();

  // Summary stats
  const totalVipGuests = vips.length;
  const totalPoints = vips.reduce(
    (sum, v) => sum + (Number.isFinite(v.total_points) ? v.total_points : 0),
    0
  );
  const totalRedemptions = vips.reduce(
    (sum, v) =>
      sum + (Number.isFinite(v.redemption_count) ? v.redemption_count : 0),
    0
  );
  const totalPointsRedeemed = vips.reduce(
    (sum, v) =>
      sum +
      (Number.isFinite(v.total_points_redeemed)
        ? v.total_points_redeemed
        : 0),
    0
  );

  return (
    <DashboardShell
      activeTab="rewards"
      title="VIP users"
      subtitle="See VIP guests, their points, check-ins, and reward redemptions."
    >
      <div className="space-y-6">
        {/* Header card with sub-nav (matches Rewards / Staff codes) */}
        <div className="rounded-3xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                VIP users
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                VIP guests who have joined the rewards program. Adjust points
                and review their check-ins and redemptions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Rewards menu = yellow (like Staff codes header) */}
              <Link
                href="/rewards"
                className="inline-flex items-center rounded-full bg-yellow-400 px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-yellow-300"
              >
                Rewards menu
              </Link>
              {/* VIP users = dark pill (active) */}
              <span className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm">
                VIP users
              </span>
              {/* Staff codes = light pill (inactive) */}
              <Link
                href="/rewards/staff-codes"
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50"
              >
                Staff codes
              </Link>
            </div>
          </div>
        </div>

        {/* Summary cards (light theme) */}
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="VIP guests"
            helper="Total guests with a rewards profile."
            value={totalVipGuests}
          />
          <SummaryCard
            label="Total points outstanding"
            helper="Sum of current points across all VIPs."
            value={totalPoints}
          />
          <SummaryCard
            label="Rewards redeemed"
            helper="Total number of redemptions recorded."
            value={totalRedemptions}
          />
          <SummaryCard
            label="Total points redeemed"
            helper="Total points spent on rewards."
            value={totalPointsRedeemed}
          />
        </div>

        {/* VIP table card */}
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              VIP guests & activity
            </h2>
            <p className="text-xs text-slate-500">
              Points are calculated from all scans and redemptions.
            </p>
          </div>

          {vips.length === 0 ? (
            <p className="text-sm text-slate-600">
              No VIP guests found yet. Once guests join the rewards program,
              they&apos;ll appear here with their points and activity.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-900">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Guest</th>
                    <th className="py-2 pr-4">Contact</th>
                    <th className="py-2 pr-4">Points</th>
                    <th className="py-2 pr-4">Visits</th>
                    <th className="py-2 pr-4">Last check-in</th>
                    <th className="py-2 pr-4">Last redeem</th>
                    <th className="py-2 pr-4">Redemptions</th>
                    <th className="py-2 pr-4">Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vips.map((vip) => (
                    <tr
                      key={vip.user_id}
                      className="align-top hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">
                            {vip.full_name || "Unknown guest"}
                          </span>
                          {vip.zip && (
                            <span className="text-xs text-slate-500">
                              ZIP {vip.zip}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col text-xs text-slate-700">
                          {vip.phone && (
                            <span className="font-mono text-slate-800">
                              {vip.phone}
                            </span>
                          )}
                          {vip.email && <span>{vip.email}</span>}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-sm font-semibold text-slate-900">
                          {vip.total_points}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-slate-800">
                        {vip.total_visits}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-700">
                        {formatDate(vip.last_scan_at)}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-700">
                        {vip.redemption_count === 0
                          ? "—"
                          : `${vip.last_reward_name || "Reward"} on ${formatDate(
                              vip.last_redeem_at
                            )}`}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-700">
                        {vip.redemption_count === 0 ? (
                          <span>0 redeems</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span>
                              {vip.redemption_count}{" "}
                              {vip.redemption_count === 1
                                ? "redeem"
                                : "redeems"}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {vip.total_points_redeemed} pts spent
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        <form action={adjustVipPoints} className="flex flex-col gap-1">
                          <input type="hidden" name="user_id" value={vip.user_id} />
                          <input type="hidden" name="phone" value={vip.phone ?? ""} />
                          <input
                            type="hidden"
                            name="current_points"
                            value={vip.total_points}
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-500">
                              Set to
                            </span>
                            <input
                              name="new_points"
                              type="number"
                              defaultValue={vip.total_points}
                              className="w-20 rounded-full border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-yellow-400 focus:outline-none"
                            />
                          </div>
                          <button
                            type="submit"
                            className="mt-1 inline-flex items-center justify-center rounded-full bg-yellow-400 px-3 py-1 text-[11px] font-semibold text-slate-900 hover:bg-yellow-300"
                          >
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

type SummaryCardProps = {
  label: string;
  helper: string;
  value: number;
};

function SummaryCard({ label, helper, value }: SummaryCardProps) {
  return (
    <div className="rounded-3xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">
        {value.toLocaleString("en-US")}
      </div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}
