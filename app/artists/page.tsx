import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type ArtistRow = {
  id: string;
  name: string | null;
  genre: string | null;
  bio: string | null;
  website_url: string | null;
  instagram_url: string | null;
  image_url: string | null;
};

function truncate(value: string | null | undefined, length: number): string {
  if (!value) return "";
  if (value.length <= length) return value;
  return value.slice(0, length).trimEnd() + "…";
}

export default async function ArtistsPage() {
  // Use the same pattern as Events: call supabaseServer directly as the client
  const { data, error } = await supabaseServer
    .from("artists")
    .select("id, name, genre, bio, website_url, instagram_url, image_url")
    .order("name", { ascending: true });

  if (error) {
    console.error("[Artists] load error:", error);
  }

  const artists = (data ?? []) as ArtistRow[];

  return (
    <DashboardShell
      title="Artists"
      subtitle="Manage artists that appear on Tonight, Calendar, and in the app."
      activeTab="artists"
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Artist directory
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Click an artist to edit details, or use the Add artist button.
            </p>
          </div>
          <Link
            href="/artists/new"
            className="inline-flex items-center rounded-full bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm hover:bg-amber-400"
          >
            + Add artist
          </Link>
        </div>

        {/* Surface Supabase error so RLS / policy issues are visible */}
        {error && (
          <p className="mb-3 text-xs text-rose-600">
            There was a problem loading artists:{" "}
            <span className="font-mono">{error.message}</span>
          </p>
        )}

        {artists.length === 0 && !error ? (
          <p className="text-sm text-slate-500">
            No artists found yet. Use{" "}
            <span className="font-medium">Add artist</span> to create your
            first profile.
          </p>
        ) : null}

        {artists.length > 0 && (
          <div className="-mx-3 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-1 px-3">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="px-3 py-2 text-left font-medium">Artist</th>
                  <th className="px-3 py-2 text-left font-medium">Genre</th>
                  <th className="px-3 py-2 text-left font-medium">Bio</th>
                  <th className="px-3 py-2 text-left font-medium">Website</th>
                  <th className="px-3 py-2 text-left font-medium">Instagram</th>
                  <th className="px-3 py-2 text-left font-medium">Image</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {artists.map((artist) => {
                  const hasBio = !!artist.bio;
                  const hasWebsite = !!artist.website_url;
                  const hasInstagram = !!artist.instagram_url;
                  const hasImage = !!artist.image_url;

                  return (
                    <tr
                      key={artist.id}
                      className="group text-sm text-slate-800"
                    >
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {artist.name || "Untitled artist"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="text-xs text-slate-600">
                          {artist.genre || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {hasBio ? (
                          <span className="text-xs text-slate-700">
                            {truncate(artist.bio, 60)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Missing</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {hasWebsite ? (
                          <span className="text-xs text-emerald-700">
                            {truncate(artist.website_url, 40)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Missing</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {hasInstagram ? (
                          <span className="text-xs text-emerald-700">
                            {truncate(artist.instagram_url, 40)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Missing</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {hasImage ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            ✓ Image
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                            Missing
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        <Link
                          href={`/artists/${artist.id}`}
                          className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
