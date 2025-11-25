import { notFound } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type EventRecord = {
  id: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  notes: string | null;
  is_cancelled: boolean | null;
  genre_override: string | null;
};

type EventDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function EventDetailPage({
  params,
}: EventDetailPageProps) {
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, event_date, start_time, end_time, title, notes, is_cancelled, genre_override"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    console.error("Error loading event:", error);
    notFound();
  }

  if (!data) {
    notFound();
  }

  const event = data as EventRecord;

  return (
    <DashboardShell
      title="Edit event"
      subtitle="Event editing from the dashboard will be expanded, but here are the current details from Supabase."
      activeTab="events"
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 max-w-xl">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {event.title || "Untitled event"}
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {event.event_date} ·{" "}
            {event.start_time || "No time"}
            {event.end_time ? ` – ${event.end_time}` : ""}
            {event.is_cancelled ? " · CANCELLED" : ""}
          </p>
        </div>

        <div className="space-y-2 text-xs text-slate-700">
          <div>
            <span className="font-semibold text-slate-800">Genre override: </span>
            <span>{event.genre_override || "—"}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-800">Notes: </span>
            <span>{event.notes || "—"}</span>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[11px] text-slate-500">
            This page confirms the event record is wired correctly. We can
            later layer in full editing controls similar to the “Add event”
            form once everything else is stable.
          </p>
        </div>
      </section>
    </DashboardShell>
  );
}
