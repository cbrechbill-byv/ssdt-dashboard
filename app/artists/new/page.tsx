"use client";


import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

async function createArtist(formData: FormData) {
  "use server";

  const supabase = supabaseServer;

  const name = (formData.get("name") as string)?.trim();
  const genre = (formData.get("genre") as string)?.trim() || null;
  const bio = (formData.get("bio") as string)?.trim() || null;
  const website_url =
    (formData.get("website_url") as string)?.trim() || null;
  const instagram_url =
    (formData.get("instagram_url") as string)?.trim() || null;
  const is_active = formData.get("is_active") === "on";

  if (!name) {
    // In a later phase we can surface validation errors in the UI
    return;
  }

  const { error } = await supabase.from("artists").insert({
    name,
    genre,
    bio,
    website_url,
    instagram_url,
    is_active,
  });

  if (error) {
    console.error("[Artists] create error:", error);
    return;
  }

  // Go back to the Artists list
  redirect("/artists");
}

export default function NewArtistPage() {
  return (
    <DashboardShell
      title="Add artist"
      subtitle="Create a new artist profile for Sugarshack Downtown."
      activeTab="artists"
    >
      <form action={createArtist} className="space-y-6 max-w-2xl">
        {/* Basics */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">Basics</h2>
            <p className="mt-1 text-xs text-slate-400">
              Name and genre appear on the Tonight screen and Calendar in the app.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="name"
                className="text-xs font-medium text-slate-200"
              >
                Artist name
              </label>
              <input
                id="name"
                name="name"
                required
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="genre"
                className="text-xs font-medium text-slate-200"
              >
                Genre
              </label>
              <input
                id="genre"
                name="genre"
                placeholder="Reggae, Americana, Folk, etc."
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="is_active"
                name="is_active"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-400"
              />
              <label
                htmlFor="is_active"
                className="text-xs text-slate-200 select-none"
              >
                Show this artist in the app
              </label>
            </div>
          </div>
        </section>

        {/* Bio */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">Bio</h2>
            <p className="mt-1 text-xs text-slate-400">
              Short description that appears on the Artist profile in the app.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="bio"
              className="text-xs font-medium text-slate-200"
            >
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={4}
              className="resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400"
            />
          </div>
        </section>

        {/* Links */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">Links</h2>
            <p className="mt-1 text-xs text-slate-400">
              These can later be surfaced on the Artist profile page.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="website_url"
                className="text-xs font-medium text-slate-200"
              >
                Website
              </label>
              <input
                id="website_url"
                name="website_url"
                placeholder="https://example.com"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="instagram_url"
                className="text-xs font-medium text-slate-200"
              >
                Instagram
              </label>
              <input
                id="instagram_url"
                name="instagram_url"
                placeholder="https://instagram.com/artist"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              history.back();
            }}
            className="inline-flex items-center rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-[#ffc800] px-4 py-2 text-xs font-semibold text-black shadow hover:bg-[#e6b400]"
          >
            Create artist
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
