import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type ArtistRow = {
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

function truncate(value: string | null | undefined, length: number): string {
  if (!value) return "";
  if (value.length <= length) return value;
  return value.slice(0, length).trimEnd() + "…";
}

export default async function ArtistsPage() {
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
    .order("name", { ascending: true });

  if (error) {
    console.error("[Artists] load error:", error);
  }

  const artists = (data ?? []) as ArtistRow[];
  const totalCount = artists.length;
  const activeCount = artists.filter((a) => a.is_active).length;

  return (
    <DashboardShell
      title="Artists"
      subtitle="These artists drive Tonight, Calendar, and the Artist pages in the app."
      activeTab="artists"
    >
      <section className="space-y-4">
        {/* Top summary + Add button */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Artist directory
            </p>
            <p className="text-xs text-slate-500">
              Keep this list in sync with who actually plays Sugarshack Downtown.
              Edits are live in the app.
            </p>
            {totalCount > 0 && (
              <p className="text-[11px] text-slate-400">
                {activeCount} active · {totalCount} total
              </p>
            )}
          </div>
          <Link
            href="/artists/new"
            className="inline-flex items-center rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-amber-300"
          >
            + Add artist
          </Link>
        </div>

        {/* Main table card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              All artists
            </p>
          </div>

          {error && (
            <div className="border-b border-slate-100 bg-rose-50 px-4 py-2.5">
              <p className="text-xs text-rose-700">
                There was a problem loading artists:{" "}
                <span className="font-mono">{error.message}</span>
              </p>
            </div>
          )}

          {artists.length === 0 && !error ? (
            <div className="px-4 py-4">
              <p className="text-sm text-slate-500">
                No artists found yet. Use{" "}
                <span className="font-semibold">Add artist</span> to create your
                first profile.
              </p>
            </div>
          ) : null}

          {artists.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-4 py-2 text-left">Artist</th>
                    <th className="px-3 py-2 text-left">Genre</th>
                    <th className="px-3 py-2 text-left">Bio</th>
                    <th className="px-3 py-2 text-left">Website</th>
                    <th className="px-3 py-2 text-left">Instagram</th>
                    <th className="px-3 py-2 text-left">Image</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {artists.map((artist, idx) => {
                    const hasBio = !!artist.bio;
                    const hasWebsite = !!artist.website_url;
                    const hasInstagram = !!artist.instagram_url;
                    const hasImage = !!artist.image_path;

                    const rowBg =
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/40";

                    return (
                      <tr
                        key={artist.id}
                        className={`${rowBg} border-b border-slate-100 last:border-b-0 transition-colors hover:bg-slate-50`}
                      >
                        <td className="px-4 py-2 align-top">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900">
                              {artist.name || "Untitled artist"}
                            </span>
                            {!artist.is_active && (
                              <span className="mt-0.5 text-[11px] text-slate-400">
                                Inactive
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top whitespace-nowrap text-xs text-slate-700">
                          {artist.genre || "—"}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {hasBio ? (
                            <span className="text-xs text-slate-700">
                              {truncate(artist.bio, 80)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Missing
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {hasWebsite ? (
                            <span className="text-xs text-emerald-700">
                              {truncate(artist.website_url, 40)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Missing
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {hasInstagram ? (
                            <span className="text-xs text-emerald-700">
                              {truncate(artist.instagram_url, 40)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Missing
                            </span>
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
                        <td className="px-4 py-2 align-top text-right">
                          <Link
                            href={`/artists/edit?id=${artist.id}`}
                            className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
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
        </div>
      </section>
    </DashboardShell>
  );
}
