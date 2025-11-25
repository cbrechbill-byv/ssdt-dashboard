import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type Artist = {
  id: string;
  name: string;
  slug: string | null;
  genre: string | null;
  bio: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  spotify_url: string | null;
  image_path: string | null;
  is_active: boolean;
};

async function updateArtist(id: string, formData: FormData) {
  "use server";

  const name = (formData.get("name") || "").toString().trim();
  if (!name) {
    return;
  }

  const genre = (formData.get("genre") || "").toString().trim() || null;
  const website_url =
    (formData.get("website_url") || "").toString().trim() || null;
  const instagram_url =
    (formData.get("instagram_url") || "").toString().trim() || null;
  const facebook_url =
    (formData.get("facebook_url") || "").toString().trim() || null;
  const tiktok_url =
    (formData.get("tiktok_url") || "").toString().trim() || null;
  const spotify_url =
    (formData.get("spotify_url") || "").toString().trim() || null;
  const image_path =
    (formData.get("image_path") || "").toString().trim() || null;
  const bio = (formData.get("bio") || "").toString().trim() || null;
  const is_active = formData.get("is_active") === "on";

  const slugInput = (formData.get("slug") || "").toString().trim();
  const slug =
    slugInput
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") || null;

  const { error } = await supabaseServer
    .from("artists")
    .update({
      name,
      slug,
      genre,
      website_url,
      instagram_url,
      facebook_url,
      tiktok_url,
      spotify_url,
      image_path,
      bio,
      is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[Artists] update error:", error);
  }

  revalidatePath("/artists");
  redirect("/artists");
}

export default async function EditArtistPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  const { data, error } = await supabaseServer
    .from("artists")
    .select(
      "id, name, slug, genre, bio, website_url, instagram_url, facebook_url, tiktok_url, spotify_url, image_path, is_active"
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("[Artists] load artist error:", error);
    notFound();
  }

  const artist = data as Artist;

  async function action(formData: FormData) {
    "use server";
    await updateArtist(id, formData);
  }

  return (
    <DashboardShell
      title={`Edit artist`}
      subtitle={`Update profile details for ${artist.name}.`}
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 max-w-2xl">
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
              Name
            </label>
            <input
              name="name"
              defaultValue={artist.name}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
                Genre
              </label>
              <input
                name="genre"
                defaultValue={artist.genre ?? ""}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
                Slug
              </label>
              <input
                name="slug"
                defaultValue={artist.slug ?? ""}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Used for URLs and deep links. Only lowercase letters, numbers,
                and dashes.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
              Bio
            </label>
            <textarea
              name="bio"
              rows={4}
              defaultValue={artist.bio ?? ""}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
                Website
              </label>
              <input
                name="website_url"
                defaultValue={artist.website_url ?? ""}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
                Instagram
              </label>
              <input
                name="instagram_url"
                defaultValue={artist.instagram_url ?? ""}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
                Facebook
              </label>
              <input
                name="facebook_url"
                defaultValue={artist.facebook_url ?? ""}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
                TikTok
              </label>
              <input
                name="tiktok_url"
                defaultValue={artist.tiktok_url ?? ""}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
                Spotify
              </label>
              <input
                name="spotify_url"
                defaultValue={artist.spotify_url ?? ""}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
                Image path
              </label>
              <input
                name="image_path"
                defaultValue={artist.image_path ?? ""}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="artist-photos/afinnity-band.jpg"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Upload to the <code>artist-photos</code> bucket in Supabase and
                paste the path here.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={artist.is_active}
                className="rounded border-slate-300"
              />
              Active (show in app)
            </label>

            <div className="flex gap-2">
              <a
                href="/artists"
                className="text-xs px-3 py-1.5 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </a>
              <button
                type="submit"
                className="text-xs px-4 py-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold shadow-sm"
              >
                Save changes
              </button>
            </div>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}
