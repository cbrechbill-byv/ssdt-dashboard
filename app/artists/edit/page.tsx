export const dynamic = "force-dynamic";

import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ArtistImageUploader from "@/components/artists/ArtistImageUploader";

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

function getIdFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): string {
  const raw = searchParams.id;
  if (!raw) return "";
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw;
}

async function fetchArtist(id: string): Promise<{
  artist: Artist | null;
  errorMessage: string | null;
}> {
  if (!id) {
    return {
      artist: null,
      errorMessage: "No artist id provided in query (?id=…).",
    };
  }

  const { data, error } = await supabaseServer
    .from("artists")
    .select(
      `
      id,
      name,
      slug,
      genre,
      bio,
      website_url,
      instagram_url,
      facebook_url,
      tiktok_url,
      spotify_url,
      image_path,
      is_active
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[Artist edit] load error:", error);
    return { artist: null, errorMessage: error.message };
  }

  if (!data) {
    return { artist: null, errorMessage: "No artist found for this id." };
  }

  return { artist: data as Artist, errorMessage: null };
}

function getPublicUrlForImagePath(imagePath: string | null): string | null {
  if (!imagePath) return null;

  const segments = imagePath.split("/");
  if (segments.length < 2) return null;

  const bucket = segments[0];
  const key = segments.slice(1).join("/");

  const { data } = supabaseServer.storage.from(bucket).getPublicUrl(key);
  return data?.publicUrl ?? null;
}

// NOTE: searchParams is a Promise in Next 15+/16
export default async function ArtistEditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const id = getIdFromSearchParams(resolvedSearchParams);
  const { artist, errorMessage } = await fetchArtist(id);

  async function updateArtist(formData: FormData) {
    "use server";

    const id = formData.get("id")?.toString() ?? "";
    const name = formData.get("name")?.toString().trim() || "";
    const slug = formData.get("slug")?.toString().trim() || null;
    const genre = formData.get("genre")?.toString().trim() || null;
    const bio = formData.get("bio")?.toString().trim() || null;
    const website_url =
      formData.get("website_url")?.toString().trim() || null;
    const instagram_url =
      formData.get("instagram_url")?.toString().trim() || null;
    const facebook_url =
      formData.get("facebook_url")?.toString().trim() || null;
    const tiktok_url =
      formData.get("tiktok_url")?.toString().trim() || null;
    const spotify_url =
      formData.get("spotify_url")?.toString().trim() || null;
    const image_path =
      formData.get("image_path")?.toString().trim() || null;

    const is_active_value = formData.get("is_active");
    const is_active = is_active_value === "on";

    if (!id || !name) {
      throw new Error("Artist name is required.");
    }

    const { error } = await supabaseServer
      .from("artists")
      .update({
        name,
        slug,
        genre,
        bio,
        website_url,
        instagram_url,
        facebook_url,
        tiktok_url,
        spotify_url,
        image_path,
        is_active,
      })
      .eq("id", id);

    if (error) {
      console.error("[Artist edit] update error:", error);
      throw error;
    }

    revalidatePath("/artists");
    redirect("/artists");
  }

  if (!artist) {
    return (
      <DashboardShell
        title="Edit artist"
        subtitle="Unable to load artist"
        activeTab="artists"
      >
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800 space-y-2">
          <p className="font-semibold">Could not load artist</p>
          <p>
            Query id:&nbsp;
            <code className="font-mono text-xs">
              {id || "(missing or undefined)"}
            </code>
          </p>
          <p className="text-xs">
            searchParams:&nbsp;
            <code className="font-mono text-[10px]">
              {JSON.stringify(resolvedSearchParams)}
            </code>
          </p>
          {errorMessage && (
            <p className="text-xs">
              Supabase error:{" "}
              <span className="font-mono">{errorMessage}</span>
            </p>
          )}
          <a
            href="/artists"
            className="mt-2 inline-flex items-center rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
          >
            Back to artists
          </a>
        </section>
      </DashboardShell>
    );
  }

  const initialImageUrl = getPublicUrlForImagePath(artist.image_path);

  return (
    <DashboardShell
      title="Edit artist"
      subtitle={artist.name}
      activeTab="artists"
    >
      <form action={updateArtist} className="space-y-4">
        <input type="hidden" name="id" defaultValue={artist.id} />

        {/* Core details */}
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm space-y-4">
          <div className="mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Artist details
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Update how this artist appears in the app.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="name"
                className="text-xs font-medium text-slate-800"
              >
                Name
              </label>
              <input
                id="name"
                name="name"
                defaultValue={artist.name}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="slug"
                className="text-xs font-medium text-slate-800"
              >
                Slug (optional)
              </label>
              <input
                id="slug"
                name="slug"
                defaultValue={artist.slug ?? ""}
                placeholder="e.g. the-movement"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="genre"
                className="text-xs font-medium text-slate-800"
              >
                Genre
              </label>
              <input
                id="genre"
                name="genre"
                defaultValue={artist.genre ?? ""}
                placeholder="e.g. Reggae, Acoustic, Soul"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <ArtistImageUploader
              artistName={artist.name}
              slug={artist.slug}
              initialPath={artist.image_path}
              initialUrl={initialImageUrl}
              fieldName="image_path"
            />

            <div className="md:col-span-2 space-y-1.5">
              <label
                htmlFor="bio"
                className="text-xs font-medium text-slate-800"
              >
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                defaultValue={artist.bio ?? ""}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>
        </section>

        {/* Links & socials */}
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Links & social
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="website_url"
                className="text-xs font-medium text-slate-800"
              >
                Website
              </label>
              <input
                id="website_url"
                name="website_url"
                defaultValue={artist.website_url ?? ""}
                placeholder="https://"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="instagram_url"
                className="text-xs font-medium text-slate-800"
              >
                Instagram
              </label>
              <input
                id="instagram_url"
                name="instagram_url"
                defaultValue={artist.instagram_url ?? ""}
                placeholder="https://instagram.com/…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="facebook_url"
                className="text-xs font-medium text-slate-800"
              >
                Facebook
              </label>
              <input
                id="facebook_url"
                name="facebook_url"
                defaultValue={artist.facebook_url ?? ""}
                placeholder="https://facebook.com/…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="tiktok_url"
                className="text-xs font-medium text-slate-800"
              >
                TikTok
              </label>
              <input
                id="tiktok_url"
                name="tiktok_url"
                defaultValue={artist.tiktok_url ?? ""}
                placeholder="https://tiktok.com/@…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="spotify_url"
                className="text-xs font-medium text-slate-800"
              >
                Spotify
              </label>
              <input
                id="spotify_url"
                name="spotify_url"
                defaultValue={artist.spotify_url ?? ""}
                placeholder="https://open.spotify.com/artist/…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>
        </section>

        {/* Status + actions */}
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-800">
              Visibility & status
            </p>
            <p className="text-[11px] text-slate-500">
              Use this toggle to hide or show the artist in the app.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked={artist.is_active}
              className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
            <label
              htmlFor="is_active"
              className="text-xs font-medium text-slate-800"
            >
              Artist is active and should appear in the app
            </label>
          </div>
        </section>

        <div className="flex flex-wrap justify-between gap-3">
          <a
            href="/artists"
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-amber-400"
          >
            Save changes
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
