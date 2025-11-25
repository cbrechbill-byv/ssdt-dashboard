import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type EventRow = {
  id: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  genre_override: string | null;
  title: string | null;
  is_cancelled: boolean;
  artist: {
    name: string;
    genre: string | null;
  } | null;
};

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("events")
    .select(
      `
      id,
      event_date,
      start_time,
      end_time,
      genre_override,
      title,
      is_cancelled,
      artist:artists(
        name,
        genre
      )
    `
    )
    .order("event_date", { ascending: true });

  if (error) {
    console.error("[Events] list error:", error);
  }

  const events: EventRow[] = data ?? [];

  const formatDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatTimeRange = (start: string | null, end: string | null) => {
    if (!start) return "—";
    const toTime = (t: string) =>
      new Date(`1970-01-01T${t}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

    const startLabel = toTime(start);
    const endLabel = end ? toTime(end) : "";
    return endLabel ? `${startLabel} – ${endLabel}` : startLabel;
  };

  return (
    <DashboardShell
      title="Events"
      subtitle="These dates drive the Tonight screen and Calendar in the app."
      activeTab="events"
      primaryAction={{ label: "Add event", href: "/events/new" }}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/70">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-300">
                Date
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">
                Time
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">
                Artist
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">
                Genre
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">
                Title
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
            {events.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  No events found. Use{" "}
                  <span className="font-semibold text-slate-200">
                    “Add event”
                  </span>{" "}
                  to schedule the first show.
                </td>
              </tr>
            ) : (
              events.map((event) => {
                const artistName = event.artist?.name ?? "Unknown artist";
                const artistGenre =
                  event.genre_override ?? event.artist?.genre ?? "—";

                return (
                  <tr key={event.id} className="hover:bg-slate-900/60">
                    <td className="px-4 py-3 text-slate-100">
                      {formatDate(event.event_date)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatTimeRange(event.start_time, event.end_time)}
                    </td>
                    <td className="px-4 py-3 text-slate-100">{artistName}</td>
                    <td className="px-4 py-3 text-slate-300">{artistGenre}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {event.title ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          event.is_cancelled
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-emerald-500/15 text-emerald-300",
                        ].join(" ")}
                      >
                        {event.is_cancelled ? "Cancelled" : "Scheduled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/events/${event.id}`}
                        className="text-sm font-medium text-[#ffc800] hover:underline"
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
    </DashboardShell>
  );
}
