// app/fan-wall/page.tsx

import Image from "next/image";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type FanWallPost = {
  id: string;
  image_path: string | null;
  caption: string | null;
  is_approved: boolean;
  is_hidden: boolean;
  created_at: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const FAN_WALL_BUCKET =
  process.env.NEXT_PUBLIC_FAN_WALL_BUCKET || "fan-wall-photos";

function getPublicImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;

  const trimmed = imagePath.replace(/^\/+/, "");
  return `${SUPABASE_URL}/storage/v1/object/public/${FAN_WALL_BUCKET}/${trimmed}`;
}

// ---------- SERVER ACTIONS ----------

export async function approvePost(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = createSupabaseServerClient();

  await supabase
    .from("fan_wall_posts")
    .update({ is_approved: true, is_hidden: false })
    .eq("id", id);

  // Refresh this page + main dashboard preview
  revalidatePath("/fan-wall");
  revalidatePath("/dashboard");
}

export async function hidePost(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = createSupabaseServerClient();

  await supabase
    .from("fan_wall_posts")
    .update({ is_hidden: true, is_approved: false })
    .eq("id", id);

  revalidatePath("/fan-wall");
  revalidatePath("/dashboard");
}

// ---------- PAGE COMPONENT ----------

async function getFanWallPosts(): Promise<FanWallPost[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("fan_wall_posts")
    .select("id, image_path, caption, is_approved, is_hidden, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading fan wall posts:", error);
    return [];
  }

  return (data ?? []) as FanWallPost[];
}

export default async function FanWallPage() {
  const posts = await getFanWallPosts();

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-slate-900 text-slate-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">
              Sugarshack Downtown Fan Wall
            </h1>
            <p className="text-xs text-slate-300">
              Review and approve Photo Booth shots before they appear in the app.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              // client-side reload
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="rounded-full border border-slate-500 px-4 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="mx-auto mt-8 max-w-6xl px-6">
        <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-800">
            Fan Wall moderation
          </h2>
          <p className="mb-4 text-xs text-amber-900">
            Approve shots you love. Hidden photos will not appear in the app.
          </p>

          {posts.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center text-sm text-slate-500">
              No fan photos yet. Once guests start posting from the Photo Booth,
              they&apos;ll appear here for approval.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/90">
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)] items-center border-b border-slate-800 bg-slate-900 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-200">
                <span>Photo</span>
                <span>User</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>

              {posts.map((post) => {
                const imageUrl = getPublicImageUrl(post.image_path);
                const createdDate = new Date(post.created_at);

                const statusLabel = post.is_hidden
                  ? "Hidden"
                  : post.is_approved
                  ? "Approved"
                  : "Pending";

                const statusColor =
                  post.is_hidden
                    ? "bg-slate-500/20 text-slate-200 border border-slate-400/40"
                    : post.is_approved
                    ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                    : "bg-amber-500/20 text-amber-200 border border-amber-400/40";

                return (
                  <div
                    key={post.id}
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)] items-center border-t border-slate-800 bg-slate-800/70 px-4 py-3 text-sm text-slate-100"
                  >
                    {/* PHOTO THUMBNAIL */}
                    <div className="flex items-center gap-3 py-1">
                      <div className="relative h-16 w-12 overflow-hidden rounded-xl bg-slate-900/80">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={post.caption ?? "Fan wall photo"}
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
                      <div className="flex flex-col">
                        <span className="line-clamp-1 text-xs font-medium text-slate-50">
                          {post.caption || "Untitled photo"}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {createdDate.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* USER (for now, we don't have user IDs mapped) */}
                    <div className="text-xs text-slate-300">Unknown user</div>

                    {/* STATUS */}
                    <div className="flex items-center">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${statusColor}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex items-center justify-end gap-2">
                      {!post.is_approved && !post.is_hidden && (
                        <form action={approvePost}>
                          <input type="hidden" name="id" value={post.id} />
                          <button
                            type="submit"
                            className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
                          >
                            Approve
                          </button>
                        </form>
                      )}

                      {!post.is_hidden && (
                        <form action={hidePost}>
                          <input type="hidden" name="id" value={post.id} />
                          <button
                            type="submit"
                            className="rounded-full border border-rose-400/80 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"
                          >
                            Hide
                          </button>
                        </form>
                      )}

                      {post.is_hidden && !post.is_approved && (
                        <span className="text-[11px] text-slate-400">
                          Hidden from app
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
