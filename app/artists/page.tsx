import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type ArtistRow = {
  id: string;
  name: string;
  genre: string | null;
  is_active: boolean | null;
};

export const dynamic = "force-dynamic";

export default async function ArtistsPage() {
  // supabaseServer is already a client instance – do NOT call it as a function
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("artists")
    .select("id, name, genre, is_active")
    .order("name", { ascending: true });

  if (error) {
    console.error("[Artists] load error:", error);
  }

  const artists: ArtistRow[] = (data ?? []) as ArtistRow[];

  return (
    <DashboardShell
      title="Artists"
      subtitle="Manage artists that appear on the Tonight screen, Calendar, and in the app."
      activeTab="artists"
    >
      <div className="space-y-6">
        {/* Header row with Add button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Artist roster
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Edit genres, bios, and links for each artist.
            </p>
          </div>
          <Link
            href="/artists/new"
            className="inline-flex items-center rounded-full bg-[#ffc800] px-4 py-2 text-xs font-semibold text-black shadow hover:bg-[#e6b400]"
          >
            + Add artist
          </Link>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase tracking-[0.14em] text-slate-400">
                <th className="px-4 py-3 text-left">Artist</th>
                <th className="px-4 py-3 text-left">Genre</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {artists.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-xs text-slate-400"
                  >
                    No artists found yet. Use &ldquo;Add artist&rdquo; to create
                    your first profile.
                  </td>
                </tr>
              ) : (
                artists.map((artist) => (
                  <tr
                    key={artist.id}
                    className="border-t border-slate-800/80 hover:bg-slate-900/40"
                  >
                    <td className="px-4 py-3 text-slate-50">
                      <div className="flex flex-col">
                        <span className="font-medium">{artist.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {artist.genre || (
                        <span className="text-slate-500 italic">Unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          artist.is_active ?? true
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-slate-600/30 text-slate-200",
                        ].join(" ")}
                      >
                        {artist.is_active ?? true ? "Active" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/artists/${artist.id}`}
                        className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-900"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
