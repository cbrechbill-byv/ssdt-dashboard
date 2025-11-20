"use client";

import React, { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabaseClient";

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

export const FanWallModeration: React.FC = () => {
  const [posts, setPosts] = useState<FanWallPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Create a Supabase client for this component
  const supabase = React.useMemo(() => createBrowserSupabaseClient(), []);

  const fetchPosts = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("fan_wall_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error loading fan wall posts:", error);
      setLoading(false);
      return;
    }

    setPosts(data as FanWallPost[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePost = async (id: string, values: Partial<FanWallPost>) => {
    setUpdatingId(id);

    const { error } = await supabase
      .from("fan_wall_posts")
      .update(values)
      .eq("id", id);

    if (error) {
      console.error("Error updating fan wall post:", error);
    } else {
      await fetchPosts();
    }

    setUpdatingId(null);
  };

  const approve = (post: FanWallPost) =>
    updatePost(post.id, {
      is_approved: true,
      is_hidden: false,
      reviewed_at: new Date().toISOString(),
      reviewed_by: "dashboard",
    });

  const hide = (post: FanWallPost) =>
    updatePost(post.id, {
      is_hidden: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by: "dashboard",
    });

  const show = (post: FanWallPost) =>
    updatePost(post.id, {
      is_hidden: false,
    });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-50">
            Fan Wall moderation
          </h1>
          <p className="text-xs text-slate-400">
            Review and approve Photo Booth shots before they appear in the app.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchPosts}
          className="inline-flex items-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-emerald-400 hover:text-emerald-300 transition"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="border border-dashed border-slate-700 rounded-xl p-10 text-center text-slate-400">
          No fan photos yet. Once guests start posting from the Photo Booth,
          they&apos;ll appear here for approval.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80 border-b border-slate-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Photo
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  User
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Created
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const created = new Date(post.created_at);
                const isUpdating = updatingId === post.id;

                const fileName = post.image_path.split("/").pop();

                return (
                  <tr key={post.id} className="border-t border-slate-800/80">
                    <td className="px-3 py-2 align-middle">
                      <div className="h-16 w-12 rounded-md overflow-hidden bg-slate-800 relative">
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">
                          {fileName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-200">
                      <div className="text-xs font-medium">
                        {post.user_id ?? "Unknown user"}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      {post.is_hidden ? (
                        <span className="inline-flex rounded-full bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300 border border-slate-500/40">
                          Hidden
                        </span>
                      ) : post.is_approved ? (
                        <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300 border border-emerald-500/40">
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300 border border-amber-500/30">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle text-xs text-slate-400">
                      {created.toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 align-middle text-right">
                      <div className="inline-flex items-center gap-2">
                        {!post.is_approved && !post.is_hidden && (
                          <button
                            onClick={() => approve(post)}
                            disabled={isUpdating}
                            className="rounded-md bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 text-xs font-semibold px-2.5 py-1 disabled:opacity-60"
                          >
                            Approve
                          </button>
                        )}

                        {post.is_hidden ? (
                          <button
                            onClick={() => show(post)}
                            disabled={isUpdating}
                            className="rounded-md border border-slate-500 text-slate-200 text-xs px-2.5 py-1 hover:border-emerald-400 hover:text-emerald-200 disabled:opacity-60"
                          >
                            Unhide
                          </button>
                        ) : (
                          <button
                            onClick={() => hide(post)}
                            disabled={isUpdating}
                            className="rounded-md border border-rose-500/60 text-rose-300 text-xs px-2.5 py-1 hover:bg-rose-500/10 disabled:opacity-60"
                          >
                            Hide
                          </button>
                        )}
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
  );
};
