import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

async function createArtist(formData: FormData) {
  "use server";

  const name = formData.get("name")?.toString().trim();
  const genre = formData.get("genre")?.toString().trim() || null;
  const bio = formData.get("bio")?.toString().trim() || null;
  const website = formData.get("website")?.toString().trim() || null;
  const instagram = formData.get("instagram")?.toString().trim() || null;
  const heroImageUrl =
    formData.get("hero_image_url")?.toString().trim() || null;

  if (!name) {
    throw new Error("Artist name is required");
  }

  const { data, error } = await supabaseServer
    .from("artists")
    .insert({
      name,
      genre,
      bio,
      website,
      instagram,
      hero_image_url: heroImageUrl,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[Artists] create error:", error);
    throw error;
  }

  // Refresh list + go back to Artists
  revalidatePath("/artists");
  redirect("/artists");
}

export default function NewArtistPage() {
  return (
    <DashboardShell
      title="Add artist"
      subtitle="Create a new artist profile for Sugarshack Downtown."
      activeTab="artists"
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form action={createArtist} className="space-y-4 max-w-xl">
          {/* Name & genre */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="name"
                className="text-xs font-semibold text-slate-700"
              >
                Artist name
              </label>
              <input
                id="name"
                name="name"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="e.g. Sierra Lane"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="genre"
                className="text-xs font-semibold text-slate-700"
              >
                Genre
              </label>
              <input
                id="genre"
                name="genre"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="e.g. Reggae, Acoustic"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1">
            <label
              htmlFor="bio"
              className="text-xs font-semibold text-slate-700"
            >
              Short bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={4}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="Couple of lines about the artist. This can show on the Artist screen in the app."
            />
          </div>

          {/* Links */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="website"
                className="text-xs font-semibold text-slate-700"
              >
                Website
              </label>
              <input
                id="website"
                name="website"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="instagram"
                className="text-xs font-semibold text-slate-700"
              >
                Instagram
              </label>
              <input
                id="instagram"
                name="instagram"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="@handle"
              />
            </div>
          </div>

          {/* Hero image */}
          <div className="space-y-1">
            <label
              htmlFor="hero_image_url"
              className="text-xs font-semibold text-slate-700"
            >
              Hero image URL
            </label>
            <input
              id="hero_image_url"
              name="hero_image_url"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="https://cdn.sugarshackdowntown.com/artist.jpg"
            />
            <p className="text-[11px] text-slate-400">
              Optional. This can be used later for the Artist profile screen in
              the app.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <a
              href="/artists"
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </a>
            <button
              type="submit"
              className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-amber-500"
            >
              Save artist
            </button>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}
