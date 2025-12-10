// app/menu/bar-bites/page.tsx

import React from "react";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: string | null; // "$12", "$22", etc.
  category: "drink" | "bite";
  tag: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  votes_count?: number;
};

/* ------------------------------------------------------------------ */
/*  DATA LOAD                                                          */
/* ------------------------------------------------------------------ */

async function getMenuItems(): Promise<MenuItem[]> {
  const { data: items, error: itemsError } = await supabaseServer
    .from("bar_bites_items")
    .select(
      "id, name, description, price, category, tag, is_featured, is_active, sort_order, created_at"
    )
    .order("category", { ascending: true })
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true });

  if (itemsError) {
    console.error("[Dashboard] Failed to load bar_bites_items:", itemsError);
    return [];
  }

  const baseItems = (items || []) as MenuItem[];
  if (baseItems.length === 0) return baseItems;

  const ids = baseItems.map((i) => i.id);

  const { data: votes, error: votesError } = await supabaseServer
    .from("bar_bites_votes")
    .select("item_id")
    .in("item_id", ids);

  if (votesError) {
    console.error("[Dashboard] Failed to load bar_bites_votes:", votesError);
    return baseItems;
  }

  const counts: Record<string, number> = {};
  (votes || []).forEach((row: any) => {
    const itemId = row.item_id as string;
    counts[itemId] = (counts[itemId] || 0) + 1;
  });

  return baseItems.map((item) => ({
    ...item,
    votes_count: counts[item.id] || 0,
  }));
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function normalizePriceInput(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // If they already typed a $, just keep it.
  if (trimmed.startsWith("$")) return trimmed;

  // Otherwise treat it as whole dollars and prefix $.
  const numeric = trimmed.replace(/[^\d]/g, "");
  if (!numeric) return null;

  return `$${numeric}`;
}

/* ------------------------------------------------------------------ */
/*  SERVER ACTIONS                                                     */
/* ------------------------------------------------------------------ */

export async function createMenuItem(formData: FormData) {
  "use server";

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const priceRaw = (formData.get("price") as string) ?? "";
  const category = (formData.get("category") as string) as "drink" | "bite";
  const tag = (formData.get("tag") as string)?.trim();
  const sortOrderRaw = (formData.get("sort_order") as string) || "0";

  if (!name || !category) {
    console.error("[Dashboard] Missing name or category for bar-bites item");
    return;
  }

  const price = normalizePriceInput(priceRaw);
  const sort_order = Number.isNaN(Number(sortOrderRaw))
    ? 0
    : Number(sortOrderRaw);

  const { error } = await supabaseServer.from("bar_bites_items").insert({
    name,
    description: description || null,
    price,
    category,
    tag: tag || null,
    is_featured: false,
    is_active: true,
    sort_order,
  });

  if (error) {
    console.error("[Dashboard] Failed to create bar_bites_item:", error);
  }

  revalidatePath("/menu/bar-bites");
}

export async function updateMenuItem(formData: FormData) {
  "use server";

  const id = (formData.get("id") as string) || "";
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const priceRaw = (formData.get("price") as string) ?? "";
  const category = (formData.get("category") as string) as "drink" | "bite";
  const tag = (formData.get("tag") as string)?.trim();
  const sortOrderRaw = (formData.get("sort_order") as string) || "0";

  if (!id || !name || !category) {
    console.error("[Dashboard] Missing id, name, or category for update");
    return;
  }

  const price = normalizePriceInput(priceRaw);
  const sort_order = Number.isNaN(Number(sortOrderRaw))
    ? 0
    : Number(sortOrderRaw);

  const { error } = await supabaseServer
    .from("bar_bites_items")
    .update({
      name,
      description: description || null,
      price,
      category,
      tag: tag || null,
      sort_order,
    })
    .eq("id", id);

  if (error) {
    console.error("[Dashboard] Failed to update bar_bites_item:", error);
  }

  revalidatePath("/menu/bar-bites");
}

export async function deleteMenuItem(formData: FormData) {
  "use server";

  const id = (formData.get("id") as string) || "";
  if (!id) {
    console.error("[Dashboard] Missing id for delete");
    return;
  }

  const { error: votesError } = await supabaseServer
    .from("bar_bites_votes")
    .delete()
    .eq("item_id", id);

  if (votesError) {
    console.error("[Dashboard] Failed to delete bar_bites_votes:", votesError);
  }

  const { error: itemError } = await supabaseServer
    .from("bar_bites_items")
    .delete()
    .eq("id", id);

  if (itemError) {
    console.error("[Dashboard] Failed to delete bar_bites_item:", itemError);
  }

  revalidatePath("/menu/bar-bites");
}

export async function toggleActiveItem(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;
  const value = formData.get("value") as string;

  const isActive = value === "true";

  const { error } = await supabaseServer
    .from("bar_bites_items")
    .update({ is_active: !isActive })
    .eq("id", id);

  if (error) {
    console.error("[Dashboard] Failed to toggle is_active:", error);
  }

  revalidatePath("/menu/bar-bites");
}

export async function toggleFeaturedItem(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;
  const value = formData.get("value") as string;

  const isFeatured = value === "true";

  const { error } = await supabaseServer
    .from("bar_bites_items")
    .update({ is_featured: !isFeatured })
    .eq("id", id);

  if (error) {
    console.error("[Dashboard] Failed to toggle is_featured:", error);
  }

  revalidatePath("/menu/bar-bites");
}

/* ------------------------------------------------------------------ */
/*  UI COMPONENTS                                                      */
/* ------------------------------------------------------------------ */

function ItemCard({ item }: { item: MenuItem }) {
  const createdDate = new Date(item.created_at);
  const createdLabel = createdDate.toLocaleDateString();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      {/* Top row: title + chips + vote count */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {item.name}
            </h3>
            {item.is_featured && (
              <span className="inline-flex items-center rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-semibold text-slate-900">
                Featured
              </span>
            )}
            <span
              className={[
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                item.is_active
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-700",
              ].join(" ")}
            >
              {item.is_active ? "Active" : "Hidden"}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {item.category === "drink" ? "Drink" : "Bite"} · Added{" "}
            {createdLabel}
          </p>
        </div>
        <div className="text-xs text-right text-slate-500">
          <div>
            Votes:{" "}
            <span className="font-semibold text-slate-800">
              {item.votes_count ?? 0}
            </span>
          </div>
          {typeof item.sort_order === "number" && (
            <div className="mt-0.5 text-[11px] text-slate-400">
              Sort: {item.sort_order}
            </div>
          )}
        </div>
      </div>

      {item.description && (
        <p className="mt-3 text-sm text-slate-700">{item.description}</p>
      )}

      <div className="mt-4 border-t border-slate-200 pt-4">
        {/* MAIN EDIT FORM (Save changes) */}
        <form action={updateMenuItem} className="grid gap-3 text-xs md:grid-cols-2">
          <input type="hidden" name="id" value={item.id} />

          <div className="space-y-1">
            <label className="font-medium text-slate-700">Name</label>
            <input
              name="name"
              defaultValue={item.name}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-slate-700">Description</label>
            <input
              name="description"
              defaultValue={item.description ?? ""}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-slate-700">Price</label>
            <input
              name="price"
              defaultValue={item.price ?? ""}
              placeholder="$12"
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-slate-700">Category</label>
            <select
              name="category"
              defaultValue={item.category}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <option value="drink">Drink</option>
              <option value="bite">Bite</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-medium text-slate-700">Tag (optional)</label>
            <input
              name="tag"
              defaultValue={item.tag ?? ""}
              placeholder="Chef special, seasonal…"
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-slate-700">Sort order</label>
            <input
              name="sort_order"
              type="number"
              defaultValue={item.sort_order ?? 0}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="md:col-span-2 mt-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-black"
            >
              Save changes
            </button>
          </div>
        </form>

        {/* SEPARATE ACTION ROW – no nested forms */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {/* Active toggle */}
            <form action={toggleActiveItem}>
              <input type="hidden" name="id" value={item.id} />
              <input
                type="hidden"
                name="value"
                value={item.is_active ? "true" : "false"}
              />
              <button
                type="submit"
                className={[
                  "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium",
                  item.is_active
                    ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    : "border-slate-900 bg-slate-900 text-slate-50 hover:bg-black",
                ].join(" ")}
              >
                {item.is_active ? "Hide item" : "Make active"}
              </button>
            </form>

            {/* Featured toggle */}
            <form action={toggleFeaturedItem}>
              <input type="hidden" name="id" value={item.id} />
              <input
                type="hidden"
                name="value"
                value={item.is_featured ? "true" : "false"}
              />
              <button
                type="submit"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-amber-50"
              >
                {item.is_featured ? "Remove featured" : "Mark featured"}
              </button>
            </form>
          </div>

          {/* Delete */}
          <form action={deleteMenuItem}>
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
            >
              Delete item
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default async function BarBitesPage() {
  const items = await getMenuItems();

  const drinks = items.filter((i) => i.category === "drink");
  const bites = items.filter((i) => i.category === "bite");

  return (
    <DashboardShell
      title="Bar & Bites"
      subtitle="Control what guests see in the Bar & Bites menu in the app."
      activeTab="bar-bites"
    >
      <div className="space-y-6">
        {/* Top intro card */}
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Bar & Bites menu
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Add, edit, or hide menu items. Active items appear in the
                Sugarshack Downtown app under Bar & Bites.
              </p>
            </div>
            <div className="flex flex-col items-start text-[11px] text-slate-500 sm:items-end">
              <span>
                {items.filter((i) => i.is_active).length} active items
              </span>
              <span>{items.length} total items</span>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
          {/* Left: existing items */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Existing items
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Edit copy, prices, tags, or visibility. Changes sync instantly
                  to the app.
                </p>
              </div>
              <div className="space-y-6 p-4 sm:p-5">
                {items.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No items yet. Add your first drink or bite using the form on
                    the right.
                  </p>
                )}

                {drinks.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Drinks
                    </h3>
                    <div className="space-y-3">
                      {drinks.map((item) => (
                        <ItemCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {bites.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Bites
                    </h3>
                    <div className="space-y-3">
                      {bites.map((item) => (
                        <ItemCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: create form */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Add new item
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Use this for new bites, cocktails, or specials. You can
                  re-order items later using the sort order field.
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <form action={createMenuItem} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      Name
                    </label>
                    <input
                      name="name"
                      placeholder="Shack-A-Rita"
                      required
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      Description
                    </label>
                    <textarea
                      name="description"
                      rows={3}
                      placeholder="Short description guests will see in the app."
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">
                        Price (optional)
                      </label>
                      <input
                        name="price"
                        placeholder="$12"
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">
                        Category
                      </label>
                      <select
                        name="category"
                        defaultValue="drink"
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      >
                        <option value="drink">Drink</option>
                        <option value="bite">Bite</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">
                        Tag (optional)
                      </label>
                      <input
                        name="tag"
                        placeholder="Chef special, seasonal…"
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">
                        Sort order
                      </label>
                      <input
                        name="sort_order"
                        type="number"
                        defaultValue={0}
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-full bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-amber-500"
                    >
                      Add item
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
