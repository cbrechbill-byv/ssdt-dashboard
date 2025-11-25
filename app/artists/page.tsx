import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type ArtistRow = {
  id: string;
  name: string;
  genre: string | null;
  is_active: boolean;
};

export default async function ArtistsPage() {
  const { data, error } = await supabaseServer
    .from("artists")
    .select("id, name, genre, is_active")
    .order("name", { ascending: true });

  if (error) {
    console.error("[Artists] load error:", error);
  }

  const artists = (data ?? []) as ArtistRow[];

  return (
    <DashboardShell
      title="Artists"
      subtitle="Manage artists that appear on the Tonight screen, Calendar, and in the app."
      primaryAction={{
        label: "Add artist",
        href: "/artists/new",
      }}
      activeTab="artists"
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 overflow-x-auto">
        <div className="text-[11px] text-slate-500 mb-3">
          Add bios, images, and links for the performers at Sugarshack Downtown.
        </div>

        <table className="w-full text-left text-xs border-collapse min-w-[520px]">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <th className="py-2 pr-4">Artist</th>
              <th className="py-2 pr-4">Genre</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pl-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {artists.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-6 text-center text-xs text-slate-500"
                >
                  No artists yet. Click &ldquo;Add artist&rdquo; to create your
                  first profile.
                </td>
              </tr>
            )}

            {artists.map((artist, idx) => {
              const rowClass =
                idx % 2 === 0 ? "bg-white" : "bg-slate-50/60";

              return (
                <tr
                  key={artist.id}
                  className={`${rowClass} border-b border-slate-100 last:border-0`}
                >
                  <td className="py-2 pr-4 align-top whitespace-nowrap">
                    {artist.name}
                  </td>
                  <td className="py-2 pr-4 align-top whitespace-nowrap">
                    {artist.genre || "—"}
                  </td>
                  <td className="py-2 pr-4 align-top whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        artist.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {artist.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-2 pl-4 align-top text-right whitespace-nowrap">
                    <a
                      href={`/artists/${artist.id}`}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                    >
                      Edit
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </DashboardShell>
  );
}
