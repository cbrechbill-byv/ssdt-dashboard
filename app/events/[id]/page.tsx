import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type EventRow = {
  id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_cancelled: boolean;
  genre_override: string | null;
  title: string | null;
  notes: string | null;
};

function extractIdFromParams(
  params: Record<string, string | string[]>
): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return "";
  const [, raw] = entries[0];
  if (Array.isArray(raw)) {
    return raw[0] ?? "";
  }
  return raw ?? "";
}

async function fetchEvent(id: string): Promise<{
  event: EventRow | null;
  errorMessage: string | null;
}> {
  if (!id) {
    return { event: null, errorMessage: "No event id provided in route." };
  }

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
      notes
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[Event edit] load error:", error);
    return {
      event: null,
      errorMessage: error.message,
    };
  }

  if (!data) {
    return {
      event: null,
      errorMessage: "No event found for this id.",
    };
  }

  return {
    event: data as EventRow,
    errorMessage: null,
  };
}

function isoDateToInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function timeToInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

export default async function EventEditPage({
  params,
}: {
  params: Record<string, string | string[]>;
}) {
  const id = extractIdFromParams(params);
  const { event, errorMessage } = await fetchEvent(id);

  async function updateEvent(formData: FormData) {
    "use server";

    const id = formData.get("id")?.toString() ?? "";

    const event_date = formData.get("event_date")?.toString() || null;
    const start_time_raw = formData.get("start_time")?.toString() || "";
    const end_time_raw = formData.get("end_time")?.toString() || "";

    const start_time = start_time_raw ? `${start_time_raw}:00` : null;
    const end_time = end_time_raw ? `${end_time_raw}:00` : null;

    const title = formData.get("title")?.toString().trim() || null;
    const genre_override =
      formData.get("genre_override")?.toString().trim() || null;
    const notes = formData.get("notes")?.toString().trim() || null;

    const is_cancelled_value = formData.get("is_cancelled");
    const is_cancelled = is_cancelled_value === "on";

    if (!id) {
      throw new Error("Event id is required.");
    }

    const { error } = await supabaseServer
      .from("artist_events")
      .update({
        event_date,
        start_time,
        end_time,
        title,
        genre_override,
        notes,
        is_cancelled,
      })
      .eq("id", id);

    if (error) {
      console.error("[Event edit] update error:", error);
      throw error;
    }

    revalidatePath("/events");
    redirect("/events");
  }

  if (!event) {
    return (
      <DashboardShell
        title="Edit event"
        subtitle="Unable to load event"
        activeTab="events"
      >
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800 space-y-2">
          <p className="font-semibold">Could not load event</p>
          <p>
            Route id:&nbsp;
            <code className="font-mono text-xs">
              {id || "(missing or undefined)"}
            </code>
          </p>
          <p className="text-xs">
            Route params:&nbsp;
            <code className="font-mono text-[10px]">
              {JSON.stringify(params)}
            </code>
          </p>
          {errorMessage && (
            <p className="text-xs">
              Supabase error:{" "}
              <span className="font-mono">{errorMessage}</span>
            </p>
          )}
          <a
            href="/events"
            className="mt-2 inline-flex items-center rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
          >
            Back to events
          </a>
        </section>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Edit event"
      subtitle={event.title || "Untitled event"}
      activeTab="events"
    >
      <form action={updateEvent} className="space-y-4">
        <input type="hidden" name="id" defaultValue={event.id} />

        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Event details
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Update the title, date, time, and notes for this show.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="event_date"
                className="text-xs font-medium text-slate-800"
              >
                Date
              </label>
              <input
                id="event_date"
                name="event_date"
                type="date"
                defaultValue={isoDateToInput(event.event_date)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="start_time"
                  className="text-xs font-medium text-slate-800"
                >
                  Start time
                </label>
                <input
                  id="start_time"
                  name="start_time"
                  type="time"
                  defaultValue={timeToInput(event.start_time)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="end_time"
                  className="text-xs font-medium text-slate-800"
                >
                  End time
                </label>
                <input
                  id="end_time"
                  name="end_time"
                  type="time"
                  defaultValue={timeToInput(event.end_time)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label
                htmlFor="title"
                className="text-xs font-medium text-slate-800"
              >
                Title (optional)
              </label>
              <input
                id="title"
                name="title"
                defaultValue={event.title ?? ""}
                placeholder="Event title shown in the app"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label
                htmlFor="genre_override"
                className="text-xs font-medium text-slate-800"
              >
                Genre override (optional)
              </label>
              <input
                id="genre_override"
                name="genre_override"
                defaultValue={event.genre_override ?? ""}
                placeholder="Use this if tonight's vibe differs from the artist's default genre."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label
                htmlFor="notes"
                className="text-xs font-medium text-slate-800"
              >
                Internal notes
              </label>
              <textarea
                id="notes"
                name="notes"
                defaultValue={event.notes ?? ""}
                rows={3}
                placeholder="Optional notes about this show (guests, special sets, etc.)."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-800">
              Event status
            </p>
            <p className="text-[11px] text-slate-500">
              Cancelled shows will still appear in history but flagged as
              cancelled.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="is_cancelled"
              name="is_cancelled"
              type="checkbox"
              defaultChecked={event.is_cancelled}
              className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
            <label
              htmlFor="is_cancelled"
              className="text-xs font-medium text-slate-800"
            >
              Mark this event as cancelled
            </label>
          </div>
        </section>

        <div className="flex flex-wrap justify-between gap-3">
          <a
            href="/events"
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-amber-400"
          >
            Save changes
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
