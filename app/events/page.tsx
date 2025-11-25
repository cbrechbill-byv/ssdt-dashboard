import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type EventArtist = {
  name: string | null;
  genre: string | null;
};

type EventRow = {
  id: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  is_cancelled: boolean;
  genre_override: string | null;
  title: string | null;
  notes: string | null;
  artist: EventArtist[] | null; // Supabase returns an array here
};

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(isoTime: string | null): string {
  if (!isoTime) return "—";
  // Expecting "HH:MM:SS" or "HH:MM" from Postgres
  const [h, m] = isoTime.split(":");
  if (!h || !m) return isoTime;
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeRange(start: string | null, end: string | null): string {
  const startLabel = formatTime(start);
  const endLabel = formatTime(end);
  if (start && end) return `${startLabel}–${endLabel}`;
  if (start) return startLabel;
  return "TBD";
}

export default async function EventsPage() {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseServer
    .from("artist_events")
    .select(
      `
      id,
      event_date,
      start_time,
      end_time,
      is_cancelled,
      genre_override,
      title,
      notes,
      artist:artists (
        name,
        genre
      )
    `
    )
    // Only show events that have a start time
    .not("start_time", "is", null)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("[Events] load error:", error);
  }

  const events = (data ?? []) as EventRow[];

  return (
    <DashboardShell
      title="Events"
      subtitle="Manage the Sugarshack Downtown live music calendar."
      activeTab="events"
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              Upcoming shows
            </p>
            <p className="mt-1 text-xs text-slate-500">
              These dates drive the Tonight screen and Calendar in the app.
            </p>
          </div>
          <Link
            href="/events/new"
            className="inline-flex items-center rounded-full bg-amber-400 hover:bg-amber-500 text-slate-900 text-xs font-semibold px-3 py-1.5 shadow-sm"
          >
            + Add event
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="text-xs text-slate-400">
            No upcoming events with times set. Click &ldquo;Add event&rdquo; to
            schedule your first show.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3 text-left font-semibold">Date</th>
                  <th className="py-2 pr-3 text-left font-semibold">Time</th>
                  <th className="py-2 pr-3 text-left font-semibold">Artist</th>
                  <th className="py-2 pr-3 text-left font-semibold">Genre</th>
                  <th className="py-2 pr-3 text-left font-semibold">Title</th>
                  <th className="py-2 pr-3 text-left font-semibold">Notes</th>
                  <th className="py-2 pr-3 text-right font-semibold">
                    Status
                  </th>
                  <th className="py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => {
                  const dateLabel = formatDate(evt.event_date);
                  const timeLabel = formatTimeRange(
                    evt.start_time,
                    evt.end_time
                  );

                  const primaryArtist =
                    evt.artist && evt.artist.length > 0
                      ? evt.artist[0]
                      : null;

                  const artistName =
                    primaryArtist?.name || "Unknown artist";
                  const genre =
                    evt.genre_override || primaryArtist?.genre || "—";

                  const statusLabel = evt.is_cancelled
                    ? "Cancelled"
                    : "Scheduled";
                  const statusClass = evt.is_cancelled
                    ? "bg-rose-100 text-rose-700"
                    : "bg-emerald-100 text-emerald-700";

                  return (
                    <tr
                      key={evt.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        {dateLabel}
                      </td>
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        {timeLabel}
                      </td>
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        {artistName}
                      </td>
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        {genre}
                      </td>
                      <td className="py-2 pr-3 align-top">
                        {evt.title || "—"}
                      </td>
                      <td className="py-2 pr-3 align-top">
                        {evt.notes || "—"}
                      </td>
                      <td className="py-2 pr-3 align-top text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="py-2 pl-3 align-top text-right whitespace-nowrap">
                        <a
                          href={`/events/${evt.id}`}
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
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
