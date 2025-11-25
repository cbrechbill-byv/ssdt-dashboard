import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type ArtistPageProps = {
  params: {
    id: string;
  };
};

type ArtistRecord = {
  id: string;
  name: string;
  genre: string | null;
  bio: string | null;
  website_url: string | null;
  instagram_url: string | null;
  is_active: boolean | null;
};

export const dynamic = "force-dynamic";

export default async function ArtistEditPage({ params }: ArtistPageProps) {
  const supabase = supabaseServer;
  const { id } = params;

  const { data: artist, error } = await supabase
    .from("artists")
    .select(
      `
      id,
      name,
      genre,
      bio,
      website_url,
      instagram_url,
      is_active
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[Artist Edit] load error:", error);
  }

  if (!artist) {
    notFound();
  }

  async function updateArtist(formData: FormData) {
    "use server";

    const supabase = supabaseServer;

    const id = formData.get("id") as string;
    const name = (formData.get("name") as string)?.trim();
    const genre = (formData.get("genre") as string)?.trim() || null;
    const bio = (formData.get("bio") as string)?.trim() || null;
    const website_url =
      (formData.get("website_url") as string)?.trim() || null;
    const instagram_url =
      (formData.get("instagram_url") as string)?.trim() || null;
    const is_active = formData.get("is_active") === "on";

    if (!id || !name) {
      // Simple guard; in a future phase we can surface validation errors nicely
      return;
    }

    const { error: updateError } = await supabase
      .from("artists")
      .update({
        name,
        genre,
        bio,
        website_url,
        instagram_url,
        is_active,
      })
      .eq("id", id);

    if (updateError) {
      console.error("[Artist Edit] update error:", updateError);
      return;
    }

    // Refresh lists and this page, then go back to Artists list
    revalidatePath("/artists");
    revalidatePath(`/artists/${id}`);
    redirect("/artists");
  }

  return (
    <DashboardShell
      title="Edit artist"
      subtitle={`Update profile details for ${artist.name}.`}
      activeTab="artists"
    >
      <form action={updateArtist} className="space-y-6 max-w-2xl">
        <input type="hidden" name="id" value={artist.id} />

        {/* Name + genre */}
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
                defaultValue={artist.name}
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
                defaultValue={artist.genre ?? ""}
                placeholder="Reggae, Americana, Folk, etc."
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="is_active"
                name="is_active"
                type="checkbox"
                defaultChecked={artist.is_active ?? true}
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
              defaultValue={artist.bio ?? ""}
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
                defaultValue={artist.website_url ?? ""}
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
                defaultValue={artist.instagram_url ?? ""}
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
              // This is a server component, so we can't use router here.
              // Let’s just rely on the browser back button.
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
            Save changes
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
