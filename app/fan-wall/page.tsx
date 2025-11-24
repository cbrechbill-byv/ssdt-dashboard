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

const FAN_WALL_BUCKET =
  process.env.NEXT_PUBLIC_FAN_WALL_BUCKET ?? "fan-wall-photos";

/** Build a public URL using Supabase storage helper so bucket/path are always correct */
function getPublicFanWallUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;

  try {
    const { data } = supabaseServer.storage
      .from(FAN_WALL_BUCKET)
      .getPublicUrl(imagePath);

    return data?.publicUrl ?? null;
  } catch (err) {
    console.error("[FanWall] getPublicUrl error:", err);
    return null;
  }
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
        </div>

        {/* List view */}
        <div className="divide-y divide-slate-100">
          {posts.length === 0 ? (
            <div className="px-6 py-10 text-center text-xs text-slate-400">
              No fan photos yet. Once guests start posting from the Photo Booth,
              they&apos;ll appear here for approval.
            </div>
          ) : (
            posts.map((post) => {
              const imageUrl = getPublicFanWallUrl(post.image_path);

              return (
                <div
                  key={post.id}
                  className="px-6 py-4 flex flex-col sm:flex-row gap-4 sm:items-center"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    {imageUrl ? (
                      <button
                        type="button"
                        className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50"
                        onClick={() => {
                          window.open(imageUrl, "_blank");
                        }}
                      >
                        <Image
                          src={imageUrl}
                          alt={post.caption ?? "Fan photo"}
                          fill
                          className="object-cover"
                        />
                      </button>
                    ) : (
                      <div className="w-32 h-32 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[11px] text-slate-400">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">
                          {post.caption || "Untitled Fan Wall post"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Created{" "}
                          {new Date(post.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {post.user_id
                            ? `Linked to rewards user: ${post.user_id}`
                            : "Guest submission"}
                        </p>
                      </div>

                      <div className="flex gap-2 sm:ml-4">
                        {!post.is_approved && (
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
                        <form action={hidePost}>
                          <input type="hidden" name="id" value={post.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 px-3 py-1.5"
                          >
                            Hide
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
