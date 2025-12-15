// app/menu/bar-bites/page.tsx
// Path: /menu/bar-bites
// Sugarshack Downtown - Bar & Bites Dashboard
// Upgraded: summary + quick reorder arrows (no nested forms) + safer price parsing + better vote insights.

import React from "react";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 0;

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
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizePriceInput(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Allow "12", "$12", "12.00", "$12.00"
  const cleaned = trimmed.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;

  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;

  // If they typed decimals, keep decimals; otherwise whole dollars
  const hasDecimal = cleaned.includes(".");
  return hasDecimal ? `$${n.toFixed(2)}` : `$${Math.round(n)}`;
}

function formatCreatedLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function SummaryCard({
  label,
  helper,
  value,
}: {
  label: string;
  helper: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

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
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

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

  if (!name || (category !== "drink" && category !== "bite")) {
    console.error("[Dashboard] Missing name or invalid category for bar-bites item");
    return;
  }

  const price = normalizePriceInput(priceRaw);
  const sort_order = safeNum(sortOrderRaw, 0);

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

  if (error) console.error("[Dashboard] Failed to create bar_bites_item:", error);

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

  if (!id || !name || (category !== "drink" && category !== "bite")) {
    console.error("[Dashboard] Missing id, name, or invalid category for update");
    return;
  }

  const price = normalizePriceInput(priceRaw);
  const sort_order = safeNum(sortOrderRaw, 0);

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

  if (error) console.error("[Dashboard] Failed to update bar_bites_item:", error);

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

  if (votesError) console.error("[Dashboard] Failed to delete bar_bites_votes:", votesError);

  const { error: itemError } = await supabaseServer
    .from("bar_bites_items")
    .delete()
    .eq("id", id);

  if (itemError) console.error("[Dashboard] Failed to delete bar_bites_item:", itemError);

  revalidatePath("/menu/bar-bites");
}

export async function toggleActiveItem(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;
  const value = formData.get("value") as string;

  if (!id) return;

  const isActive = value === "true";

  const { error } = await supabaseServer
    .from("bar_bites_items")
    .update({ is_active: !isActive })
    .eq("id", id);

  if (error) console.error("[Dashboard] Failed to toggle is_active:", error);

  revalidatePath("/menu/bar-bites");
}

export async function toggleFeaturedItem(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;
  const value = formData.get("value") as string;

  if (!id) return;

  const isFeatured = value === "true";

  const { error } = await supabaseServer
    .from("bar_bites_items")
    .update({ is_featured: !isFeatured })
    .eq("id", id);

  if (error) console.error("[Dashboard] Failed to toggle is_featured:", error);

  revalidatePath("/menu/bar-bites");
}

export async function bumpItemOrder(formData: FormData) {
  "use server";

  const id = (formData.get("id") as string) || "";
  const direction = (formData.get("direction") as string) || "";
  const category = (formData.get("category") as string) as "drink" | "bite";

  if (!id || (direction !== "up" && direction !== "down")) return;
  if (category !== "drink" && category !== "bite") return;

  // IMPORTANT: forms cannot be nested. This action swaps sort_order with neighbor.
  const supabase = supabaseServer;

  const { data: all, error } = await supabase
    .from("bar_bites_items")
    .select("id, sort_order, created_at, category, is_featured")
    .eq("category", category)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !all) {
    console.error("[Dashboard] bumpItemOrder load error:", error);
    revalidatePath("/menu/bar-bites");
    return;
  }

  const list = (all as Array<{
    id: string;
    sort_order: number;
    created_at: string;
    category: "drink" | "bite";
    is_featured: boolean;
  }>).map((r) => ({
    ...r,
    sort_order: safeNum(r.sort_order, 0),
  }));

  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return;

  const a = list[idx];
  const b = list[swapIdx];

  // Swap sort_order. If equal, create a stable nudge.
  let aOrder = safeNum(a.sort_order, 0);
  let bOrder = safeNum(b.sort_order, 0);

  if (aOrder === bOrder) {
    // create space
    aOrder = aOrder + (direction === "up" ? -1 : 1);
  }

  const { error: errA } = await supabase
    .from("bar_bites_items")
    .update({ sort_order: bOrder })
    .eq("id", a.id);

  const { error: errB } = await supabase
    .from("bar_bites_items")
    .update({ sort_order: aOrder })
    .eq("id", b.id);

  if (errA || errB) {
    console.error("[Dashboard] bumpItemOrder swap error:", errA || errB);
  }

  revalidatePath("/menu/bar-bites");
}

/* ------------------------------------------------------------------ */
/*  UI COMPONENTS                                                      */
/* ------------------------------------------------------------------ */

function ItemCard({
  item,
  canMoveUp,
  canMoveDown,
}: {
  item: MenuItem;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const createdLabel = formatCreatedLabel(item.created_at);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      {/* Top row: title + chips + vote count */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {item.name}
            </h3>
            {item.is_featured && (
              <span className="inline-flex items-center rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-semibold text-slate-900">
                Featured
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                item.is_active
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-700"
              )}
            >
              {item.is_active ? "Active" : "Hidden"}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {item.category === "drink" ? "Drink" : "Bite"} · Added {createdLabel}
          </p>
        </div>

        <div className="text-xs text-right text-slate-500">
          <div>
            Votes:{" "}
            <span className="font-semibold text-slate-800">
              {item.votes_count ?? 0}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            Sort: {item.sort_order ?? 0}
          </div>

          {/* Quick reorder buttons (server action swap) */}
          <div className="mt-2 flex items-center justify-end gap-2">
            <form action={bumpItemOrder}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="direction" value="up" />
              <input type="hidden" name="category" value={item.category} />
              <button
                type="submit"
                disabled={!canMoveUp}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="Move up"
              >
                ↑
              </button>
            </form>

            <form action={bumpItemOrder}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="direction" value="down" />
              <input type="hidden" name="category" value={item.category} />
              <button
                type="submit"
                disabled={!canMoveDown}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="Move down"
              >
                ↓
              </button>
            </form>
          </div>
        </div>
      </div>

      {item.description && (
        <p className="mt-3 text-sm text-slate-700">{item.description}</p>
      )}

      <div className="mt-4 border-t border-slate-200 pt-4">
        {/* MAIN EDIT FORM (Save changes) */}
        <form
          action={updateMenuItem}
          className="grid gap-3 text-xs md:grid-cols-2"
        >
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
            <p className="text-[11px] text-slate-400">Accepts 12, 12.00, $12, $12.00</p>
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
            <p className="text-[11px] text-slate-400">
              Tip: use arrows above for quick reordering.
            </p>
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
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium",
                  item.is_active
                    ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    : "border-slate-900 bg-slate-900 text-slate-50 hover:bg-black"
                )}
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

  const drinksAll = items.filter((i) => i.category === "drink");
  const bitesAll = items.filter((i) => i.category === "bite");

  const activeCount = items.filter((i) => i.is_active).length;
  const featuredCount = items.filter((i) => i.is_featured).length;

  const totalVotes = items.reduce((acc, i) => acc + (i.votes_count ?? 0), 0);
  const topVoted = [...items].sort(
    (a, b) => (b.votes_count ?? 0) - (a.votes_count ?? 0)
  )[0];

  // For reordering, we need stable lists matching bumpItemOrder ordering
  const sortForReorder = (list: MenuItem[]) =>
    [...list].sort(
      (a, b) =>
        Number(b.is_featured) - Number(a.is_featured) ||
        safeNum(a.sort_order, 0) - safeNum(b.sort_order, 0) ||
        a.created_at.localeCompare(b.created_at)
    );

  const drinks = sortForReorder(drinksAll);
  const bites = sortForReorder(bitesAll);

  return (
    <DashboardShell
      title="Bar & Bites"
      subtitle="Control what guests see in the Bar & Bites menu in the app."
      activeTab="bar-bites"
    >
      <div className="space-y-6">
        {/* Summary */}
        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Active items"
            helper="Currently visible in the app."
            value={activeCount}
          />
          <SummaryCard
            label="Featured items"
            helper="Pinned to the top within category."
            value={featuredCount}
          />
          <SummaryCard
            label="Total votes"
            helper="All votes across items."
            value={totalVotes}
          />
          <SummaryCard
            label="Top voted"
            helper={topVoted ? topVoted.name : "No votes yet"}
            value={topVoted ? (topVoted.votes_count ?? 0) : "—"}
          />
        </section>

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
              <span>{activeCount} active items</span>
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
                  Edit copy, prices, tags, or visibility. Use arrows on each
                  card to reorder within a category.
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
                      {drinks.map((item, idx) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          canMoveUp={idx > 0}
                          canMoveDown={idx < drinks.length - 1}
                        />
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
                      {bites.map((item, idx) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          canMoveUp={idx > 0}
                          canMoveDown={idx < bites.length - 1}
                        />
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
                  reorder later using arrows or sort_order.
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
                      <p className="text-[11px] text-slate-400">
                        Accepts 12, 12.00, $12, $12.00
                      </p>
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

            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-900">How ordering works</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>
                  Items are grouped by <span className="font-semibold">category</span> (Drink / Bite).
                </li>
                <li>
                  Within each category: <span className="font-semibold">Featured</span> items are shown first.
                </li>
                <li>
                  Then items sort by <span className="font-semibold">sort_order</span> ascending.
                </li>
                <li>Use the ↑ / ↓ buttons on each card for quick swaps.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
