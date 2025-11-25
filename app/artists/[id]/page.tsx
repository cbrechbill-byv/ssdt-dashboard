import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type ArtistRecord = {
  id: string;
  name: string | null;
  genre: string | null;
  bio: string | null;
  website: string | null;
  instagram: string | null;
  hero_image_url: string | null;
};

type ArtistPageProps = {
  params: { id: string };
};

async function updateArtist(formData: FormData) {
  "use server";

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing artist id");
  }

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

  const { error } = await supabaseServer
    .from("artists")
    .update({
      name,
      genre,
      bio,
      website,
      instagram,
      hero_image_url: heroImageUrl,
    })
    .eq("id", id);

  if (error) {
    console.error("[Artists] update error:", error);
    throw error;
  }

  revalidatePath("/artists");
  redirect("/artists");
}

export default async function ArtistEditPage({ params }: ArtistPageProps) {
  const { id } = params;

  const { data, error } = await supabaseServer
    .from("artists")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[Artists] not found:", error);
    notFound();
  }

  const artist = data as ArtistRecord;

  return (
    <DashboardShell
      title={`Edit artist`}
      subtitle={`Update profile details for ${artist.name || "artist"}.`}
      activeTab="artists"
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form action={updateArtist} className="space-y-4 max-w-xl">
          <input type="hidden" name="id" value={artist.id} />

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
                defaultValue={artist.name ?? ""}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
                defaultValue={artist.genre ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
              defaultValue={artist.bio ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
                defaultValue={artist.website ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
                defaultValue={artist.instagram ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
              defaultValue={artist.hero_image_url ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <p className="text-[11px] text-slate-400">
              Optional. Used for richer artist profiles in the app.
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
              Save changes
            </button>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}
