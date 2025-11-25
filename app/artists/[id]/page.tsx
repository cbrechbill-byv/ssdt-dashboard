import { notFound, redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type Artist = {
  id: string;
  name: string;
  genre: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  image_url: string | null;
  bio: string | null;
  is_active: boolean;
};

type PageProps = {
  params: {
    id: string;
  };
};

// ---------
// Server action to update the artist
// ---------
async function updateArtist(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const genre = (formData.get("genre") as string | null)?.trim() || null;
  const website_url =
    (formData.get("website_url") as string | null)?.trim() || null;
  const instagram_handle =
    (formData.get("instagram_handle") as string | null)?.trim() || null;
  const image_url =
    (formData.get("image_url") as string | null)?.trim() || null;
  const bio = (formData.get("bio") as string | null)?.trim() || null;
  const is_active = formData.get("is_active") === "on";

  if (!id || !name) {
    throw new Error("Missing required artist fields.");
  }

  const supabase = supabaseServer;

  const { error } = await supabase
    .from("artists")
    .update({
      name,
      genre,
      website_url,
      instagram_handle,
      image_url,
      bio,
      is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Failed to update artist:", error);
    throw new Error(error.message);
  }

  redirect("/artists");
}

// ---------
// Page component
// ---------
export default async function EditArtistPage({ params }: PageProps) {
  const { id } = params;

  const supabase = supabaseServer;

  const { data: artist, error } = await supabase
    .from("artists")
    .select(
      `
      id,
      name,
      genre,
      website_url,
      instagram_handle,
      image_url,
      bio,
      is_active
    `
    )
    .eq("id", id)
    .maybeSingle<Artist>();

  if (error) {
    console.error("Error loading artist:", error);
    throw new Error("Unable to load artist.");
  }

  if (!artist) {
    notFound();
  }

  return (
    <DashboardShell
      title="Edit artist"
      subtitle={`Update profile details for ${artist.name}.`}
      activeTab="artists"
    >
      <form action={updateArtist} className="max-w-2xl space-y-6">
        <input type="hidden" name="id" value={artist.id} />

        {/* Name */}
        <div className="space-y-1">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-slate-200"
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={artist.name}
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
        </div>

        {/* Genre */}
        <div className="space-y-1">
          <label
            htmlFor="genre"
            className="block text-sm font-medium text-slate-200"
          >
            Genre
          </label>
          <input
            id="genre"
            name="genre"
            defaultValue={artist.genre ?? ""}
            placeholder="Singer Songwriter, Reggae, Jam/Funk…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
        </div>

        {/* Website */}
        <div className="space-y-1">
          <label
            htmlFor="website_url"
            className="block text-sm font-medium text-slate-200"
          >
            Website
          </label>
          <input
            id="website_url"
            name="website_url"
            type="url"
            defaultValue={artist.website_url ?? ""}
            placeholder="https://artistwebsite.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
        </div>

        {/* Instagram */}
        <div className="space-y-1">
          <label
            htmlFor="instagram_handle"
            className="block text-sm font-medium text-slate-200"
          >
            Instagram handle
          </label>
          <input
            id="instagram_handle"
            name="instagram_handle"
            defaultValue={artist.instagram_handle ?? ""}
            placeholder="@artistname"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
        </div>

        {/* Image URL */}
        <div className="space-y-1">
          <label
            htmlFor="image_url"
            className="block text-sm font-medium text-slate-200"
          >
            Image URL
          </label>
          <input
            id="image_url"
            name="image_url"
            defaultValue={artist.image_url ?? ""}
            placeholder="https://…/artist-photo.jpg"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
        </div>

        {/* Bio */}
        <div className="space-y-1">
          <label
            htmlFor="bio"
            className="block text-sm font-medium text-slate-200"
          >
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={artist.bio ?? ""}
            rows={4}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-2">
          <input
            id="is_active"
            name="is_active"
            type="checkbox"
            defaultChecked={artist.is_active}
            className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-amber-400"
          />
          <label
            htmlFor="is_active"
            className="text-sm text-slate-200 select-none"
          >
            Active (show in Tonight screen and Calendar)
          </label>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <a
            href="/artists"
            className="inline-flex items-center rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-amber-400 px-6 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300"
          >
            Save changes
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
