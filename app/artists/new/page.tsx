// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\artists\new\page.tsx

export const dynamic = "force-dynamic";

import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ArtistImageUploader from "@/components/artists/ArtistImageUploader";
import { getDashboardSession } from "@/lib/dashboardAuth";

export default function NewArtistPage() {
  async function createArtist(formData: FormData) {
    "use server";

    const name = formData.get("name")?.toString().trim() || "";
    const slug = formData.get("slug")?.toString().trim() || null;
    const genre = formData.get("genre")?.toString().trim() || null;
    const bio = formData.get("bio")?.toString().trim() || null;
    const website_url = formData.get("website_url")?.toString().trim() || null;
    const instagram_url = formData.get("instagram_url")?.toString().trim() || null;
    const facebook_url = formData.get("facebook_url")?.toString().trim() || null;
    const tiktok_url = formData.get("tiktok_url")?.toString().trim() || null;
    const spotify_url = formData.get("spotify_url")?.toString().trim() || null;
    const image_path = formData.get("image_path")?.toString().trim() || null;

    if (!name) {
      throw new Error("Artist name is required.");
    }

    // Insert artist and return id for logging
    const { data, error } = await supabaseServer
      .from("artists")
      .insert([
        {
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
          is_active: true,
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.error("[Artist new] insert error:", error);
      throw error;
    }

    // 🔐 Audit log
    try {
      const session = await getDashboardSession();
      await supabaseServer.from("dashboard_audit_log").insert({
        actor_email: session?.email ?? null,
        actor_role: session?.role ?? null,
        action: "create",
        entity: "artists",
        entity_id: data?.id ?? null,
        details: {
          name,
          slug,
          genre,
          is_active: true,
        },
      });
    } catch (logError) {
      console.error("[Artist new] audit log error:", logError);
    }

    revalidatePath("/artists");
    redirect("/artists");
  }

  return (
    <DashboardShell
      title="Add artist"
      subtitle="Create a new artist profile for the app."
      activeTab="artists"
    >
      <form action={createArtist} className="space-y-4 max-w-3xl">
        {/* Core details */}
        <section className="rounded-2xl border border-slate-200 bg-white px-4 sm:px-5 py-4 shadow-sm space-y-4">
          <div className="mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Artist details
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Name, genre, bio, and image are shown in the app.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-medium text-slate-800">
                Name
              </label>
              <input
                id="name"
                name="name"
                required
                placeholder="Artist or band name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="slug" className="text-xs font-medium text-slate-800">
                Slug (optional)
              </label>
              <input
                id="slug"
                name="slug"
                placeholder="e.g. the-movement"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="genre" className="text-xs font-medium text-slate-800">
                Genre
              </label>
              <input
                id="genre"
                name="genre"
                placeholder="e.g. Reggae, Acoustic, Soul"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            {/* For new artist, we pass a generic label; image filename uses slugified version internally */}
            <ArtistImageUploader
              artistName="New artist"
              slug={null}
              initialPath={null}
              fieldName="image_path"
            />

            <div className="md:col-span-2 space-y-1.5">
              <label htmlFor="bio" className="text-xs font-medium text-slate-800">
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                placeholder="Short description shown in artist profile."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>
        </section>

        {/* Links & socials */}
        <section className="rounded-2xl border border-slate-200 bg-white px-4 sm:px-5 py-4 shadow-sm">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Links & social
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="website_url" className="text-xs font-medium text-slate-800">
                Website
              </label>
              <input
                id="website_url"
                name="website_url"
                placeholder="https://"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="instagram_url" className="text-xs font-medium text-slate-800">
                Instagram
              </label>
              <input
                id="instagram_url"
                name="instagram_url"
                placeholder="https://instagram.com/…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="facebook_url" className="text-xs font-medium text-slate-800">
                Facebook
              </label>
              <input
                id="facebook_url"
                name="facebook_url"
                placeholder="https://facebook.com/…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tiktok_url" className="text-xs font-medium text-slate-800">
                TikTok
              </label>
              <input
                id="tiktok_url"
                name="tiktok_url"
                placeholder="https://tiktok.com/@…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="spotify_url" className="text-xs font-medium text-slate-800">
                Spotify
              </label>
              <input
                id="spotify_url"
                name="spotify_url"
                placeholder="https://open.spotify.com/artist/…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>
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
            Create artist
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
