// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\rewards\page.tsx
// app/rewards/page.tsx
// Rewards menu – Add / edit / toggle / delete reward items.
//
// Mobile readability (iOS Safari):
// - Increase contrast for key table/header text
// - Keep helper copy subdued but readable
// - Avoid "washed out" slate tones on light backgrounds

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  const { data, error } = await supabaseServer
    .from("rewards_menu_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[rewards-menu] fetchRewards error", error);
    return [];
  }

  return (data ?? []) as RewardItem[];
}

async function logRewardAction(options: {
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
    entity: "rewards_menu",
    entity_id: options.entityId ?? null,
    details: options.details ?? null,
  });

  if (error) {
    console.error("[rewards-menu] log action error", error);
  }
}

// ---- Server actions ---------------------------------------------------------

export async function createRewardItem(formData: FormData) {
  "use server";

  await requireDashboardSession();

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const pointsRaw = (formData.get("points_required") as string) ?? "";
  const sortRaw = (formData.get("sort_order") as string) ?? "0";

  if (!name) {
    console.error("[rewards-menu] Missing name");
    return;
  }

  const points = Number(pointsRaw);
  const sort_order = Number(sortRaw);

  const { data, error } = await supabaseServer
    .from("rewards_menu_items")
    .insert({
      name,
      description: description || null,
      points_required: Number.isFinite(points) ? points : 0,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("[rewards-menu] create error", error);
  } else if (data) {
    await logRewardAction({
      action: "rewards_menu:create",
      entityId: data.id,
      details: { name: data.name, points_required: data.points_required },
    });
  }

  revalidatePath("/rewards");
}

export async function upsertOrDeleteRewardItem(formData: FormData) {
  "use server";

  await requireDashboardSession();

  const id = formData.get("id") as string;
  const intent = (formData.get("intent") as string | null) ?? "save";

  if (!id) {
    console.error("[rewards-menu] Missing id in upsertOrDeleteRewardItem");
    return;
  }

  if (intent === "delete") {
    const { error } = await supabaseServer
      .from("rewards_menu_items")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[rewards-menu] delete error", error);
    } else {
      await logRewardAction({
        action: "rewards_menu:delete",
        entityId: id,
      });
    }

    revalidatePath("/rewards");
    return;
  }

  // Save / update branch
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const pointsRaw = (formData.get("points_required") as string) ?? "";
  const sortRaw = (formData.get("sort_order") as string) ?? "0";
  const isActiveRaw = formData.get("is_active") as string | null;

  const points = Number(pointsRaw);
  const sort_order = Number(sortRaw);
  const is_active = isActiveRaw === "on";

  const { error } = await supabaseServer
    .from("rewards_menu_items")
    .update({
      name,
      description: description || null,
      points_required: Number.isFinite(points) ? points : 0,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      is_active,
    })
    .eq("id", id);

  if (error) {
    console.error("[rewards-menu] update error", error);
  } else {
    await logRewardAction({
      action: "rewards_menu:update",
      entityId: id,
      details: { name, points_required: points, sort_order, is_active },
    });
  }

  revalidatePath("/rewards");
}

// ---- Page -------------------------------------------------------------------

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
        {/* Add new reward */}
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm sm:px-8 sm:py-6">
          <h1 className="text-base font-semibold text-slate-900">
            Add new reward
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Create a new reward with a label and required points.
          </p>

          <form
            action={createRewardItem}
            className="mt-4 grid gap-3 text-sm md:grid-cols-[minmax(0,2.2fr)_minmax(0,3fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto] md:items-end"
          >
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
                Name
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="Free non-alcoholic drink"
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
                Description (optional)
              </label>
              <input
                type="text"
                name="description"
                placeholder="Any NA beverage up to $X"
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
                Points required
              </label>
              <input
                type="number"
                min={0}
                name="points_required"
                required
                defaultValue={100}
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
                Sort order
              </label>
              <input
                type="number"
                name="sort_order"
                defaultValue={0}
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex items-center rounded-full bg-amber-400 px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-500"
              >
                Add reward
              </button>
            </div>
          </form>
        </section>

        {/* Existing rewards */}
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm sm:px-8 sm:py-6">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Existing rewards
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Edit labels, points, sort order, or toggle rewards on/off in the
                app.
              </p>
            </div>
            {items.length > 0 && (
              <p className="text-xs font-medium text-slate-700">
                {items.length} reward{items.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {items.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No rewards created yet. Add your first reward above.
            </p>
          ) : (
            <>
              {/* Header row */}
              <div className="mt-5 grid gap-3 border-b border-slate-200 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700 md:grid-cols-[minmax(0,2.2fr)_minmax(0,3fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)]">
                <span>Name</span>
                <span>Description</span>
                <span>Points</span>
                <span>Sort</span>
                <span className="text-center">Active</span>
                <span className="text-right">Actions</span>
              </div>

              {/* Rows */}
              <div className="mt-1 space-y-3">
                {items.map((item) => (
                  <form
                    key={item.id}
                    action={upsertOrDeleteRewardItem}
                    className="grid gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm md:grid-cols-[minmax(0,2.2fr)_minmax(0,3fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)] md:items-center"
                  >
                    <input type="hidden" name="id" value={item.id} />

                    <div>
                      <input
                        type="text"
                        name="name"
                        defaultValue={item.name}
                        className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        name="description"
                        defaultValue={item.description ?? ""}
                        className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      />
                    </div>

                    <div>
                      <input
                        type="number"
                        name="points_required"
                        defaultValue={item.points_required}
                        className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      />
                    </div>

                    <div>
                      <input
                        type="number"
                        name="sort_order"
                        defaultValue={item.sort_order}
                        className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      />
                    </div>

                    <div className="flex items-center justify-center">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800">
                        <input
                          type="checkbox"
                          name="is_active"
                          defaultChecked={item.is_active}
                          className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                        />
                      </label>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="submit"
                        name="intent"
                        value="save"
                        className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                      >
                        Save
                      </button>
                      <button
                        type="submit"
                        name="intent"
                        value="delete"
                        className="rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
