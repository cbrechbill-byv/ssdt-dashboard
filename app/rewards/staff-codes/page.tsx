import { supabaseServer } from "@/lib/supabaseServer";
import DashboardShell from "@/components/layout/DashboardShell";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import bcrypt from "bcryptjs";

type StaffCodeRow = {
  id: string;
  label: string;
  created_at: string | null;
};

type RedemptionRow = {
  staff_label: string | null;
  points_spent: number | null;
  created_at: string | null;
};

type StaffStats = {
  label: string;
  redemption_count: number;
  total_points_redeemed: number;
  last_redeem_at: string | null;
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

async function fetchStaffCodesWithStats(): Promise<{
  codes: StaffCodeRow[];
  statsByLabel: Record<string, StaffStats>;
  totals: {
    totalCodes: number;
    totalRedeems: number;
    totalPoints: number;
  };
}> {
  const supabase = supabaseServer;

  // All staff codes
  const { data: codeRows, error: codeErr } = await supabase
    .from("rewards_staff_codes")
    .select("id, label, created_at")
    .order("label", { ascending: true });

  if (codeErr) {
    console.error("[Staff codes] error loading rewards_staff_codes", codeErr);
  }

  const codes = (codeRows ?? []) as StaffCodeRow[];

  // All redemptions that have a staff_label
  const { data: redemptionRows, error: redemptionErr } = await supabase
    .from("rewards_redemptions")
    .select("staff_label, points_spent, created_at")
    .not("staff_label", "is", null);

  if (redemptionErr) {
    console.error(
      "[Staff codes] error loading rewards_redemptions",
      redemptionErr
    );
  }

  const statsByLabel: Record<string, StaffStats> = {};

  (redemptionRows ?? []).forEach((row: RedemptionRow) => {
    const label = row.staff_label;
    if (!label) return;

    const points = Number(row.points_spent ?? 0);
    const createdAt = row.created_at ?? null;

    if (!statsByLabel[label]) {
      statsByLabel[label] = {
        label,
        redemption_count: 0,
        total_points_redeemed: 0,
        last_redeem_at: null,
      };
    }

    statsByLabel[label].redemption_count += 1;
    statsByLabel[label].total_points_redeemed += points;

    const currentLast = statsByLabel[label].last_redeem_at;
    if (!currentLast || (createdAt && createdAt > currentLast)) {
      statsByLabel[label].last_redeem_at = createdAt;
    }
  });

  // Totals across all staff
  const totals = Object.values(statsByLabel).reduce(
    (acc, s) => {
      acc.totalRedeems += s.redemption_count;
      acc.totalPoints += s.total_points_redeemed;
      return acc;
    },
    { totalCodes: codes.length, totalRedeems: 0, totalPoints: 0 }
  );

  return { codes, statsByLabel, totals };
}

/**
 * SERVER ACTION: Add a new staff code
 */
export async function addStaffCode(formData: FormData) {
  "use server";

  const labelRaw = (formData.get("label") as string | null) ?? "";
  const pinRaw = (formData.get("pin") as string | null) ?? "";

  const label = labelRaw.trim();
  const pin = pinRaw.trim();

  if (!label || !pin || pin.length < 4 || pin.length > 6) {
    return;
  }

  const supabase = supabaseServer;
  const session = await getDashboardSession();
  const actor_email = session?.email ?? "unknown";
  const actor_role = session?.role ?? "unknown";

  const saltRounds = 10;
  const pin_hash = await bcrypt.hash(pin, saltRounds);

  const { error: insertErr, data: inserted } = await supabase
    .from("rewards_staff_codes")
    .insert({
      label,
      pin_hash,
    })
    .select("id")
    .maybeSingle();

  if (insertErr) {
    console.error("[Staff codes] error inserting staff code", insertErr);
  } else {
    // Audit log
    try {
      await supabase.from("dashboard_audit_log").insert({
        actor_email,
        actor_role,
        action: "create",
        entity: "rewards_staff_code",
        entity_id: inserted?.id ?? null,
        details: {
          label,
          source: "staff-codes-page",
        },
      });
    } catch (logErr) {
      console.error("[Staff codes] error writing audit log (create)", logErr);
    }
  }

  revalidatePath("/rewards/staff-codes");
}

/**
 * SERVER ACTION: Delete a staff code
 */
export async function deleteStaffCode(formData: FormData) {
  "use server";

  const id = (formData.get("id") as string | null) ?? "";
  const label = (formData.get("label") as string | null) ?? "";

  if (!id) return;

  const supabase = supabaseServer;
  const session = await getDashboardSession();
  const actor_email = session?.email ?? "unknown";
  const actor_role = session?.role ?? "unknown";

  const { error: deleteErr } = await supabase
    .from("rewards_staff_codes")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    console.error("[Staff codes] error deleting staff code", deleteErr);
  } else {
    try {
      await supabase.from("dashboard_audit_log").insert({
        actor_email,
        actor_role,
        action: "delete",
        entity: "rewards_staff_code",
        entity_id: id,
        details: {
          label,
          source: "staff-codes-page",
        },
      });
    } catch (logErr) {
      console.error("[Staff codes] error writing audit log (delete)", logErr);
    }
  }

  revalidatePath("/rewards/staff-codes");
}

export default async function StaffCodesPage() {
  const { codes, statsByLabel, totals } = await fetchStaffCodesWithStats();

  return (
    <DashboardShell
      activeTab="rewards"
      title="Staff codes"
      subtitle="Control who can approve VIP redemptions."
    >
      <div className="space-y-6">
        {/* Header card with sub-nav (matches screenshot) */}
        <div className="rounded-3xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Staff codes
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Staff codes are entered on the “Redeem Now” screen in the app.
                Create one per server, bartender, or POS device so you can track
                who is approving VIP redemptions and how many points each
                server has redeemed.
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
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50"
              >
                VIP users
              </Link>
              <span className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm">
                Staff codes
              </span>
            </div>
          </div>
        </div>

        {/* Main content: existing codes + add new */}
        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
          {/* Existing staff codes */}
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Existing staff codes
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Activity and redemptions are based on the{" "}
                  <span className="font-semibold">rewards_redemptions</span>{" "}
                  table.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                {totals.totalCodes === 1
                  ? "1 code"
                  : `${totals.totalCodes} codes`}
              </div>
            </div>

            {codes.length === 0 ? (
              <p className="text-sm text-slate-600">
                No staff codes yet. Create a code on the right to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-900">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Label</th>
                      <th className="py-2 pr-4">Activity</th>
                      <th className="py-2 pr-4">Redeems</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {codes.map((code) => {
                      const stats = statsByLabel[code.label] ?? {
                        label: code.label,
                        redemption_count: 0,
                        total_points_redeemed: 0,
                        last_redeem_at: null,
                      };

                      return (
                        <tr key={code.id} className="align-top">
                          <td className="py-3 pr-4">
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex w-fit items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-800">
                                {code.label}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                Created {formatDate(code.created_at)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-xs text-slate-700">
                            {stats.redemption_count === 0 ? (
                              <span>No redemptions yet</span>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <span>
                                  Last redeem:{" "}
                                  {formatDate(stats.last_redeem_at)}
                                </span>
                                <span>
                                  Total{" "}
                                  <span className="font-semibold">
                                    {stats.total_points_redeemed}
                                  </span>{" "}
                                  pts redeemed
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-xs text-slate-700">
                            {stats.redemption_count === 0 ? (
                              <span>0 redeems</span>
                            ) : (
                              <span className="font-semibold">
                                {stats.redemption_count}{" "}
                                {stats.redemption_count === 1
                                  ? "redeem"
                                  : "redeems"}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-xs">
                            <form action={deleteStaffCode}>
                              <input type="hidden" name="id" value={code.id} />
                              <input
                                type="hidden"
                                name="label"
                                value={code.label}
                              />
                              <button
                                type="submit"
                                className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-200"
                              >
                                Delete
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add new staff code */}
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Add new staff code
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Create codes for servers, bartenders, and tablets. The PIN is
                hashed with bcrypt before storing — only the label is visible
                here.
              </p>
            </div>

            <form action={addStaffCode} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Label (who or what this code is for)
                </label>
                <input
                  name="label"
                  type="text"
                  placeholder="Bar 1 POS · Server John"
                  className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-yellow-400 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  PIN (staff enters this in the app)
                </label>
                <input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  minLength={4}
                  maxLength={6}
                  placeholder="4–6 digits"
                  className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-yellow-400 focus:outline-none"
                  required
                />
                <p className="text-[11px] text-slate-500">
                  PINs are hashed before storing. Share the plain PIN with staff
                  outside of the app.
                </p>
              </div>

              <button
                type="submit"
                className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-yellow-300"
              >
                Add staff code
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
