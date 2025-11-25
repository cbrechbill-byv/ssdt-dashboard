import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type EventRow = {
  id: string;
  event_date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM:SS
  end_time: string | null;   // HH:MM:SS
  title: string | null;
  is_cancelled: boolean | null;
};

export const dynamic = "force-dynamic";

function formatTime(hhmmss: string | null): string | null {
  if (!hhmmss) return null;
  const [hourStr, minuteStr] = hhmmss.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeRange(start: string | null, end: string | null): string {
  const startFormatted = formatTime(start);
  const endFormatted = formatTime(end);

  if (startFormatted && endFormatted) {
    return `${startFormatted} – ${endFormatted}`;
  }
  if (startFormatted) return startFormatted;
  if (endFormatted) return endFormatted;
  return "Time TBD";
}

export default async function EventsPage() {
  // supabaseServer is already a client instance – do NOT call it
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("events")
    .select("id, event_date, start_time, end_time, title, is_cancelled")
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("[Events] load error:", error);
  }

  const events: EventRow[] = (data ?? []) as EventRow[];

  return (
    <DashboardShell
      title="Events"
      subtitle="Manage shows that appear on the Tonight screen and Calendar."
      activeTab="events"
    >
      <div className="space-y-6">
        {/* Header with Add button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Upcoming shows
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Edit dates, times, and details for Sugarshack Downtown events.
            </p>
          </div>
          <Link
            href="/events/new"
            className="inline-flex items-center rounded-full bg-[#ffc800] px-4 py-2 text-xs font-semibold text-black shadow hover:bg-[#e6b400]"
          >
            + Add event
          </Link>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase tracking-[0.14em] text-slate-400">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-xs text-slate-400"
                  >
                    No events found yet. Use &ldquo;Add event&rdquo; to create
                    your first show.
                  </td>
                </tr>
              ) : (
                events.map((evt) => {
                  const dateLabel = new Date(
                    evt.event_date + "T00:00:00"
                  ).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  const timeLabel = formatTimeRange(
                    evt.start_time,
                    evt.end_time
                  );

                  return (
                    <tr
                      key={evt.id}
                      className="border-t border-slate-800/80 hover:bg-slate-900/40"
                    >
                      <td className="px-4 py-3 text-slate-50">{dateLabel}</td>
                      <td className="px-4 py-3 text-slate-200">{timeLabel}</td>
                      <td className="px-4 py-3 text-slate-50">
                        {evt.title || (
                          <span className="text-slate-500 italic">
                            Untitled show
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            evt.is_cancelled
                              ? "bg-red-500/15 text-red-300"
                              : "bg-emerald-500/15 text-emerald-300",
                          ].join(" ")}
                        >
                          {evt.is_cancelled ? "Cancelled" : "Scheduled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/events/${evt.id}`}
                          className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-900"
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
      </div>
    </DashboardShell>
  );
}
