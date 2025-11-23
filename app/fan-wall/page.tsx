import Image from "next/image";
import { revalidatePath } from "next/cache";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type FanWallPost = {
  id: string;
  user_id: string | null;
  image_path: string;
  caption: string | null;
  created_at: string;
  is_approved: boolean;
  is_hidden: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const FAN_WALL_BUCKET =
  process.env.NEXT_PUBLIC_FAN_WALL_BUCKET ?? "fan-wall-photos";

function getPublicFanWallUrl(imagePath: string | null): string | null {
  if (!SUPABASE_URL || !imagePath) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${FAN_WALL_BUCKET}/${imagePath}`;
}

/* ------------------------------------------------------------------ */
/*  SERVER ACTIONS: APPROVE / HIDE                                    */
/* ------------------------------------------------------------------ */

async function approvePost(id: string) {
  "use server";

  await supabaseServer
    .from("fan_wall_posts")
    .update({
      is_approved: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by: "dashboard",
    })
    .eq("id", id);

  // Refresh fan wall + dashboard preview
  revalidatePath("/fan-wall");
  revalidatePath("/dashboard");
}

async function hidePost(id: string) {
  "use server";

  await supabaseServer
    .from("fan_wall_posts")
    .update({
      is_hidden: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by: "dashboard",
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
      "id, user_id, image_path, caption, created_at, is_approved, is_hidden, reviewed_at, reviewed_by"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[FanWall] Failed to load posts:", error);
  }

  const allPosts = ((data ?? []) as FanWallPost[]).filter(
    (p) => !p.is_hidden
  );

  const pending = allPosts.filter((p) => !p.is_approved);
  const approved = allPosts.filter((p) => p.is_approved);

  const rows = [...pending, ...approved];

  return (
    <DashboardShell
      title="Fan Wall"
      subtitle="Review and approve Photo Booth shots before they appear in the app."
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              Fan Wall moderation
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Approve Photo Booth shots before they show to guests.
            </p>
          </div>
        </div>

        {/* Empty state */}
        {rows.length === 0 && (
          <div className="px-5 py-10 text-center text-xs text-slate-400">
            No fan photos yet. Once guests start posting from the Photo Booth,
            they&apos;ll appear here for approval.
          </div>
        )}

        {/* Table */}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              {/* Header row */}
              <div className="grid grid-cols-[120px,1fr,120px,140px] gap-4 px-5 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em] border-b border-slate-100 bg-slate-50/60">
                <div>Photo</div>
                <div>User</div>
                <div>Status</div>
                <div>Created</div>
              </div>

              {/* Data rows */}
              <div className="divide-y divide-slate-100">
                {rows.map((post) => {
                  const imageUrl = getPublicFanWallUrl(post.image_path);
                  const isPending = !post.is_approved;

                  return (
                    <div
                      key={post.id}
                      className="grid grid-cols-[120px,1fr,120px,140px] gap-4 px-5 py-3 items-center text-xs"
                    >
                      {/* Thumb */}
                      <div className="flex items-center">
                        {imageUrl ? (
                          <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
                            <Image
                              src={imageUrl}
                              alt={post.caption ?? "Fan Wall photo"}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400">
                            No image
                          </div>
                        )}
                      </div>

                      {/* User / caption */}
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-medium text-slate-900 truncate">
                          {post.caption || "Sugarshack Downtown Photo Booth"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {post.user_id ? "Known user" : "Unknown user"}
                        </p>
                      </div>

                      {/* Status + actions */}
                      <div className="flex flex-col gap-2">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-medium ${
                            isPending
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isPending ? "Pending" : "Approved"}
                        </span>

                        <div className="flex gap-2">
                          {isPending && (
                            <form action={approvePost.bind(null, post.id)}>
                              <button
                                type="submit"
                                className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-semibold shadow-sm hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                            </form>
                          )}

                          <form action={hidePost.bind(null, post.id)}>
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center px-2.5 py-1 rounded-full border border-rose-300 text-rose-700 text-[11px] font-semibold hover:bg-rose-50"
                            >
                              Hide
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* Created at */}
                      <div className="text-[11px] text-slate-500">
                        {new Date(post.created_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "2-digit",
                            day: "2-digit",
                            year: "numeric",
                          }
                        )}
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
