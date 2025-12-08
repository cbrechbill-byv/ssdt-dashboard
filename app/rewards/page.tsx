// app/rewards/page.tsx
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";

import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";

type RewardItem = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

async function requireDashboardSession() {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  return session;
}

async function fetchRewards(): Promise<RewardItem[]> {
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("rewards_menu_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[rewards] fetchRewards error", error);
    return [];
  }

  return (data ?? []) as RewardItem[];
}

type RewardLogOptions = {
  action: string;
  entityId?: string;
  details?: Record<string, unknown>;
};

async function logRewardAction(options: RewardLogOptions) {
  const session = await getDashboardSession();
  const supabase = supabaseServer;

  const actor_email = session?.email ?? "unknown";
  const actor_role = session?.role ?? "unknown";

  const { error } = await supabase.from("dashboard_audit_log").insert({
    actor_email,
    actor_role,
    action: options.action,
    entity: "rewards_menu",
    entity_id: options.entityId ?? null,
    details: options.details ?? null,
  });

  if (error) {
    console.error("[rewards-menu] log action error", error);
  }
}

export default async function RewardsPage() {
  await requireDashboardSession();
  const items = await fetchRewards();

  return (
    <DashboardShell
      activeTab="rewards"
      title="Sugarshack Downtown VIP Dashboard"
      subtitle="Rewards menu · Manage VIP reward items and point costs."
    >
      <div className="space-y-8">
        {/* Header card + manage staff codes link */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h1 className="text-xl font-semibold text-slate-900">
        Rewards catalog
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        These rewards power the in-app Rewards menu. Update point
        values and sort order without shipping a new app build.
      </p>
    </div>

    {/* Right side: VIP points + staff codes */}
    <div className="flex flex-wrap gap-2 justify-start md:justify-end">
      <Link
        href="/rewards/vips"
        className="inline-flex items-center rounded-full bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-amber-500"
      >
        VIP points
      </Link>

      <Link
        href="/rewards/staff-codes"
        className="inline-flex items-center rounded-full bg-white px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm border border-slate-200 hover:bg-slate-50"
      >
        Staff codes
      </Link>
    </div>
  </div>
</section>


        {/* Add new reward */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Add new reward
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Create a new reward with a label and required points.
          </p>

          <form
            action={createReward}
            className="mt-4 grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Name
              </label>
              <input
                name="name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition hover:bg-white focus:border-amber-400"
                placeholder="Free non-alcoholic drink"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Description (optional)
              </label>
              <input
                name="description"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition hover:bg-white focus:border-amber-400"
                placeholder="Any NA beverage up to $X"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Points required
              </label>
              <input
                name="points_required"
                type="number"
                min={1}
                defaultValue={100}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition hover:bg-white focus:border-amber-400"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Sort order
              </label>
              <input
                name="sort_order"
                type="number"
                defaultValue={0}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition hover:bg-white focus:border-amber-400"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-amber-500"
              >
                Add reward
              </button>
            </div>
          </form>
        </section>

        {/* Existing rewards */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Existing rewards
            </h2>
            <span className="text-xs text-slate-400">
              {items.length} {items.length === 1 ? "reward" : "rewards"}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-slate-500">
              No rewards yet. Use the form above to create your first reward.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs fontsize font-semibold uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-4 text-left">Name</th>
                      <th className="py-2 pr-4 text-left">Description</th>
                      <th className="py-2 pr-4 text-left">Points</th>
                      <th className="py-2 pr-4 text-left">Sort</th>
                      <th className="py-2 pr-4 text-center">Active</th>
                      <th className="py-2 pl-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const formId = `reward-${item.id}`;
                      const deleteFormId = `reward-delete-${item.id}`;

                      return (
                        <tr key={item.id}>
                          {/* hidden id field associated with save form */}
                          <td className="py-2 pr-4">
                            <input
                              type="hidden"
                              name="id"
                              value={item.id}
                              form={formId}
                            />
                            <input
                              name="name"
                              defaultValue={item.name}
                              form={formId}
                              className="w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none ring-0 transition hover:bg-white focus:border-amber-400"
                            />
                          </td>

                          <td className="py-2 pr-4">
                            <input
                              name="description"
                              defaultValue={item.description ?? ""}
                              form={formId}
                              className="w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none ring-0 transition hover:bg-white focus:border-amber-400"
                            />
                          </td>

                          <td className="py-2 pr-4">
                            <input
                              name="points_required"
                              type="number"
                              min={1}
                              defaultValue={item.points_required}
                              form={formId}
                              className="w-24 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none ring-0 transition hover:bg-white focus:border-amber-400"
                            />
                          </td>

                          <td className="py-2 pr-4">
                            <input
                              name="sort_order"
                              type="number"
                              defaultValue={item.sort_order}
                              form={formId}
                              className="w-20 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none ring-0 transition hover:bg-white focus:border-amber-400"
                            />
                          </td>

                          <td className="py-2 pr-4 text-center">
                            <input
                              type="checkbox"
                              name="is_active"
                              defaultChecked={item.is_active}
                              form={formId}
                              className="h-4 w-4 rounded border-slate-300 text-amber-400 focus:ring-amber-400"
                            />
                          </td>

                          <td className="py-2 pl-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="submit"
                                form={formId}
                                className="inline-flex rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                              >
                                Save
                              </button>
                              <button
                                type="submit"
                                form={deleteFormId}
                                className="inline-flex rounded-full bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Hidden forms that inputs/checkboxes are attached to via `form` attribute */}
              {items.map((item) => (
                <form
                  key={`save-form-${item.id}`}
                  id={`reward-${item.id}`}
                  action={updateReward}
                />
              ))}
              {items.map((item) => (
                <form
                  key={`delete-form-${item.id}`}
                  id={`reward-delete-${item.id}`}
                  action={deleteReward}
                >
                  <input type="hidden" name="id" value={item.id} />
                </form>
              ))}
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

/* SERVER ACTIONS */

export async function createReward(formData: FormData) {
  "use server";

  await requireDashboardSession();
  const supabase = supabaseServer;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const points_required = Number(formData.get("points_required") ?? "0");
  const sort_order = Number(formData.get("sort_order") ?? "0");

  if (!name || !points_required || Number.isNaN(points_required)) return;

  const { data, error } = await supabase
    .from("rewards_menu_items")
    .insert({
      name,
      description,
      points_required,
      sort_order,
      is_active: true,
    })
    .select("id")
    .single();

  if (!error) {
    await logRewardAction({
      action: "create",
      entityId: data?.id ?? undefined,
      details: { name, points_required, sort_order },
    });
  } else {
    console.error("[rewards] createReward error", error);
  }

  revalidatePath("/rewards");
}

export async function updateReward(formData: FormData) {
  "use server";

  await requireDashboardSession();
  const supabase = supabaseServer;

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const points_required = Number(formData.get("points_required") ?? "0");
  const sort_order = Number(formData.get("sort_order") ?? "0");
  const is_active = formData.get("is_active") === "on";

  if (!id || !name || !points_required || Number.isNaN(points_required)) return;

  const { error } = await supabase
    .from("rewards_menu_items")
    .update({
      name,
      description,
      points_required,
      sort_order,
      is_active,
    })
    .eq("id", id);

  if (!error) {
    await logRewardAction({
      action: "update",
      entityId: id,
      details: { name, points_required, sort_order, is_active },
    });
  } else {
    console.error("[rewards] updateReward error", error);
  }

  revalidatePath("/rewards");
}

export async function deleteReward(formData: FormData) {
  "use server";

  await requireDashboardSession();
  const supabase = supabaseServer;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { error } = await supabase
    .from("rewards_menu_items")
    .delete()
    .eq("id", id);

  if (!error) {
    await logRewardAction({
      action: "delete",
      entityId: id,
    });
  } else {
    console.error("[rewards] deleteReward error", error);
  }

  revalidatePath("/rewards");
}
