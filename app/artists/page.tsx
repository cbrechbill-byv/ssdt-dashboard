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
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("artists")
    .select("id, name, genre, is_active")
    .order("name", { ascending: true });

  if (error) {
    console.error("[Artists] list error:", error);
  }

  const artists: ArtistRow[] = data ?? [];

  return (
    <DashboardShell
      title="Artists"
      subtitle="Manage artists that appear on the Tonight screen, Calendar, and in the app."
      activeTab="artists"
      primaryAction={{ label: "Add artist", href: "/artists/new" }}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/70">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-300">
                Artist
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">
                Genre
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">
                Status
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {artists.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  No artists yet. Click{" "}
                  <span className="font-semibold text-slate-200">
                    “Add artist”
                  </span>{" "}
                  to create your first profile.
                </td>
              </tr>
            ) : (
              artists.map((artist) => (
                <tr key={artist.id} className="hover:bg-slate-900/60">
                  <td className="px-4 py-3 text-slate-100">{artist.name}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {artist.genre ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        artist.is_active ?? true
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-600/20 text-slate-300",
                      ].join(" ")}
                    >
                      {artist.is_active ?? true ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/artists/${artist.id}`}
                      className="text-sm font-medium text-[#ffc800] hover:underline"
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
    </DashboardShell>
  );
}
