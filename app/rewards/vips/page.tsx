// app/rewards/vips/page.tsx
// Path: /rewards/vips
// VIP guests & activity – show balances, visits, and allow manual point adjustments.
// Also provides a VIP profiles section for editing contact info.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";

type VipOverviewRow = {
  user_id: string | null;
  phone: string | null;
  full_name: string | null;
  email: string | null;
  zip: string | null;
  is_vip: boolean | null;
  total_points: number | null; // bigint in DB
  total_visits: number | null; // bigint in DB
  first_scan_at: string | null;
  last_scan_at: string | null;
};

type RedemptionAggregate = {
  user_id: string;
  total_redemptions: number;
  last_redeem_at: string | null;
  last_reward_name: string | null;
};

async function requireDashboardSession() {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  return session;
}

async function fetchVipOverview(): Promise<VipOverviewRow[]> {
  const { data, error } = await supabaseServer
    .from("rewards_user_overview")
    .select(
      "user_id, phone, full_name, email, zip, is_vip, total_points, total_visits, first_scan_at, last_scan_at"
    )
    .order("total_points", { ascending: false });

  if (error) {
    console.error("[vips] fetchVipOverview error", error);
    return [];
  }

  return (data ?? []) as VipOverviewRow[];
}

async function fetchRedemptionAggregates(): Promise<
  Map<string, RedemptionAggregate>
> {
  // Aggregate in JS so we don't rely on .group()
  const { data, error } = await supabaseServer
    .from("rewards_redemptions")
    .select("user_id, created_at, reward_name");

  if (error) {
    console.error("[vips] fetchRedemptionAggregates error", error);
    return new Map();
  }

  const map = new Map<string, RedemptionAggregate>();

  (data ?? []).forEach((row: any) => {
    const user_id = row.user_id as string | null;
    const created_at = row.created_at as string | null;
    const reward_name = row.reward_name as string | null;
    if (!user_id) return;

    const existing = map.get(user_id);
    if (!existing) {
      map.set(user_id, {
        user_id,
        total_redemptions: 1,
        last_redeem_at: created_at,
        last_reward_name: reward_name,
      });
    } else {
      existing.total_redemptions += 1;
      if (
        created_at &&
        (!existing.last_redeem_at ||
          created_at > (existing.last_redeem_at as string))
      ) {
        existing.last_redeem_at = created_at;
        existing.last_reward_name = reward_name;
      }
    }
  });

  return map;
}

async function logVipAction(options: {
  action: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  const session = await getDashboardSession();
  const supabase = supabaseServer;

  const actor_email = session?.email ?? "unknown";
  const actor_role = session?.role ?? "unknown";

  const { error } = await supabase.from("dashboard_audit_log").insert({
    actor_email,
    actor_role,
    action: options.action,
    entity: "rewards_users",
    entity_id: options.entityId ?? null,
    details: options.details ?? null,
  });

  if (error) {
    console.error("[vips] log action error", error);
  }
}

// --- Server action: manual points adjust ------------------------------------

export async function adjustVipPoints(formData: FormData) {
  "use server";

  await requireDashboardSession();

  const userId = (formData.get("user_id") as string)?.trim();
  if (!userId) {
    console.error("[vips] adjustVipPoints missing user_id");
    return;
  }

  const currentRaw = (formData.get("current_points") as string) ?? "0";
  const targetRaw = (formData.get("target_points") as string) ?? currentRaw;

  const currentPoints = Number(currentRaw) || 0;
  const targetPoints = Number(targetRaw);

  if (!Number.isFinite(targetPoints)) {
    console.error("[vips] adjustVipPoints invalid target", targetRaw);
    return;
  }

  const delta = targetPoints - currentPoints;
  if (delta === 0) {
    return;
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { error } = await supabaseServer.from("rewards_scans").insert({
    user_id: userId,
    qr_code: "DASHBOARD-ADJUST",
    points: delta,
    source: "dashboard_adjust",
    note: "Manual points set via dashboard",
    metadata: {
      previous_points: currentPoints,
      target_points: targetPoints,
      delta,
    },
    scan_date: today,
  });

  if (error) {
    console.error("[vips] adjustVipPoints insert error", error);
  } else {
    await logVipAction({
      action: "vip:adjust_points",
      entityId: userId,
      details: { previous_points: currentPoints, target_points: targetPoints },
    });
  }

  revalidatePath("/rewards/vips");
}

// --- Server action: update VIP profile --------------------------------------

export async function updateVipProfile(formData: FormData) {
  "use server";

  await requireDashboardSession();

  const userId = (formData.get("user_id") as string)?.trim();
  if (!userId) {
    console.error("[vips] updateVipProfile missing user_id");
    return;
  }

  const full_name = (formData.get("full_name") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const zip = (formData.get("zip") as string)?.trim() || null;
  const isVipRaw = formData.get("is_vip") as string | null;
  const is_vip = isVipRaw === "on";

  const { error } = await supabaseServer
    .from("rewards_users")
    .update({
      full_name,
      email,
      zip,
      is_vip,
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[vips] updateVipProfile error", error);
  } else {
    await logVipAction({
      action: "vip:update_profile",
      entityId: userId,
      details: { full_name, email, zip, is_vip },
    });
  }

  revalidatePath("/rewards/vips");
}

// --- Helpers -----------------------------------------------------------------

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// --- Page --------------------------------------------------------------------

export default async function VipUsersPage() {
  await requireDashboardSession();

  const [rows, redemptionMap] = await Promise.all([
    fetchVipOverview(),
    fetchRedemptionAggregates(),
  ]);

  const totalVips = rows.length;
  const totalPoints = rows.reduce(
    (sum, r) => sum + (Number(r.total_points ?? 0) || 0),
    0
  );
  const totalVisits = rows.reduce(
    (sum, r) => sum + (Number(r.total_visits ?? 0) || 0),
    0
  );

  return (
    <DashboardShell
      activeTab="rewards"
      title="Sugarshack Downtown VIP Dashboard"
      subtitle="VIP guests & activity · Points are calculated from all scans and redemptions."
    >
      <div className="space-y-8">
        {/* Summary cards */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              VIP base
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {totalVips}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Total unique VIPs with a verified phone number.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Points bank
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {totalPoints}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Total points currently on the books.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Visits logged
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {totalVisits}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Lifetime visits across all VIPs.
            </p>
          </div>
        </section>

        {/* VIP guests & activity table */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                VIP guests &amp; activity
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Points are calculated from check-ins and redemptions. Adjust
                totals if you need to fix an account.
              </p>
            </div>
            {rows.length > 0 && (
              <p className="text-xs text-slate-500">
                {rows.length} VIP{rows.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No VIPs yet. Once guests join from the app you&apos;ll see them
              here.
            </p>
          ) : (
            <>
              {/* Header row */}
              <div className="mt-5 grid gap-3 border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.6fr)]">
                <span>Guest</span>
                <span>Contact</span>
                <span>Points</span>
                <span>Visits</span>
                <span>Last check-in</span>
                <span>Last redeem</span>
                <span>Redemptions</span>
                <span className="text-right">Adjust</span>
              </div>

              {/* Rows */}
              <div className="mt-1 space-y-3">
                {rows.map((row) => {
                  const userId = row.user_id ?? "";
                  const points = Number(row.total_points ?? 0);
                  const visits = Number(row.total_visits ?? 0);
                  const redStats = userId
                    ? redemptionMap.get(userId)
                    : undefined;
                  const lastRedeem = redStats?.last_redeem_at ?? null;
                  const totalRedemptions = redStats?.total_redemptions ?? 0;
                  const lastRewardName = redStats?.last_reward_name ?? null;

                  const displayName =
                    row.full_name && row.full_name.trim().length > 0
                      ? row.full_name
                      : "Unknown guest";

                  const displayPhone = row.phone ?? "";

                  return (
                    <form
                      key={userId || displayPhone}
                      action={adjustVipPoints}
                      className="grid gap-3 border-b border-slate-100 py-3 text-sm last:border-b-0 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.6fr)] md:items-center"
                    >
                      <input type="hidden" name="user_id" value={userId} />
                      <input
                        type="hidden"
                        name="current_points"
                        value={points}
                      />

                      {/* Guest */}
                      <div className="font-semibold text-slate-900">
                        {displayName}
                      </div>

                      {/* Contact */}
                      <div className="text-slate-700">{displayPhone}</div>

                      {/* Points */}
                      <div className="font-semibold text-slate-900">
                        {points}
                      </div>

                      {/* Visits */}
                      <div className="text-slate-800">{visits}</div>

                      {/* Last check-in */}
                      <div className="text-xs text-slate-600">
                        {formatDate(row.last_scan_at)}
                      </div>

                      {/* Last redeem */}
                      <div className="text-xs text-slate-600">
                        {formatDate(lastRedeem)}
                      </div>

                      {/* Redemptions – just the number; hover shows last reward */}
                      <div
                        className="text-xs text-slate-700"
                        title={
                          lastRewardName
                            ? `Last reward: ${lastRewardName}`
                            : "No redemptions yet"
                        }
                      >
                        {Number(totalRedemptions)}
                      </div>

                      {/* Adjust – Set to [points] Save */}
                      <div className="flex items-center justify-end gap-2 text-xs text-slate-600">
                        <span className="whitespace-nowrap">Set to</span>
                        <input
                          type="number"
                          name="target_points"
                          defaultValue={points}
                          className="w-20 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-full bg-amber-400 px-5 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-amber-500"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* VIP profiles – edit contact info */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                VIP profiles (edit contact info)
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Update names, email addresses, ZIP codes, or VIP status. Phone
                numbers come from the app and are read-only here.
              </p>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No VIPs yet. Once guests join from the app you&apos;ll see them
              here.
            </p>
          ) : (
            <>
              {/* Header row */}
              <div className="mt-5 grid gap-3 border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.5fr)_minmax(0,2.1fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1.2fr)]">
                <span>Name</span>
                <span>Phone</span>
                <span>Email</span>
                <span>ZIP</span>
                <span className="text-center">VIP</span>
                <span className="text-right">Actions</span>
              </div>

              <div className="mt-1 space-y-3">
                {rows.map((row) => {
                  const userId = row.user_id ?? "";
                  const displayPhone = row.phone ?? "";
                  const displayName =
                    row.full_name && row.full_name.trim().length > 0
                      ? row.full_name
                      : "Unknown guest";

                  return (
                    <form
                      key={`profile-${userId || displayPhone}`}
                      action={updateVipProfile}
                      className="grid gap-3 rounded-3xl bg-slate-50 px-4 py-3 text-sm shadow-sm md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.5fr)_minmax(0,2.1fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1.2fr)] md:items-center"
                    >
                      <input type="hidden" name="user_id" value={userId} />

                      {/* Name */}
                      <div>
                        <input
                          type="text"
                          name="full_name"
                          defaultValue={displayName}
                          placeholder="VIP Music Lover"
                          className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                        />
                      </div>

                      {/* Phone (read-only) */}
                      <div>
                        <input
                          type="text"
                          defaultValue={displayPhone}
                          readOnly
                          className="w-full cursor-not-allowed rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <input
                          type="email"
                          name="email"
                          defaultValue={row.email ?? ""}
                          placeholder="vip@example.com"
                          className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                        />
                      </div>

                      {/* ZIP */}
                      <div>
                        <input
                          type="text"
                          name="zip"
                          defaultValue={row.zip ?? ""}
                          className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                        />
                      </div>

                      {/* VIP toggle */}
                      <div className="flex items-center justify-center">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                          <input
                            type="checkbox"
                            name="is_vip"
                            defaultChecked={!!row.is_vip}
                            className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                          />
                        </label>
                      </div>

                      {/* Save */}
                      <div className="flex items-center justify-end">
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-600"
                        >
                          Save
                        </button>
                      </div>
                    </form>
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
