import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type EventRow = {
  id: string;
  event_date: string;
  start_time: string | null;
  is_cancelled: boolean;
  genre_override: string | null;
  title: string | null;
  notes: string | null;
  artist: {
    name: string;
    genre: string | null;
  } | null;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return "";
  // assume "HH:MM:SS" from Postgres
  const [hour, minute] = timeStr.split(":");
  const d = new Date();
  d.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function EventsPage() {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseServer
    .from("artist_events")
    .select(
      "id, event_date, start_time, is_cancelled, genre_override, title, notes, artist:artists(name, genre)"
    )
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
            No upcoming events. Click &ldquo;Add event&rdquo; to schedule your
            first show.
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
                  <th className="py-2 text-right font-semibold">Status</th>
                  <th className="py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => {
                  const dateLabel = formatDate(evt.event_date);
                  const timeLabel = formatTime(evt.start_time);
                  const genre =
                    evt.genre_override || evt.artist?.genre || "—";

                  return (
                    <tr
                      key={evt.id}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="py-2 pr-3 text-[13px] text-slate-900">
                        {dateLabel}
                      </td>
                      <td className="py-2 pr-3 text-[13px] text-slate-700">
                        {timeLabel || "—"}
                      </td>
                      <td className="py-2 pr-3 text-[13px] text-slate-900">
                        {evt.artist?.name || "Unknown artist"}
                      </td>
                      <td className="py-2 pr-3 text-[13px] text-slate-700">
                        {genre}
                      </td>
                      <td className="py-2 pr-3 text-[13px] text-slate-700">
                        {evt.title || "—"}
                      </td>
                      <td className="py-2 pr-3 text-[13px] text-slate-500 max-w-xs truncate">
                        {evt.notes || ""}
                      </td>
                      <td className="py-2 pr-3 text-right text-[13px]">
                        <span
                          className={
                            evt.is_cancelled
                              ? "inline-flex rounded-full bg-rose-50 text-rose-700 px-2 py-0.5 text-[11px] font-semibold"
                              : "inline-flex rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold"
                          }
                        >
                          {evt.is_cancelled ? "Cancelled" : "Scheduled"}
                        </span>
                      </td>
                      <td className="py-2 text-right text-[13px]">
                        <Link
                          href={`/events/${evt.id}`}
                          className="text-xs font-medium text-slate-900 hover:underline"
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
