// app/rewards/vips/page.tsx
// Path: /rewards/vips
// VIP guests & activity – show balances, visits, redemptions, and allow manual point adjustments.
// Sprint: Remove redundant "VIP profiles (edit contact info)" section; improve navigation + data density.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
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
    );

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
  if (delta === 0) return;

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

function safeStr(v: string | null | undefined) {
  return (v ?? "").toString();
}

function includesCI(haystack: string, needle: string) {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// 10-digit phone display, no +1
function formatPhone10(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits.length ? digits : "—";
}

type SortKey = "points" | "visits" | "last_checkin" | "last_redeem" | "name";

// --- Page --------------------------------------------------------------------

export default async function VipUsersPage(props: {
  searchParams?: Promise<{ q?: string; sort?: SortKey }>;
}) {
  await requireDashboardSession();

  const sp = (await props.searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const sort: SortKey = sp.sort ?? "points";

  const [rowsRaw, redemptionMap] = await Promise.all([
    fetchVipOverview(),
    fetchRedemptionAggregates(),
  ]);

  // Filter (name/phone/email/zip/user_id)
  const rows = rowsRaw.filter((r) => {
    if (!q) return true;
    const blob = [
      safeStr(r.full_name),
      safeStr(r.phone),
      safeStr(r.email),
      safeStr(r.zip),
      safeStr(r.user_id),
    ].join(" ");
    return includesCI(blob, q);
  });

  // Sort
  const sorted = [...rows].sort((a, b) => {
    const aId = a.user_id ?? "";
    const bId = b.user_id ?? "";

    const aPoints = Number(a.total_points ?? 0) || 0;
    const bPoints = Number(b.total_points ?? 0) || 0;

    const aVisits = Number(a.total_visits ?? 0) || 0;
    const bVisits = Number(b.total_visits ?? 0) || 0;

    const aLast = a.last_scan_at ? new Date(a.last_scan_at).getTime() : 0;
    const bLast = b.last_scan_at ? new Date(b.last_scan_at).getTime() : 0;

    const aRedeemIso = aId ? redemptionMap.get(aId)?.last_redeem_at : null;
    const bRedeemIso = bId ? redemptionMap.get(bId)?.last_redeem_at : null;

    const aRedeem = aRedeemIso ? new Date(aRedeemIso).getTime() : 0;
    const bRedeem = bRedeemIso ? new Date(bRedeemIso).getTime() : 0;

    const aName = (a.full_name ?? "").toLowerCase();
    const bName = (b.full_name ?? "").toLowerCase();

    switch (sort) {
      case "visits":
        return bVisits - aVisits;
      case "last_checkin":
        return bLast - aLast;
      case "last_redeem":
        return bRedeem - aRedeem;
      case "name":
        return aName.localeCompare(bName);
      case "points":
      default:
        return bPoints - aPoints;
    }
  });

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
              Filtered by current search.
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
              Total points currently on the books (filtered).
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
              Lifetime visits across filtered VIPs.
            </p>
          </div>
        </section>

        {/* VIP guests & activity table */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                VIP guests &amp; activity
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Click a guest to open insights. Use <span className="font-semibold text-slate-700">Point adjustment</span>{" "}
                to correct totals.
              </p>
            </div>

            {/* Search + sort */}
            <form method="get" className="flex flex-wrap items-center gap-2">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search name, phone, email, zip…"
                className="w-64 max-w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
              />
              <select
                name="sort"
                defaultValue={sort}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
              >
                <option value="points">Sort: Points</option>
                <option value="visits">Sort: Visits</option>
                <option value="last_checkin">Sort: Last check-in</option>
                <option value="last_redeem">Sort: Last redeem</option>
                <option value="name">Sort: Name</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center rounded-full bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-amber-500"
              >
                Apply
              </button>
              {(q || sort !== "points") && (
                <Link
                  href="/rewards/vips"
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Clear
                </Link>
              )}
            </form>
          </div>

          {sorted.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No VIPs match this search.
            </p>
          ) : (
            <>
              {/* Header row */}
              <div className="mt-6 grid gap-3 border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,2.1fr)]">
                <span>Guest</span>
                <span>Contact</span>
                <span>Points</span>
                <span>Visits</span>
                <span>Last check-in</span>
                <span>Last redeem</span>
                <span>Redeems</span>
                <span className="text-right">Point adjustment</span>
              </div>

              {/* Rows */}
              <div className="mt-1 space-y-3">
                {sorted.map((row) => {
                  const userId = row.user_id ?? "";
                  const points = Number(row.total_points ?? 0);
                  const visits = Number(row.total_visits ?? 0);

                  const redStats = userId ? redemptionMap.get(userId) : undefined;
                  const lastRedeem = redStats?.last_redeem_at ?? null;
                  const totalRedemptions = redStats?.total_redemptions ?? 0;
                  const lastRewardName = redStats?.last_reward_name ?? null;

                  const displayName =
                    row.full_name && row.full_name.trim().length > 0
                      ? row.full_name
                      : "Unknown guest";

                  const displayPhone10 = formatPhone10(row.phone);

                  return (
                    <form
                      key={userId || displayPhone10}
                      action={adjustVipPoints}
                      className="grid gap-3 border-b border-slate-100 py-3 text-sm last:border-b-0 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,2.1fr)] md:items-center"
                    >
                      <input type="hidden" name="user_id" value={userId} />
                      <input
                        type="hidden"
                        name="current_points"
                        value={points}
                      />

                      {/* Guest */}
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">
                          {userId ? (
                            <Link
                              href={`/rewards/vips/${userId}/insights`}
                              className="hover:underline hover:text-slate-700"
                            >
                              {displayName}
                            </Link>
                          ) : (
                            displayName
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {row.is_vip ? "VIP" : "Not VIP"}
                        </div>
                      </div>

                      {/* Contact (phone only, 10-digit) */}
                      <div className="min-w-0 truncate font-mono text-slate-700">
                        {displayPhone10}
                      </div>

                      {/* Points */}
                      <div className="font-semibold text-slate-900">{points}</div>

                      {/* Visits */}
                      <div className="text-slate-800">{visits}</div>

                      {/* Last check-in */}
                      <div className="text-xs text-slate-600">
                        {formatDate(row.last_scan_at)}
                      </div>

                      {/* Last redeem */}
                      <div
                        className="text-xs text-slate-600"
                        title={
                          lastRewardName
                            ? `Last reward: ${lastRewardName}`
                            : "No redemptions yet"
                        }
                      >
                        {formatDate(lastRedeem)}
                      </div>

                      {/* Redeems */}
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

                      {/* Point adjustment (no redundant buttons) */}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Set total to
                        </span>
                        <input
                          type="number"
                          name="target_points"
                          defaultValue={points}
                          className="w-28 rounded-full border-2 border-amber-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-full bg-amber-400 px-4 py-1.5 text-[11px] font-semibold text-slate-900 shadow-sm hover:bg-amber-500"
                        >
                          Save points
                        </button>
                      </div>
                    </form>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* NOTE: The old "VIP profiles (edit contact info)" section was removed on purpose. */}
      </div>
    </DashboardShell>
  );
}
