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
  is_active: boolean | null;
};

/**
 * Server action: update an existing artist
 */
async function updateArtist(formData: FormData) {
  "use server";

  const supabase = supabaseServer;

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
  const is_active = formData.get("is_active") === "on";

  if (!name) {
    throw new Error("Artist name is required");
  }

  const { error } = await supabase
    .from("artists")
    .update({
      name,
      genre,
      bio,
      website,
      instagram,
      hero_image_url: heroImageUrl,
      is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[Artists] update error:", error);
    throw error;
  }

  revalidatePath("/artists");
  redirect("/artists");
}

type ArtistPageProps = {
  params: { id: string };
};

export default async function ArtistEditPage({ params }: ArtistPageProps) {
  const { id } = params;
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("artists")
    .select(
      "id, name, genre, bio, website, instagram, hero_image_url, is_active"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[Artists] not found:", error);
    notFound();
  }

  const artist = data as ArtistRecord;

  const startChecked =
    typeof artist.is_active === "boolean" ? artist.is_active : true;

  return (
    <DashboardShell
      title="Edit artist"
      subtitle={`Update profile details for ${
        artist.name || "artist"
      }.`}
      activeTab="artists"
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm max-w-2xl">
        <form action={updateArtist} className="space-y-4">
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
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
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
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1">
            <label
              htmlFor="bio"
              className="text-xs font-semibold text-slate-700"
            >
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              defaultValue={artist.bio ?? ""}
              rows={4}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
              placeholder="Short description that appears in the app."
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
                placeholder="https://"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
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
                placeholder="@handle or profile URL"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
              />
            </div>
          </div>

          {/* Image URL + Status */}
          <div className="space-y-1">
            <label
              htmlFor="hero_image_url"
              className="text-xs font-semibold text-slate-700"
            >
              Image path / URL
            </label>
            <input
              id="hero_image_url"
              name="hero_image_url"
              defaultValue={artist.hero_image_url ?? ""}
              placeholder="Storage path or full URL"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              This controls whether the &ldquo;Image&rdquo; column shows as
              set or missing.
            </p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-2 pt-2">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked={startChecked}
              className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
            <label
              htmlFor="is_active"
              className="text-xs text-slate-700"
            >
              Artist is active and should appear in app and event
              picker.
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <a
              href="/artists"
              className="inline-flex items-center rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </a>
            <button
              type="submit"
              className="inline-flex items-center rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-amber-500"
            >
              Save changes
            </button>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}
