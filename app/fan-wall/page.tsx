import Image from "next/image";
import { revalidatePath } from "next/cache";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type FanWallPost = {
  id: string;
  user_id: string | null;
  image_path: string | null;
  caption: string | null;
  created_at: string;
  is_approved: boolean;
  is_hidden: boolean;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const FAN_WALL_BUCKET =
  process.env.NEXT_PUBLIC_FAN_WALL_BUCKET ?? "fan-wall-photos";

function getPublicFanWallUrl(imagePath: string | null): string | null {
  if (!SUPABASE_URL || !imagePath) return null;
  const trimmed = imagePath.replace(/^\/+/, "");
  return `${SUPABASE_URL}/storage/v1/object/public/${FAN_WALL_BUCKET}/${trimmed}`;
}

/* ------------------------------------------------------------------ */
/*  SERVER ACTIONS                                                     */
/* ------------------------------------------------------------------ */

async function approvePost(id: string) {
  "use server";

  await supabaseServer
    .from("fan_wall_posts")
    .update({
      is_approved: true,
      is_hidden: false,
    })
    .eq("id", id);

  revalidatePath("/fan-wall");
  revalidatePath("/dashboard");
}

async function hidePost(id: string) {
  "use server";

  await supabaseServer
    .from("fan_wall_posts")
    .update({
      is_hidden: true,
      is_approved: false,
    })
    .eq("id", id);

  revalidatePath("/fan-wall");
  revalidatePath("/dashboard");
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default async function FanWallPage() {
  const { data, error } = await supabaseServer
    .from("fan_wall_posts")
    .select(
      "id, user_id, image_path, caption, created_at, is_approved, is_hidden"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[FanWall] load error:", error);
  }

  const posts = ((data ?? []) as FanWallPost[]).filter(
    (p) => !p.is_hidden
  );

  return (
    <DashboardShell
      title="Fan Wall"
      subtitle="Review and approve Photo Booth shots before they appear in the app."
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-slate-100">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              Fan Wall moderation
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Approve Photo Booth shots before they show to guests.
            </p>
          </div>
          {/* use simple link instead of onClick button to avoid Server Component event handler */}
          <a
            href="/fan-wall"
            className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Refresh
          </a>
        </div>

        {/* Empty state */}
        {posts.length === 0 && (
          <div className="px-6 py-10 text-center text-xs text-slate-400">
            No fan photos yet. Once guests start posting from the Photo Booth,
            they&apos;ll appear here for approval.
          </div>
        )}

        {/* Table */}
        {posts.length > 0 && (
          <div className="overflow-x-auto">
            <div className="min-w-[880px]">
              {/* Column headers */}
              <div className="grid grid-cols-[150px,1.5fr,130px,160px,160px] gap-4 px-6 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em] bg-slate-50 border-b border-slate-100">
                <div>Photo</div>
                <div>User</div>
                <div>Status</div>
                <div>Created</div>
                <div className="text-right">Actions</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-100">
                {posts.map((post) => {
                  const imageUrl = getPublicFanWallUrl(post.image_path);
                  const isPending = !post.is_approved;

                  const createdLabel = new Date(
                    post.created_at
                  ).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={post.id}
                      className="grid grid-cols-[150px,1.5fr,130px,160px,160px] gap-4 px-6 py-3 items-center text-xs"
                    >
                      {/* PHOTO */}
                      <div className="flex items-center gap-3">
                        <div className="relative h-20 w-16 overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={post.caption ?? "Fan Wall photo"}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                              No image
                            </div>
                          )}
                        </div>
                        {imageUrl && (
                          <a
                            href={imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-medium text-sky-600 hover:text-sky-500"
                          >
                            View full
                          </a>
                        )}
                      </div>

                      {/* USER (identity wiring comes next step) */}
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-medium text-slate-900 truncate">
                          {post.caption || "Sugarshack Downtown Photo Booth"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {post.user_id
                            ? "Known user (VIP/guest mapping coming next)"
                            : "Unknown user"}
                        </p>
                      </div>

                      {/* STATUS */}
                      <div>
                        <span
                          className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-medium ${
                            isPending
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isPending ? "Pending" : "Approved"}
                        </span>
                      </div>

                      {/* CREATED */}
                      <div className="text-[11px] text-slate-600">
                        {createdLabel}
                      </div>

                      {/* ACTIONS */}
                      <div className="flex items-center justify-end gap-2">
                        {isPending && (
                          <form action={approvePost.bind(null, post.id)}>
                            <button
                              type="submit"
                              className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                          </form>
                        )}
                        <form action={hidePost.bind(null, post.id)}>
                          <button
                            type="submit"
                            className="rounded-full border border-rose-300 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            Hide
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
