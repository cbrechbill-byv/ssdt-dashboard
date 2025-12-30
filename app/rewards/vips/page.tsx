// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\rewards\vips\page.tsx
// app/rewards/vips/page.tsx
// Path: /rewards/vips
// VIP guests & activity – show balances, visits, redemptions, and allow manual point adjustments.
//
// Updates:
// ✅ Only pull VIPs from rewards_user_overview (less data)
// ✅ KPI cards are rewards-ops oriented + show filtered vs total
// ✅ Fix: manual adjustment scan_date uses ET day string (align to Tonight / ET rules)
// ✅ Add: "Last activity" = most recent of last scan vs last redeem
// ✅ Add: "Never redeemed" + "High balance" quick signals

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";

const ET_TZ = "America/New_York";

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

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

async function fetchVipOverview(): Promise<VipOverviewRow[]> {
  const { data, error } = await supabaseServer
    .from("rewards_user_overview")
    .select(
      "user_id, phone, full_name, email, zip, is_vip, total_points, total_visits, first_scan_at, last_scan_at"
    )
    .eq("is_vip", true);

  if (error) {
    console.error("[vips] fetchVipOverview error", error);
    return [];
  }

  return (data ?? []) as VipOverviewRow[];
}

async function fetchRedemptionAggregates(): Promise<Map<string, RedemptionAggregate>> {
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
      if (created_at && (!existing.last_redeem_at || created_at > existing.last_redeem_at)) {
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

  // ✅ FIX: scan_date must be ET day string (aligns to Tonight)
  const todayEt = getEtYmd();

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
    scan_date: todayEt,
  });

  if (error) {
    console.error("[vips] adjustVipPoints insert error", error);
  } else {
    await logVipAction({
      action: "vip:adjust_points",
      entityId: userId,
      details: { previous_points: currentPoints, target_points: targetPoints, delta, scan_date: todayEt },
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

function formatShortDateTimeEt(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: ET_TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n || 0));
}

function fmtCompact(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
}

type SortKey = "points" | "visits" | "last_checkin" | "last_redeem" | "last_activity" | "name";

// --- Page --------------------------------------------------------------------

export default async function VipUsersPage(props: {
  searchParams?: Promise<{ q?: string; sort?: SortKey }>;
}) {
  await requireDashboardSession();

  const sp = (await props.searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const sort: SortKey = sp.sort ?? "points";

  const [rowsRaw, redemptionMap] = await Promise.all([fetchVipOverview(), fetchRedemptionAggregates()]);

  // Filter (name/phone/email/zip/user_id)
  const rows = rowsRaw.filter((r) => {
    if (!q) return true;
    const blob = [safeStr(r.full_name), safeStr(r.phone), safeStr(r.email), safeStr(r.zip), safeStr(r.user_id)].join(
      " "
    );
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

    const aLastScan = a.last_scan_at ? new Date(a.last_scan_at).getTime() : 0;
    const bLastScan = b.last_scan_at ? new Date(b.last_scan_at).getTime() : 0;

    const aRedeemIso = aId ? redemptionMap.get(aId)?.last_redeem_at : null;
    const bRedeemIso = bId ? redemptionMap.get(bId)?.last_redeem_at : null;

    const aLastRedeem = aRedeemIso ? new Date(aRedeemIso).getTime() : 0;
    const bLastRedeem = bRedeemIso ? new Date(bRedeemIso).getTime() : 0;

    const aLastActivity = Math.max(aLastScan, aLastRedeem);
    const bLastActivity = Math.max(bLastScan, bLastRedeem);

    const aName = (a.full_name ?? "").toLowerCase();
    const bName = (b.full_name ?? "").toLowerCase();

    switch (sort) {
      case "visits":
        return bVisits - aVisits;
      case "last_checkin":
        return bLastScan - aLastScan;
      case "last_redeem":
        return bLastRedeem - aLastRedeem;
      case "last_activity":
        return bLastActivity - aLastActivity;
      case "name":
        return aName.localeCompare(bName);
      case "points":
      default:
        return bPoints - aPoints;
    }
  });

  // KPIs (show total vs filtered)
  const totalVipsAll = rowsRaw.length;
  const filteredVips = sorted.length;

  const pointsLiabilityFiltered = rows.reduce((sum, r) => sum + (Number(r.total_points ?? 0) || 0), 0);

  const neverRedeemedCountFiltered = rows.reduce((sum, r) => {
    const id = r.user_id ?? "";
    if (!id) return sum;
    const red = redemptionMap.get(id);
    return red && red.total_redemptions > 0 ? sum : sum + 1;
  }, 0);

  const HIGH_BALANCE = 500;
  const highBalanceCountFiltered = rows.reduce((sum, r) => {
    const pts = Number(r.total_points ?? 0) || 0;
    return pts >= HIGH_BALANCE ? sum + 1 : sum;
  }, 0);

  return (
    <DashboardShell
      activeTab="rewards"
      title="VIP guests"
      subtitle="Search VIPs, review balances & redemption behavior, and correct points when needed. (Aligned to ET)"
    >
      <div className="space-y-8">
        {/* KPI cards (rewards-oriented, not Tonight redundant) */}
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">VIPs</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {filteredVips}/{totalVipsAll}
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{fmtInt(filteredVips)}</p>
            <p className="mt-1 text-xs text-slate-500">Filtered results (total shown in pill).</p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Points liability</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{fmtCompact(pointsLiabilityFiltered)}</p>
            <p className="mt-1 text-xs text-slate-500">Sum of points across filtered VIPs.</p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Never redeemed</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{fmtInt(neverRedeemedCountFiltered)}</p>
            <p className="mt-1 text-xs text-slate-500">VIPs with 0 redemption history.</p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">High balance</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{fmtInt(highBalanceCountFiltered)}</p>
            <p className="mt-1 text-xs text-slate-500">VIPs with ≥ {HIGH_BALANCE} points.</p>
          </div>
        </section>

        {/* Table */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">VIP guests &amp; rewards activity</h2>
              <p className="mt-1 text-sm text-slate-500">
                Click a guest to open insights. Use <span className="font-semibold text-slate-700">Set total</span> to
                correct balances.
              </p>
            </div>

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
                <option value="last_activity">Sort: Last activity</option>
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
                <Link href="/rewards/vips" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
                  Clear
                </Link>
              )}
            </form>
          </div>

          {sorted.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No VIPs match this search.</p>
          ) : (
            <>
              <div className="mt-6 overflow-x-auto rounded-2xl">
                <div className="min-w-[980px]">
                  {/* Header row */}
                  <div className="grid gap-3 border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,2.1fr)]">
                    <span>Guest</span>
                    <span>Contact</span>
                    <span className="text-right">Points</span>
                    <span className="text-right">Visits</span>
                    <span>Last check-in</span>
                    <span>Last activity</span>
                    <span className="text-right">Redeems</span>
                    <span className="text-right">Set total points</span>
                  </div>

                  <div className="mt-1 space-y-2">
                    {sorted.map((row) => {
                      const userId = row.user_id ?? "";
                      const points = Number(row.total_points ?? 0) || 0;
                      const visits = Number(row.total_visits ?? 0) || 0;

                      const redStats = userId ? redemptionMap.get(userId) : undefined;
                      const lastRedeem = redStats?.last_redeem_at ?? null;
                      const totalRedemptions = redStats?.total_redemptions ?? 0;
                      const lastRewardName = redStats?.last_reward_name ?? null;

                      const displayName =
                        row.full_name && row.full_name.trim().length > 0 ? row.full_name : "Unknown guest";

                      const displayPhone10 = formatPhone10(row.phone);

                      const lastActivityIso =
                        (lastRedeem && row.last_scan_at
                          ? lastRedeem >= row.last_scan_at
                            ? lastRedeem
                            : row.last_scan_at
                          : lastRedeem || row.last_scan_at) ?? null;

                      return (
                        <form
                          key={userId || `${displayPhone10}-${displayName}`}
                          action={adjustVipPoints}
                          className="grid items-center gap-3 rounded-3xl bg-slate-50 px-4 py-3 text-xs shadow-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,2.1fr)]"
                        >
                          <input type="hidden" name="user_id" value={userId} />
                          <input type="hidden" name="current_points" value={points} />

                          {/* Guest */}
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-slate-900">
                              {userId ? (
                                <Link
                                  href={`/rewards/vips/${userId}/insights`}
                                  className="hover:text-amber-600 hover:underline"
                                >
                                  {displayName}
                                </Link>
                              ) : (
                                displayName
                              )}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-slate-500">
                              {row.email ? row.email : row.zip ? `ZIP ${row.zip}` : userId ? `ID ${userId}` : "—"}
                            </div>
                          </div>

                          {/* Contact */}
                          <div className="min-w-0 truncate font-mono text-slate-700">{displayPhone10}</div>

                          {/* Points */}
                          <div className="text-right text-[13px] font-semibold text-slate-900">{fmtInt(points)}</div>

                          {/* Visits */}
                          <div className="text-right text-[13px] text-slate-900">{fmtInt(visits)}</div>

                          {/* Last check-in */}
                          <div className="text-[11px] text-slate-600">{formatDate(row.last_scan_at)}</div>

                          {/* Last activity */}
                          <div className="text-[11px] text-slate-700" title={lastRewardName ? `Last reward: ${lastRewardName}` : ""}>
                            {formatShortDateTimeEt(lastActivityIso)}
                          </div>

                          {/* Redeems */}
                          <div className="text-right text-[13px] font-semibold text-slate-900">{fmtInt(totalRedemptions)}</div>

                          {/* Point adjustment */}
                          <div className="flex items-center justify-end gap-2">
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
                              Save
                            </button>
                          </div>
                        </form>
                      );
                    })}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-slate-400">
                Notes: “Redeems” is lifetime from rewards_redemptions. Manual point changes write a rewards_scans row with source=dashboard_adjust using ET scan_date.
              </p>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
