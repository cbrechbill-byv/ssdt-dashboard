// app/rewards/vips/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";

type VipRow = {
  user_id: string;
  phone: string | null;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  ledger_points: number;
  is_vip: boolean;
  last_scan_at: string | null;
  created_at: string;
  // New activity fields
  last_checkin_at: string | null;
  last_redeem_at: string | null;
  last_reward_name: string | null;
  redemption_count: number;
  total_points_redeemed: number;
};

type VipStats = {
  totalVips: number;
  totalAvailablePoints: number;
  totalRedemptions: number;
  totalPointsRedeemed: number;
  totalCheckinsLast7Days: number;
};

async function requireDashboardSession() {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  return session;
}

async function fetchVipData(): Promise<{ rows: VipRow[]; stats: VipStats }> {
  const supabase = supabaseServer;

  // 1) Balances per VIP (view)
  const { data: balances, error: balancesError } = await supabase
    .from("rewards_balances")
    .select("user_id, phone, ledger_points, is_vip, last_scan_at, created_at")
    .order("created_at", { ascending: false });

  if (balancesError) {
    console.error("[vip-points] fetch balances error", balancesError);
    return {
      rows: [],
      stats: {
        totalVips: 0,
        totalAvailablePoints: 0,
        totalRedemptions: 0,
        totalPointsRedeemed: 0,
        totalCheckinsLast7Days: 0,
      },
    };
  }

  const baseBalances = balances ?? [];
  const userIds = baseBalances.map((b) => b.user_id);

  // 2) User details (name/email)
  let userMap = new Map<
    string,
    { full_name: string | null; display_name: string | null; email: string | null }
  >();

  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("rewards_users")
      .select("user_id, full_name, display_name, email")
      .in("user_id", userIds);

    if (usersError) {
      console.error("[vip-points] fetch users error", usersError);
    } else {
      (users ?? []).forEach((u: any) => {
        userMap.set(u.user_id, {
          full_name: u.full_name ?? null,
          display_name: u.display_name ?? null,
          email: u.email ?? null,
        });
      });
    }
  }

  // 3) Per-user last check-in from rewards_scans (source = 'qr-checkin')
  let checkinMap = new Map<string, string>(); // user_id -> last_checkin_at ISO

  if (userIds.length > 0) {
    const { data: checkinsAll, error: checkinsAllError } = await supabase
      .from("rewards_scans")
      .select("user_id, scanned_at, scan_date, source")
      .in("user_id", userIds)
      .eq("source", "qr-checkin");

    if (checkinsAllError) {
      console.error("[vip-points] fetch per-user checkins error", checkinsAllError);
    } else {
      (checkinsAll ?? []).forEach((row: any) => {
        const key = row.user_id as string;
        const existing = checkinMap.get(key);
        // Prefer scanned_at if present, fall back to scan_date
        const thisDate =
          (row.scanned_at as string | null) ??
          (row.scan_date ? `${row.scan_date}T00:00:00Z` : null);
        if (!thisDate) return;
        if (!existing || new Date(thisDate) > new Date(existing)) {
          checkinMap.set(key, thisDate);
        }
      });
    }
  }

  // 4) Per-user redemptions from rewards_redemptions
  type RedeemAgg = {
    last_redeem_at: string | null;
    last_reward_name: string | null;
    redemption_count: number;
    total_points_redeemed: number;
  };

  let redeemMap = new Map<string, RedeemAgg>();

  let allRedemptions: any[] = [];

  if (userIds.length > 0) {
    const { data: redemptions, error: redemptionsError } = await supabase
      .from("rewards_redemptions")
      .select("user_id, points_spent, reward_name, created_at")
      .in("user_id", userIds);

    if (redemptionsError) {
      console.error("[vip-points] fetch per-user redemptions error", redemptionsError);
    } else {
      allRedemptions = redemptions ?? [];
      allRedemptions.forEach((r: any) => {
        const uid = r.user_id as string;
        const created_at = r.created_at as string;
        const points_spent = (r.points_spent as number) ?? 0;
        const reward_name = (r.reward_name as string) ?? null;

        const existing = redeemMap.get(uid) ?? {
          last_redeem_at: null,
          last_reward_name: null,
          redemption_count: 0,
          total_points_redeemed: 0,
        };

        const newerLast =
          !existing.last_redeem_at ||
          new Date(created_at) > new Date(existing.last_redeem_at);

        redeemMap.set(uid, {
          last_redeem_at: newerLast ? created_at : existing.last_redeem_at,
          last_reward_name: newerLast ? reward_name : existing.last_reward_name,
          redemption_count: existing.redemption_count + 1,
          total_points_redeemed: existing.total_points_redeemed + points_spent,
        });
      });
    }
  }

  // 5) High-level stats for top summary tiles
  const rows: VipRow[] = baseBalances.map((b: any) => {
    const u = userMap.get(b.user_id);
    const checkinAgg = checkinMap.get(b.user_id) ?? null;
    const redeemAgg =
      redeemMap.get(b.user_id) ?? {
        last_redeem_at: null,
        last_reward_name: null,
        redemption_count: 0,
        total_points_redeemed: 0,
      };

    return {
      user_id: b.user_id,
      phone: b.phone ?? null,
      display_name: u?.display_name ?? null,
      full_name: u?.full_name ?? null,
      email: u?.email ?? null,
      ledger_points: b.ledger_points ?? 0,
      is_vip: b.is_vip ?? false,
      last_scan_at: b.last_scan_at ?? null,
      created_at: b.created_at,
      last_checkin_at: checkinAgg,
      last_redeem_at: redeemAgg.last_redeem_at,
      last_reward_name: redeemAgg.last_reward_name,
      redemption_count: redeemAgg.redemption_count,
      total_points_redeemed: redeemAgg.total_points_redeemed,
    };
  });

  const totalVips = rows.length;
  const totalAvailablePoints = rows.reduce(
    (acc, row) => acc + (row.ledger_points || 0),
    0
  );

  const totalRedemptions = allRedemptions.length;
  const totalPointsRedeemed = allRedemptions.reduce(
    (acc, r: any) => acc + ((r.points_spent as number) ?? 0),
    0
  );

  // Check-ins last 7 days (overall)
  const today = new Date();
  const since = new Date(today);
  since.setDate(today.getDate() - 6); // today + last 6 days
  const sinceStr = since.toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: checkins7, error: checkins7Error } = await supabase
    .from("rewards_scans")
    .select("id")
    .eq("source", "qr-checkin")
    .gte("scan_date", sinceStr);

  if (checkins7Error) {
    console.error("[vip-points] fetch checkins last 7 days error", checkins7Error);
  }

  const totalCheckinsLast7Days = (checkins7 ?? []).length;

  const stats: VipStats = {
    totalVips,
    totalAvailablePoints,
    totalRedemptions,
    totalPointsRedeemed,
    totalCheckinsLast7Days,
  };

  return { rows, stats };
}

// Log adjustments to dashboard_audit_log
async function logVipPointsAdjustment(options: {
  user_id: string;
  phone?: string | null;
  old_points: number;
  new_points: number;
}) {
  const session = await getDashboardSession();
  const supabase = supabaseServer;

  const actor_email = session?.user?.email ?? "unknown";
  const actor_role = session?.user?.role ?? "unknown";

  const { error } = await supabase.from("dashboard_audit_log").insert({
    actor_email,
    actor_role,
    action: "update",
    entity: "rewards_user_points",
    entity_id: options.user_id,
    details: {
      phone: options.phone ?? null,
      old_points: options.old_points,
      new_points: options.new_points,
      source: "dashboard-vip-points",
    },
  });

  if (error) {
    console.error("[vip-points] log adjustment error", error);
  }
}

export default async function VipPointsPage() {
  await requireDashboardSession();
  const { rows, stats } = await fetchVipData();

  return (
    <DashboardShell
      activeTab="rewards"
      title="Sugarshack Downtown VIP Dashboard"
      subtitle="Rewards · VIP points and redemption activity."
    >
      <div className="space-y-8">
        {/* Sub-nav + summary */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-slate-900">
                VIP users &amp; balances
              </h1>
              <p className="text-sm text-slate-500">
                See all VIP guests, their current points, last check-in,
                and what they&apos;ve redeemed. Use this to audit points
                and understand how guests are using the program.
              </p>

              {/* Summary chips */}
              <div className="mt-2 grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="font-semibold text-slate-900">
                    {stats.totalVips.toLocaleString()}
                  </div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
                    VIP guests
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="font-semibold text-slate-900">
                    {stats.totalAvailablePoints.toLocaleString()}
                  </div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
                    Points currently available
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="font-semibold text-slate-900">
                    {stats.totalRedemptions.toLocaleString()}
                  </div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
                    Rewards redeemed (all time)
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {stats.totalPointsRedeemed.toLocaleString()} pts spent
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="font-semibold text-slate-900">
                    {stats.totalCheckinsLast7Days.toLocaleString()}
                  </div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
                    Check-ins (last 7 days)
                  </div>
                </div>
              </div>
            </div>

            {/* Rewards sub-navigation */}
            <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
              <Link
                href="/rewards"
                className="inline-flex items-center rounded-full bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-amber-500"
              >
                Rewards menu
              </Link>
              <span className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm">
                VIP users
              </span>
              <Link
                href="/rewards/staff-codes"
                className="inline-flex items-center rounded-full bg-white px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm border border-slate-200 hover:bg-slate-50"
              >
                Staff codes
              </Link>
            </div>
          </div>
        </section>

        {/* VIP table */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              VIP users &amp; balances
            </h2>
            <span className="text-xs text-slate-400">
              {rows.length} {rows.length === 1 ? "VIP" : "VIPs"}
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">
              No VIP users yet. Once guests start joining, their balances and
              activity will appear here.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-4 text-left">Guest</th>
                      <th className="py-2 pr-4 text-left">Contact</th>
                      <th className="py-2 pr-4 text-left">Current points</th>
                      <th className="py-2 pr-4 text-left">Activity</th>
                      <th className="py-2 pr-4 text-left">Set to</th>
                      <th className="py-2 pl-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const formId = `vip-${row.user_id}`;
                      const displayName =
                        row.display_name ||
                        row.full_name ||
                        "(No name on file)";

                      const lastCheckin =
                        row.last_checkin_at ||
                        row.last_scan_at ||
                        null;

                      return (
                        <tr key={row.user_id}>
                          {/* Guest */}
                          <td className="py-2 pr-4 align-top">
                            <div className="text-sm font-medium text-slate-900">
                              {displayName}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {row.is_vip && (
                                <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  VIP
                                </span>
                              )}
                              {lastCheckin && (
                                <span className="inline-flex rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                  Last check-in{" "}
                                  {new Date(
                                    lastCheckin
                                  ).toLocaleDateString()}
                                </span>
                              )}
                              {row.last_redeem_at && row.last_reward_name && (
                                <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                                  Last redeem: {row.last_reward_name} ·{" "}
                                  {new Date(
                                    row.last_redeem_at
                                  ).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Contact */}
                          <td className="py-2 pr-4 align-top text-xs text-slate-600">
                            <div>{row.phone ?? "No phone"}</div>
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {row.email ?? "No email"}
                            </div>
                          </td>

                          {/* Current points + redemption summary */}
                          <td className="py-2 pr-4 align-top">
                            <div className="text-sm font-semibold text-slate-900">
                              {row.ledger_points.toLocaleString()} pts
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              {row.redemption_count > 0 ? (
                                <>
                                  {row.redemption_count}{" "}
                                  {row.redemption_count === 1
                                    ? "redeem"
                                    : "redeems"}
                                  ,{" "}
                                  {row.total_points_redeemed.toLocaleString()}{" "}
                                  pts spent
                                </>
                              ) : (
                                <>No redemptions yet</>
                              )}
                            </div>
                          </td>

                          {/* Activity summary */}
                          <td className="py-2 pr-4 align-top text-xs text-slate-600">
                            <div>
                              Joined{" "}
                              {new Date(
                                row.created_at
                              ).toLocaleDateString()}
                            </div>
                            {lastCheckin && (
                              <div className="mt-0.5">
                                Check-in:{" "}
                                {new Date(
                                  lastCheckin
                                ).toLocaleDateString()}
                              </div>
                            )}
                            {row.last_redeem_at && row.last_reward_name && (
                              <div className="mt-0.5">
                                Redeem: {row.last_reward_name}
                              </div>
                            )}
                          </td>

                          {/* Set to input */}
                          <td className="py-2 pr-4 align-top">
                            <input
                              type="hidden"
                              name="user_id"
                              value={row.user_id}
                              form={formId}
                            />
                            <input
                              type="hidden"
                              name="phone"
                              value={row.phone ?? ""}
                              form={formId}
                            />
                            <input
                              name="target_points"
                              type="number"
                              min={0}
                              defaultValue={row.ledger_points}
                              form={formId}
                              className="w-28 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none ring-0 transition hover:bg-white focus:border-amber-400"
                            />
                          </td>

                          {/* Actions */}
                          <td className="py-2 pl-4 align-top text-right">
                            <button
                              type="submit"
                              form={formId}
                              className="inline-flex rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-amber-500"
                            >
                              Update
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Hidden forms (one per VIP row) for server action */}
              {rows.map((row) => (
                <form
                  key={`adjust-form-${row.user_id}`}
                  id={`vip-${row.user_id}`}
                  action={adjustVipPoints}
                />
              ))}
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

/* SERVER ACTION: adjust VIP points via rewards_scans */
export async function adjustVipPoints(formData: FormData) {
  "use server";

  await requireDashboardSession();
  const supabase = supabaseServer;

  const user_id = String(formData.get("user_id") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const targetPointsRaw = String(formData.get("target_points") ?? "").trim();
  const target_points = Number(targetPointsRaw);

  if (!user_id || Number.isNaN(target_points)) {
    return;
  }

  // 1) Get current ledger_points from view
  const { data: balanceRow, error: balanceError } = await supabase
    .from("rewards_balances")
    .select("ledger_points")
    .eq("user_id", user_id)
    .maybeSingle();

  if (balanceError || !balanceRow) {
    console.error("[vip-points] adjust: could not fetch current balance", {
      error: balanceError,
      user_id,
    });
    return;
  }

  const current_points: number = balanceRow.ledger_points ?? 0;

  if (current_points === target_points) {
    // Nothing to do
    return;
  }

  const delta = target_points - current_points;

  // 2) Modify today's rewards_scans row (or create it) to apply delta
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: existingScan, error: scanFetchError } = await supabase
    .from("rewards_scans")
    .select("id, points")
    .eq("user_id", user_id)
    .eq("scan_date", today)
    .maybeSingle();

  if (scanFetchError) {
    console.error("[vip-points] adjust: fetch scan error", scanFetchError);
    return;
  }

  if (existingScan) {
    // Update existing scan for today
    const { error: updateScanError } = await supabase
      .from("rewards_scans")
      .update({
        points: (existingScan.points ?? 0) + delta,
      })
      .eq("id", existingScan.id);

    if (updateScanError) {
      console.error("[vip-points] adjust: update scan error", updateScanError);
      return;
    }
  } else {
    // Insert a new scan for today
    const { error: insertScanError } = await supabase
      .from("rewards_scans")
      .insert({
        user_id,
        points: delta,
        source: "dashboard-adjustment",
        note: `Set balance from ${current_points} to ${target_points}`,
        qr_code: `DASHBOARD_ADJUST_${user_id}_${today}`,
        scan_date: today,
      });

    if (insertScanError) {
      console.error("[vip-points] adjust: insert scan error", insertScanError);
      return;
    }
  }

  // 3) Log to dashboard audit
  await logVipPointsAdjustment({
    user_id,
    phone,
    old_points: current_points,
    new_points: target_points,
  });

  // 4) Revalidate page
  revalidatePath("/rewards/vips");
}
