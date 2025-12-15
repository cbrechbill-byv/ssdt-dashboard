// app/fan-wall/page.tsx
// Path: /fan-wall
// Sugarshack Downtown - Fan Wall Moderation
// Upgraded: summary + queues (Pending / Approved / Hidden) + safer moderation (hide vs delete) + better previews.

import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 0; // always fetch fresh data for fan wall

type FanWallPost = {
  id: string;
  user_id: string | null;
  image_path: string | null;
  caption: string | null;
  created_at: string;
  is_approved: boolean;
  is_hidden: boolean;
};

const FAN_WALL_BUCKET =
  process.env.NEXT_PUBLIC_FAN_WALL_BUCKET || "fan-wall-photos";

/* ------------------------------------------------------------------ */
/*  HELPERS                                                           */
/* ------------------------------------------------------------------ */

function formatDateEST(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function chipClass(tone: "neutral" | "good" | "warn" | "bad") {
  if (tone === "good") return "bg-emerald-100 text-emerald-800";
  if (tone === "warn") return "bg-amber-100 text-amber-800";
  if (tone === "bad") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function SummaryCard({
  label,
  helper,
  value,
  tone = "neutral",
}: {
  label: string;
  helper: string;
  value: string | number;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const ring =
    tone === "good"
      ? "border-emerald-200"
      : tone === "warn"
      ? "border-amber-200"
      : tone === "bad"
      ? "border-rose-200"
      : "border-slate-200";

  return (
    <div className={cn("rounded-3xl border bg-white px-6 py-4 shadow-sm", ring)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SERVER ACTIONS                                                    */
/* ------------------------------------------------------------------ */

async function approvePost(formData: FormData) {
  "use server";

  const id = formData.get("id");
  if (!id || typeof id !== "string") {
    console.error("[FanWall] approvePost: missing or invalid id");
    return;
  }

  const supabase = supabaseServer;

  const { error } = await supabase
    .from("fan_wall_posts")
    .update({
      is_approved: true,
      is_hidden: false,
    })
    .eq("id", id);

  if (error) console.error("[FanWall] approvePost error:", error);

  revalidatePath("/fan-wall");
  revalidatePath("/dashboard");
}

async function hidePost(formData: FormData) {
  "use server";

  const id = formData.get("id");
  if (!id || typeof id !== "string") {
    console.error("[FanWall] hidePost: missing or invalid id");
    return;
  }

  const supabase = supabaseServer;

  const { error } = await supabase
    .from("fan_wall_posts")
    .update({
      is_hidden: true,
      is_approved: false,
    })
    .eq("id", id);

  if (error) console.error("[FanWall] hidePost error:", error);

  revalidatePath("/fan-wall");
  revalidatePath("/dashboard");
}

async function unhidePost(formData: FormData) {
  "use server";

  const id = formData.get("id");
  if (!id || typeof id !== "string") {
    console.error("[FanWall] unhidePost: missing or invalid id");
    return;
  }

  const supabase = supabaseServer;

  // unhide = visible again, but keep it pending unless explicitly approved
  const { error } = await supabase
    .from("fan_wall_posts")
    .update({
      is_hidden: false,
      is_approved: false,
    })
    .eq("id", id);

  if (error) console.error("[FanWall] unhidePost error:", error);

  revalidatePath("/fan-wall");
  revalidatePath("/dashboard");
}

async function deletePost(formData: FormData) {
  "use server";

  const id = formData.get("id");
  const image_path = formData.get("image_path");

  if (!id || typeof id !== "string") {
    console.error("[FanWall] deletePost: missing or invalid id");
    return;
  }

  const supabase = supabaseServer;

  // Delete DB row first
  const { error } = await supabase.from("fan_wall_posts").delete().eq("id", id);
  if (error) console.error("[FanWall] deletePost error:", error);

  // Best-effort delete from storage too (optional but helpful)
  if (image_path && typeof image_path === "string" && image_path.trim()) {
    const { error: storageErr } = await supabase.storage
      .from(FAN_WALL_BUCKET)
      .remove([image_path.trim()]);
    if (storageErr) {
      // Not fatal; row is already deleted
      console.error("[FanWall] storage remove error:", storageErr);
    }
  }

  revalidatePath("/fan-wall");
  revalidatePath("/dashboard");
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                              */
/* ------------------------------------------------------------------ */

export default async function FanWallPage() {
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("fan_wall_posts")
    .select("id, user_id, image_path, caption, created_at, is_approved, is_hidden")
    .order("created_at", { ascending: false });

  if (error) console.error("[FanWall] load error:", error);

  const all: FanWallPost[] = (data ?? []) as FanWallPost[];

  // Queues
  const pending = all.filter((p) => !p.is_hidden && !p.is_approved);
  const approved = all.filter((p) => !p.is_hidden && p.is_approved);
  const hidden = all.filter((p) => p.is_hidden);

  // Attach public URLs (for display)
  const withUrls = (posts: FanWallPost[]) =>
    posts.map((post) => {
      const path = post.image_path ?? "";
      if (!path) return { ...post, imageUrl: null as string | null };

      const { data: publicData } = supabase.storage
        .from(FAN_WALL_BUCKET)
        .getPublicUrl(path);

      return { ...post, imageUrl: publicData?.publicUrl ?? null };
    });

  const pendingWithUrls = withUrls(pending);
  const approvedWithUrls = withUrls(approved);
  const hiddenWithUrls = withUrls(hidden);

  const total = all.length;
  const last24h = (() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return all.filter((p) => new Date(p.created_at).getTime() >= cutoff).length;
  })();

  return (
    <DashboardShell
      title="Fan Wall"
      subtitle="Approve Photo Booth shots before they appear in the app."
      activeTab="fan-wall"
    >
      <div className="space-y-6">
        {/* Summary */}
        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Pending"
            helper="Visible to staff only until approved."
            value={pending.length}
            tone={pending.length > 0 ? "warn" : "neutral"}
          />
          <SummaryCard
            label="Approved"
            helper="Currently eligible to appear in the app."
            value={approved.length}
            tone="good"
          />
          <SummaryCard
            label="Hidden"
            helper="Removed from review queues (can restore)."
            value={hidden.length}
            tone={hidden.length > 0 ? "bad" : "neutral"}
          />
          <SummaryCard
            label="New (24h)"
            helper="Recent submissions in the last 24 hours."
            value={last24h}
            tone={last24h > 0 ? "warn" : "neutral"}
          />
        </section>

        {/* Pending */}
        <ModerationSection
          title="Pending approval"
          subtitle="These will NOT show in the app until you approve them."
          tone="warn"
          emptyText="No pending posts right now. You're caught up."
          posts={pendingWithUrls}
          showApprove
          showHide
          showDelete
        />

        {/* Approved */}
        <ModerationSection
          title="Approved"
          subtitle="These are approved and visible (unless hidden later)."
          tone="good"
          emptyText="No approved posts yet."
          posts={approvedWithUrls}
          showApprove={false}
          showHide
          showDelete
        />

        {/* Hidden */}
        <ModerationSection
          title="Hidden"
          subtitle="Hidden posts are removed from the app and queues. You can restore to Pending."
          tone="bad"
          emptyText="No hidden posts."
          posts={hiddenWithUrls}
          showApprove={false}
          showHide={false}
          showDelete
          showUnhide
        />

        {/* Footer note */}
        <div className="text-[11px] text-slate-500">
          Total posts in system: <span className="font-semibold">{total}</span>
        </div>
      </div>
    </DashboardShell>
  );
}

/* ------------------------------------------------------------------ */
/*  SECTION UI                                                        */
/* ------------------------------------------------------------------ */

function ModerationSection({
  title,
  subtitle,
  tone,
  emptyText,
  posts,
  showApprove,
  showHide,
  showDelete,
  showUnhide,
}: {
  title: string;
  subtitle: string;
  tone: "neutral" | "good" | "warn" | "bad";
  emptyText: string;
  posts: Array<FanWallPost & { imageUrl: string | null }>;
  showApprove?: boolean;
  showHide?: boolean;
  showDelete?: boolean;
  showUnhide?: boolean;
}) {
  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              {title}
            </p>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide text-[10px]",
                chipClass(tone)
              )}
            >
              {posts.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {posts.length === 0 ? (
          <div className="px-6 py-10 text-center text-xs text-slate-400">
            {emptyText}
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="px-6 py-4 flex flex-col lg:flex-row gap-4 lg:items-center"
            >
              {/* Image */}
              <div className="flex-shrink-0">
                {post.imageUrl ? (
                  <a
                    href={post.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="relative block w-36 h-36 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50"
                    title="Open full image"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.imageUrl}
                      alt={post.caption ?? "Fan photo"}
                      className="h-full w-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="w-36 h-36 rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[11px] text-slate-400">
                    No image
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-1">
                  <p className="text-[13px] font-semibold text-slate-900 truncate">
                    {post.caption?.trim() ? post.caption.trim() : "Untitled Fan Wall post"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Created {formatDateEST(post.created_at)}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {post.user_id ? `Linked to rewards user: ${post.user_id}` : "Guest submission"}
                  </p>

                  <div className="mt-1 flex flex-wrap gap-2">
                    {!post.is_hidden && post.is_approved ? (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", chipClass("good"))}>
                        Approved
                      </span>
                    ) : null}
                    {!post.is_hidden && !post.is_approved ? (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", chipClass("warn"))}>
                        Pending
                      </span>
                    ) : null}
                    {post.is_hidden ? (
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", chipClass("bad"))}>
                        Hidden
                      </span>
                    ) : null}
                    {post.image_path ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        Has image
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        No image
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {showApprove && !post.is_approved && !post.is_hidden && (
                  <form action={approvePost}>
                    <input type="hidden" name="id" value={post.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold px-3 py-1.5 shadow-sm"
                    >
                      Approve
                    </button>
                  </form>
                )}

                {showHide && !post.is_hidden && (
                  <form action={hidePost}>
                    <input type="hidden" name="id" value={post.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 px-3 py-1.5"
                    >
                      Hide
                    </button>
                  </form>
                )}

                {showUnhide && post.is_hidden && (
                  <form action={unhidePost}>
                    <input type="hidden" name="id" value={post.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 px-3 py-1.5"
                    >
                      Restore to Pending
                    </button>
                  </form>
                )}

                {showDelete && (
                  <form action={deletePost}>
                    <input type="hidden" name="id" value={post.id} />
                    <input
                      type="hidden"
                      name="image_path"
                      value={post.image_path ?? ""}
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[11px] font-semibold text-rose-700 px-3 py-1.5"
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
