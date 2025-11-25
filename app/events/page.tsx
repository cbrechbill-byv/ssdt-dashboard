import React from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type EventRecord = {
  id: string;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  title?: string | null;
  genre_label?: string | null;
  notes?: string | null;
  status?: string | null;
  artist_name?: string | null;
};

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  // Very simple: grab all rows from `events`, no filters
  const { data, error } = await supabaseServer
    .from("events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error loading events:", error);
  }

  const events: EventRecord[] = (data ?? []) as EventRecord[];

  return (
    <DashboardShell
      title="Events"
      subtitle="Manage shows that appear on the Tonight screen and Calendar."
      activeTab="events"
    >
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              Upcoming shows
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Edit dates, times, and details for Sugarshack Downtown events.
            </p>
          </div>

          <Link
            href="/events/new"
            className="inline-flex items-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-amber-300"
          >
            + Add event
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/60">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Artist
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60 bg-slate-950/40">
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-slate-400"
                  >
                    No events found yet. Use{" "}
                    <span className="font-semibold">“Add event”</span> to create
                    your first show.
                  </td>
                </tr>
              ) : (
                events.map((event) => {
                  const dateLabel =
                    event.event_date &&
                    new Date(event.event_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

                  const timeLabel = [
                    event.start_time,
                    event.end_time ? `– ${event.end_time}` : null,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  const statusLabel = event.status ?? "Scheduled";

                  return (
                    <tr key={event.id}>
                      <td className="px-6 py-3 align-middle text-sm text-slate-50">
                        {dateLabel || "—"}
                      </td>
                      <td className="px-6 py-3 align-middle text-sm text-slate-50">
                        {timeLabel || "—"}
                      </td>
                      <td className="px-6 py-3 align-middle text-sm text-slate-50">
                        {event.artist_name || "Unknown artist"}
                      </td>
                      <td className="px-6 py-3 align-middle text-sm text-slate-50">
                        {event.title || "—"}
                      </td>
                      <td className="px-6 py-3 align-middle">
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/40">
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-3 align-middle text-right">
                        <Link
                          href={`/events/${event.id}`}
                          className="text-xs font-semibold text-amber-300 hover:text-amber-200"
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
