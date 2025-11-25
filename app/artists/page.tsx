import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type ArtistRow = {
  id: string;
  name: string | null;
  genre: string | null;
  bio: string | null;
  website: string | null;
  instagram: string | null;
  hero_image_url: string | null;
  is_active: boolean | null;
};

export const dynamic = "force-dynamic";

export default async function ArtistsPage() {
  // supabaseServer is already a client instance – do NOT call it as a function
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("artists")
    .select(
      "id, name, genre, bio, website, instagram, hero_image_url, is_active"
    )
    .order("name", { ascending: true });

  if (error) {
    console.error("[Artists] load error:", error);
  }

  const artists: ArtistRow[] = (data ?? []) as ArtistRow[];

  const truncate = (value: string | null, max = 40) => {
    if (!value) return "";
    if (value.length <= max) return value;
    return value.slice(0, max) + "…";
  };

  const presenceLabel = (value: string | null) =>
    value && value.trim().length > 0 ? "Set" : "Missing";

  return (
    <DashboardShell
      title="Artists"
      subtitle="Manage artists that appear on the Tonight screen, Calendar, and in the app."
      activeTab="artists"
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        {/* Header row with Add button */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              Artist roster
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Quickly see who is missing bios, links, or images.
            </p>
          </div>
          <Link
            href="/artists/new"
            className="inline-flex items-center rounded-full bg-amber-400 hover:bg-amber-500 text-slate-900 text-xs font-semibold px-3 py-1.5 shadow-sm"
          >
            + Add artist
          </Link>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.12em] text-slate-500 border-b border-slate-100">
                <th className="px-3 py-2 text-left font-semibold">Artist</th>
                <th className="px-3 py-2 text-left font-semibold">Genre</th>
                <th className="px-3 py-2 text-left font-semibold">Bio</th>
                <th className="px-3 py-2 text-left font-semibold">Website</th>
                <th className="px-3 py-2 text-left font-semibold">Instagram</th>
                <th className="px-3 py-2 text-left font-semibold">Image</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {artists.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-xs text-slate-400"
                  >
                    No artists yet. Click &ldquo;Add artist&rdquo; to create
                    your first profile.
                  </td>
                </tr>
              ) : (
                artists.map((artist) => {
                  const bioText = truncate(artist.bio);
                  const websiteStatus = presenceLabel(artist.website);
                  const instagramStatus = presenceLabel(artist.instagram);
                  const imageStatus = presenceLabel(artist.hero_image_url);

                  const isActive =
                    typeof artist.is_active === "boolean"
                      ? artist.is_active
                      : true;

                  return (
                    <tr
                      key={artist.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2 align-top text-slate-900">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {artist.name || "Untitled artist"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-700">
                        {artist.genre || "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-700">
                        {bioText ? (
                          <span>{bioText}</span>
                        ) : (
                          <span className="text-slate-400">Missing</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={
                            websiteStatus === "Set"
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }
                        >
                          {websiteStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={
                            instagramStatus === "Set"
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }
                        >
                          {instagramStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={
                            imageStatus === "Set"
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }
                        >
                          {imageStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <Link
                          href={`/artists/${artist.id}`}
                          className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
