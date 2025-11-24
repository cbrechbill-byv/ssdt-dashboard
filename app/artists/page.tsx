import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type ArtistRow = {
  id: string;
  name: string;
  genre: string | null;
  image_path: string | null;
  website_url: string | null;
  instagram_url: string | null;
  is_active: boolean;
};

export default async function ArtistsPage() {
  const { data, error } = await supabaseServer
    .from("artists")
    .select(
      "id, name, genre, image_path, website_url, instagram_url, is_active"
    )
    .order("name", { ascending: true });

  if (error) {
    console.error("[Artists] load error:", error);
  }

  const artists = (data ?? []) as ArtistRow[];

  return (
    <DashboardShell
      title="Artists"
      subtitle="Manage artists that appear on the Tonight screen, Calendar, and in the app."
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              Artist roster
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Add bios, images, and links for the performers at Sugarshack
              Downtown.
            </p>
          </div>
          <Link
            href="/artists/new"
            className="inline-flex items-center rounded-full bg-amber-400 hover:bg-amber-500 text-slate-900 text-xs font-semibold px-3 py-1.5 shadow-sm"
          >
            + Add artist
          </Link>
        </div>

        {artists.length === 0 ? (
          <p className="text-xs text-slate-400">
            No artists yet. Click &ldquo;Add artist&rdquo; to create your first
            profile.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3 text-left font-semibold">Name</th>
                  <th className="py-2 pr-3 text-left font-semibold">Genre</th>
                  <th className="py-2 pr-3 text-left font-semibold">Image</th>
                  <th className="py-2 pr-3 text-left font-semibold">
                    Instagram
                  </th>
                  <th className="py-2 pr-3 text-left font-semibold">Website</th>
                  <th className="py-2 text-right font-semibold">Status</th>
                  <th className="py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {artists.map((artist) => (
                  <tr
                    key={artist.id}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="py-2 pr-3 text-[13px] text-slate-900">
                      {artist.name}
                    </td>
                    <td className="py-2 pr-3 text-[13px] text-slate-700">
                      {artist.genre || "—"}
                    </td>
                    <td className="py-2 pr-3 text-[13px] text-slate-700">
                      {artist.image_path ? "Set" : "Missing"}
                    </td>
                    <td className="py-2 pr-3 text-[13px] text-slate-700">
                      {artist.instagram_url ? "Set" : "—"}
                    </td>
                    <td className="py-2 pr-3 text-[13px] text-slate-700">
                      {artist.website_url ? "Set" : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right text-[13px]">
                      <span
                        className={
                          artist.is_active
                            ? "inline-flex rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold"
                            : "inline-flex rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[11px] font-semibold"
                        }
                      >
                        {artist.is_active ? "Active" : "Hidden"}
                      </span>
                    </td>
                    <td className="py-2 text-right text-[13px]">
                      <Link
                        href={`/artists/${artist.id}`}
                        className="text-xs font-medium text-slate-900 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
