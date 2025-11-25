import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type EventPageProps = {
  params: {
    id: string;
  };
};

type EventRecord = {
  id: string;
  event_date: string; // ISO date string (YYYY-MM-DD)
  start_time: string | null; // 'HH:MM:SS'
  end_time: string | null; // 'HH:MM:SS'
  title: string | null;
  notes: string | null;
  genre_override: string | null;
  is_cancelled: boolean | null;
};

export const dynamic = "force-dynamic";

export default async function EventEditPage({ params }: EventPageProps) {
  const supabase = supabaseServer;
  const { id } = params;

  const { data: event, error } = await supabase
    .from("events")
    .select(
      `
      id,
      event_date,
      start_time,
      end_time,
      title,
      notes,
      genre_override,
      is_cancelled
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[Event Edit] load error:", error);
  }

  if (!event) {
    notFound();
  }

  async function updateEvent(formData: FormData) {
    "use server";

    const supabase = supabaseServer;

    const id = formData.get("id") as string;
    const event_date = formData.get("event_date") as string;
    const start_time = (formData.get("start_time") as string) || null;
    const end_time = (formData.get("end_time") as string) || null;
    const title = ((formData.get("title") as string) || "").trim() || null;
    const notes = ((formData.get("notes") as string) || "").trim() || null;
    const genre_override =
      ((formData.get("genre_override") as string) || "").trim() || null;
    const is_cancelled = formData.get("is_cancelled") === "on";

    if (!id || !event_date) {
      return;
    }

    const { error: updateError } = await supabase
      .from("events")
      .update({
        event_date,
        start_time,
        end_time,
        title,
        notes,
        genre_override,
        is_cancelled,
      })
      .eq("id", id);

    if (updateError) {
      console.error("[Event Edit] update error:", updateError);
      return;
    }

    revalidatePath("/events");
    revalidatePath(`/events/${id}`);
    redirect("/events");
  }

  const startTimeValue = event.start_time
    ? event.start_time.slice(0, 5) // "HH:MM"
    : "";
  const endTimeValue = event.end_time ? event.end_time.slice(0, 5) : "";

  return (
    <DashboardShell
      title="Edit event"
      subtitle="Update details for this show."
      activeTab="events"
    >
      <form action={updateEvent} className="space-y-6 max-w-2xl">
        <input type="hidden" name="id" value={event.id} />

        {/* Basics */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Event basics
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Date and time are used for Tonight and Calendar in the app.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="event_date"
                className="text-xs font-medium text-slate-200"
              >
                Date
              </label>
              <input
                id="event_date"
                name="event_date"
                type="date"
                defaultValue={event.event_date}
                required
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="start_time"
                  className="text-xs font-medium text-slate-200"
                >
                  Start time
                </label>
                <input
                  id="start_time"
                  name="start_time"
                  type="time"
                  defaultValue={startTimeValue}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="end_time"
                  className="text-xs font-medium text-slate-200"
                >
                  End time
                </label>
                <input
                  id="end_time"
                  name="end_time"
                  type="time"
                  defaultValue={endTimeValue}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="is_cancelled"
                name="is_cancelled"
                type="checkbox"
                defaultChecked={event.is_cancelled ?? false}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-400"
              />
              <label
                htmlFor="is_cancelled"
                className="text-xs text-slate-200 select-none"
              >
                Mark event as cancelled
              </label>
            </div>
          </div>
        </section>

        {/* Title & genre */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Title & genre
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Optional title and genre override for this specific show.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="title"
                className="text-xs font-medium text-slate-200"
              >
                Event title
              </label>
              <input
                id="title"
                name="title"
                defaultValue={event.title ?? ""}
                placeholder="Landon McNamara – Full band show"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="genre_override"
                className="text-xs font-medium text-slate-200"
              >
                Genre override
              </label>
              <input
                id="genre_override"
                name="genre_override"
                defaultValue={event.genre_override ?? ""}
                placeholder="If set, replaces the artist’s default genre for this show."
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">Notes</h2>
            <p className="mt-1 text-xs text-slate-400">
              Internal notes or special info about this show.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="notes"
              className="text-xs font-medium text-slate-200"
            >
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={event.notes ?? ""}
              className="resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-400"
            />
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              history.back();
            }}
            className="inline-flex items-center rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-[#ffc800] px-4 py-2 text-xs font-semibold text-black shadow hover:bg-[#e6b400]"
          >
            Save changes
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
