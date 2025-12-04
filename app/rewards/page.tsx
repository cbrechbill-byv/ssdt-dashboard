import React from "react";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type RewardMenuItem = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

async function fetchRewardsMenuItems(): Promise<RewardMenuItem[]> {
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("rewards_menu_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("points_required", { ascending: true });

  if (error) {
    console.error("[RewardsMenu] Error loading items:", error);
    return [];
  }

  return (data as RewardMenuItem[]) ?? [];
}

/**
 * SERVER ACTIONS
 */

export async function createReward(formData: FormData) {
  "use server";

  const supabase = supabaseServer;

  const name = (formData.get("name") || "").toString().trim();
  const description = (formData.get("description") || "").toString().trim();
  const pointsRaw = (formData.get("points_required") || "").toString().trim();
  const sortRaw = (formData.get("sort_order") || "").toString().trim();

  const points_required = Number(pointsRaw || "0");
  const sort_order = Number(sortRaw || "0");

  if (!name || !points_required || points_required <= 0) {
    console.error("[RewardsMenu] Invalid input for create", {
      name,
      points_required,
    });
    return;
  }

  const { error } = await supabase.from("rewards_menu_items").insert({
    name,
    description: description || null,
    points_required,
    sort_order,
    is_active: true,
  });

  if (error) {
    console.error("[RewardsMenu] Error creating item:", error);
  }

  revalidatePath("/rewards");
}

export async function updateReward(formData: FormData) {
  "use server";

  const supabase = supabaseServer;

  const id = (formData.get("id") || "").toString();
  const name = (formData.get("name") || "").toString().trim();
  const description = (formData.get("description") || "").toString().trim();
  const pointsRaw = (formData.get("points_required") || "").toString().trim();
  const sortRaw = (formData.get("sort_order") || "").toString().trim();
  const isActiveRaw = formData.get("is_active");

  if (!id) {
    console.error("[RewardsMenu] Missing id for update");
    return;
  }

  const points_required = Number(pointsRaw || "0");
  const sort_order = Number(sortRaw || "0");
  const is_active = isActiveRaw === "on" || isActiveRaw === "true";

  if (!name || !points_required || points_required <= 0) {
    console.error("[RewardsMenu] Invalid input for update", {
      id,
      name,
      points_required,
    });
    return;
  }

  const { error } = await supabase
    .from("rewards_menu_items")
    .update({
      name,
      description: description || null,
      points_required,
      sort_order,
      is_active,
    })
    .eq("id", id);

  if (error) {
    console.error("[RewardsMenu] Error updating item:", error);
  }

  revalidatePath("/rewards");
}

export async function deleteReward(formData: FormData) {
  "use server";

  const supabase = supabaseServer;
  const id = (formData.get("id") || "").toString();

  if (!id) {
    console.error("[RewardsMenu] Missing id for delete");
    return;
  }

  const { error } = await supabase
    .from("rewards_menu_items")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[RewardsMenu] Error deleting item:", error);
  }

  revalidatePath("/rewards");
}

/**
 * PAGE
 */
export default async function RewardsMenuPage() {
  const items = await fetchRewardsMenuItems();

  return (
    <DashboardShell
      title="Rewards menu"
      subtitle="Manage VIP reward items and point costs"
      activeTab="rewards"
    >
      <div className="space-y-6">
        {/* Intro card */}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
            Rewards catalog
          </h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            These rewards power the in-app Rewards menu. Update point values and
            sort order without shipping a new app build.
          </p>
        </div>

        {/* Create new reward */}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
          <h3 className="text-sm font-semibold text-slate-900 sm:text-base">
            Add new reward
          </h3>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Create a new reward with a label and required points.
          </p>

          <form
            action={createReward}
            className="mt-4 grid gap-3 sm:grid-cols-[1.5fr_2fr_minmax(110px,0.7fr)_minmax(90px,0.5fr)_auto]"
          >
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-700">
                Name
              </label>
              <input
                name="name"
                required
                placeholder="Free non-alcoholic drink"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-0 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-700">
                Description (optional)
              </label>
              <input
                name="description"
                placeholder="Any NA beverage up to $X"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-0 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Points required
              </label>
              <input
                name="points_required"
                type="number"
                min={1}
                required
                placeholder="100"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-0 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Sort order
              </label>
              <input
                name="sort_order"
                type="number"
                placeholder="0"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-0 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-amber-300 sm:w-auto"
              >
                Add reward
              </button>
            </div>
          </form>
        </div>

        {/* Existing rewards */}
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4 sm:py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 sm:text-base">
              Existing rewards
            </h3>
            <p className="text-[11px] text-slate-500 sm:text-xs">
              {items.length === 0
                ? "No rewards defined yet."
                : `${items.length} reward${items.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
              No rewards in the catalog yet. Use{" "}
              <span className="font-semibold">“Add new reward”</span> above to
              create your first item.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2 text-right">Points</th>
                    <th className="px-2 py-2 text-right">Sort</th>
                    <th className="px-2 py-2 text-center">Active</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const formId = `reward-form-${item.id}`;
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        {/* Hidden form that all inputs attach to via form= */}
                        <td className="hidden">
                          <form id={formId} action={updateReward}>
                            <input type="hidden" name="id" value={item.id} />
                          </form>
                        </td>

                        <td className="px-2 py-2 align-top">
                          <input
                            form={formId}
                            name="name"
                            defaultValue={item.name}
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm outline-none ring-0 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                          />
                        </td>

                        <td className="px-2 py-2 align-top">
                          <input
                            form={formId}
                            name="description"
                            defaultValue={item.description ?? ""}
                            placeholder="Optional description"
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm outline-none ring-0 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                          />
                        </td>

                        <td className="px-2 py-2 align-top text-right">
                          <input
                            form={formId}
                            name="points_required"
                            type="number"
                            min={1}
                            defaultValue={item.points_required}
                            className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 text-right shadow-sm outline-none ring-0 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                          />
                        </td>

                        <td className="px-2 py-2 align-top text-right">
                          <input
                            form={formId}
                            name="sort_order"
                            type="number"
                            defaultValue={item.sort_order}
                            className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 text-right shadow-sm outline-none ring-0 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                          />
                        </td>

                        <td className="px-2 py-2 align-top text-center">
                          <input
                            form={formId}
                            name="is_active"
                            type="checkbox"
                            defaultChecked={item.is_active}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-amber-400 focus:ring-0"
                          />
                        </td>

                        <td className="px-2 py-2 align-top">
                          <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:justify-end">
                            <button
                              type="submit"
                              form={formId}
                              className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-600"
                            >
                              Save
                            </button>

                            <form action={deleteReward}>
                              <input
                                type="hidden"
                                name="id"
                                value={item.id}
                              />
                              <button
                                type="submit"
                                className="mt-1 inline-flex items-center rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-medium text-red-600 shadow-sm hover:bg-red-50 sm:mt-0"
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
