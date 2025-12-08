// app/rewards/staff-codes/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";

type StaffCodeRow = {
  id: string;
  label: string;
  pin_hash: string;
  created_at: string;
};

type StaffCodeWithStats = {
  id: string;
  label: string;
  created_at: string;
  pin_hash: string;
  // Derived stats
  last_redeemed_at: string | null;
  redemption_count: number;
  total_points_redeemed: number;
};

async function requireDashboardSession() {
  const session = await getDashboardSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

function getLast4(pin: string): string {
  if (!pin) return "0000";
  const trimmed = pin.trim();
  if (trimmed.length >= 4) return trimmed.slice(-4);
  return trimmed.padStart(4, "0");
}

async function fetchStaffCodesWithStats(): Promise<StaffCodeWithStats[]> {
  const supabase = supabaseServer;

  // Base staff codes
  const { data, error } = await supabase
    .from("rewards_staff_codes")
    .select("id, label, pin_hash, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[staff-codes] fetchStaffCodes error", error);
    return [];
  }

  const codes: StaffCodeRow[] = (data ?? []) as StaffCodeRow[];

  if (codes.length === 0) {
    return [];
  }

  // Build keys for matching redemptions: label + last4
  type StaffKey = {
    label: string;
    last4: string;
  };

  const staffKeys: StaffKey[] = codes.map((c) => ({
    label: c.label,
    last4: getLast4(c.pin_hash),
  }));

  // Fetch all redemptions and aggregate by staff_label + staff_last4
  type StaffAgg = {
    last_redeemed_at: string | null;
    redemption_count: number;
    total_points_redeemed: number;
  };

  let aggMap = new Map<string, StaffAgg>();

  const { data: redemptions, error: redemptionsError } = await supabase
    .from("rewards_redemptions")
    .select("staff_label, staff_last4, points_spent, created_at");

  if (redemptionsError) {
    console.error(
      "[staff-codes] fetch redemptions for staff stats error",
      redemptionsError
    );
  } else {
    (redemptions ?? []).forEach((r: any) => {
      const label = (r.staff_label as string) ?? "";
      const last4 = (r.staff_last4 as string) ?? "";
      if (!label || !last4) return;

      const key = `${label}::${last4}`;
      const created_at = r.created_at as string;
      const points = (r.points_spent as number) ?? 0;

      const existing = aggMap.get(key) ?? {
        last_redeemed_at: null,
        redemption_count: 0,
        total_points_redeemed: 0,
      };

      const newerLast =
        !existing.last_redeemed_at ||
        new Date(created_at) > new Date(existing.last_redeemed_at);

      aggMap.set(key, {
        last_redeemed_at: newerLast ? created_at : existing.last_redeemed_at,
        redemption_count: existing.redemption_count + 1,
        total_points_redeemed: existing.total_points_redeemed + points,
      });
    });
  }

  // Attach stats to each staff code
  const enriched: StaffCodeWithStats[] = codes.map((code) => {
    const last4 = getLast4(code.pin_hash);
    const key = `${code.label}::${last4}`;
    const stats =
      aggMap.get(key) ?? {
        last_redeemed_at: null,
        redemption_count: 0,
        total_points_redeemed: 0,
      };

    return {
      id: code.id,
      label: code.label,
      created_at: code.created_at,
      pin_hash: code.pin_hash,
      last_redeemed_at: stats.last_redeemed_at,
      redemption_count: stats.redemption_count,
      total_points_redeemed: stats.total_points_redeemed,
    };
  });

  return enriched;
}

async function logStaffCodeAction(options: {
  action: "create" | "delete";
  entityId?: string | null;
  details?: Record<string, unknown>;
}) {
  const session = await getDashboardSession();
  const supabase = supabaseServer;

  const actor_email = session?.user?.email ?? "unknown";
  const actor_role = session?.user?.role ?? "unknown";

  const { error } = await supabase.from("dashboard_audit_log").insert({
    actor_email,
    actor_role,
    action: options.action,
    entity: "rewards_staff_code",
    entity_id: options.entityId ?? null,
    details: options.details ?? null,
  });

  if (error) {
    console.error("[staff-codes] logStaffCodeAction error", error);
  }
}

export default async function StaffCodesPage() {
  await requireDashboardSession();
  const codes = await fetchStaffCodesWithStats();

  return (
    <DashboardShell
      activeTab="rewards"
      title="Sugarshack Downtown VIP Dashboard"
      subtitle="Staff codes · Control who can approve VIP redemptions."
    >
      <div className="space-y-8">
        {/* Top explainer + sub-nav */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Staff codes
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Staff codes are entered on the “Redeem Now” screen in the app.
                Create one per server, bartender, or POS device so you can track
                who is approving VIP redemptions and how many points each
                server has redeemed.
              </p>
            </div>

            {/* Rewards sub-navigation */}
            <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
              <Link
                href="/rewards"
                className="inline-flex items-center rounded-full bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-amber-500"
              >
                Rewards menu
              </Link>
              <Link
                href="/rewards/vips"
                className="inline-flex items-center rounded-full bg-white px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm border border-slate-200 hover:bg-slate-50"
              >
                VIP users
              </Link>
              <span className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm">
                Staff codes
              </span>
            </div>
          </div>
        </section>

        {/* Layout: existing codes + add form */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* Existing codes table */}
          <div className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Existing staff codes
              </h2>
              <span className="text-xs text-slate-400">
                {codes.length} {codes.length === 1 ? "code" : "codes"}
              </span>
            </div>

            {codes.length === 0 ? (
              <p className="text-sm text-slate-500">
                No staff codes yet. Use the form on the right to create your
                first code.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-4 text-left">Label</th>
                      <th className="py-2 pr-4 text-left">Activity</th>
                      <th className="py-2 pr-4 text-left">Redeems</th>
                      <th className="py-2 pl-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {codes.map((code) => (
                      <tr key={code.id}>
                        {/* Label + created */}
                        <td className="py-2 pr-4 align-top">
                          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-800">
                            {code.label}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            Created{" "}
                            {new Date(
                              code.created_at
                            ).toLocaleDateString()}
                          </div>
                        </td>

                        {/* Activity summary */}
                        <td className="py-2 pr-4 align-top text-xs text-slate-600">
                          {code.last_redeemed_at ? (
                            <>
                              <div>
                                Last redeem:{" "}
                                {new Date(
                                  code.last_redeemed_at
                                ).toLocaleDateString()}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-500">
                                Total{" "}
                                {code.total_points_redeemed.toLocaleString()} pts
                                redeemed
                              </div>
                            </>
                          ) : (
                            <div>No redemptions yet</div>
                          )}
                        </td>

                        {/* Redeems count */}
                        <td className="py-2 pr-4 align-top text-xs text-slate-600">
                          {code.redemption_count > 0 ? (
                            <>
                              <div className="font-semibold text-slate-900">
                                {code.redemption_count.toLocaleString()}{" "}
                                {code.redemption_count === 1
                                  ? "redeem"
                                  : "redeems"}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-500">
                                Based on rewards_redemptions
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-500">
                              No redeems recorded
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2 pl-4 align-top text-right">
                          <form action={deleteStaffCode}>
                            <input type="hidden" name="id" value={code.id} />
                            <button
                              type="submit"
                              className="inline-flex rounded-full bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-100"
                            >
                              Delete
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

          {/* Add new staff code card */}
          <div className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Add new staff code
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Create codes for servers, bartenders, and tablets.
            </p>

            <form action={createStaffCode} className="mt-4 space-y-4 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Label (who or what this code is for)
                </label>
                <input
                  name="label"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition hover:bg-white focus:border-amber-400"
                  placeholder="Bar 1 POS · Server John"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  PIN (staff enters this in the app)
                </label>
                <input
                  name="pin"
                  type="password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition hover:bg-white focus:border-amber-400"
                  placeholder="4–6 digits"
                  required
                />
                <p className="text-xs text-slate-400">
                  For now, PINs are stored as plain text to match the current
                  app logic. We&apos;ll move to hashed verification in a later
                  update.
                </p>
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-amber-500"
              >
                Add staff code
              </button>
            </form>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

/* SERVER ACTIONS */

export async function createStaffCode(formData: FormData) {
  "use server";

  await requireDashboardSession();
  const supabase = supabaseServer;

  const label = String(formData.get("label") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!label || !pin) return;

  // TEMPORARY: store PIN in plain text so app can read it as-is.
  const pin_hash = pin;

  const { data, error } = await supabase
    .from("rewards_staff_codes")
    .insert({ label, pin_hash })
    .select("id")
    .single();

  if (error) {
    console.error("[staff-codes] createStaffCode error", error);
  } else {
    await logStaffCodeAction({
      action: "create",
      entityId: data?.id ?? null,
      details: { label },
    });
  }

  revalidatePath("/rewards/staff-codes");
}

export async function deleteStaffCode(formData: FormData) {
  "use server";

  await requireDashboardSession();
  const supabase = supabaseServer;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const { error } = await supabase
    .from("rewards_staff_codes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[staff-codes] deleteStaffCode error", error);
  } else {
    await logStaffCodeAction({
      action: "delete",
      entityId: id,
    });
  }

  revalidatePath("/rewards/staff-codes");
}
