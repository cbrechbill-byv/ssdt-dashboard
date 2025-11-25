import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type EventRecord = {
  id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_cancelled: boolean;
  genre_override: string | null;
  title: string | null;
  notes: string | null;
  artist: { name: string | null; genre: string | null }[] | null;
};

type EventPageProps = {
  params: { id: string };
};

function toInputDate(isoDate: string | null): string {
  if (!isoDate) return "";
  return isoDate.slice(0, 10);
}

function toInputTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  if (!h || !m) return "";
  return `${h}:${m}`;
}

async function updateEvent(formData: FormData) {
  "use server";

  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing event id");

  const eventDate = formData.get("event_date")?.toString() || null;
  const start = formData.get("start_time")?.toString() || null;
  const end = formData.get("end_time")?.toString() || null;
  const title = formData.get("title")?.toString().trim() || null;
  const notes = formData.get("notes")?.toString().trim() || null;
  const genreOverride =
    formData.get("genre_override")?.toString().trim() || null;
  const isCancelled = formData.get("is_cancelled") === "on";

  const { error } = await supabaseServer
    .from("artist_events")
    .update({
      event_date: eventDate,
      start_time: start,
      end_time: end,
      title,
      notes,
      genre_override: genreOverride,
      is_cancelled: isCancelled,
    })
    .eq("id", id);

  if (error) {
    console.error("[Events] update error:", error);
    throw error;
  }

  revalidatePath("/events");
  redirect("/events");
}

export default async function EventEditPage({ params }: EventPageProps) {
  const { id } = params;

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
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[Events] not found:", error);
    notFound();
  }

  const event = data as EventRecord;
  const primaryArtist =
    event.artist && event.artist.length > 0 ? event.artist[0] : null;

  return (
    <DashboardShell
      title="Edit event"
      subtitle="Update details for this show."
      activeTab="events"
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm max-w-xl">
        <form action={updateEvent} className="space-y-4">
          <input type="hidden" name="id" value={event.id} />

          {/* Artist (read-only) */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Artist
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {primaryArtist?.name || "Unknown artist"}
            </p>
            {primaryArtist?.genre && (
              <p className="text-xs text-slate-500">
                Default genre: {primaryArtist.genre}
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label
              htmlFor="event_date"
              className="text-xs font-semibold text-slate-700"
            >
              Date
            </label>
            <input
              id="event_date"
              name="event_date"
              type="date"
              defaultValue={toInputDate(event.event_date)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          {/* Time range */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="start_time"
                className="text-xs font-semibold text-slate-700"
              >
                Start time
              </label>
              <input
                id="start_time"
                name="start_time"
                type="time"
                defaultValue={toInputTime(event.start_time)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="end_time"
                className="text-xs font-semibold text-slate-700"
              >
                End time
              </label>
              <input
                id="end_time"
                name="end_time"
                type="time"
                defaultValue={toInputTime(event.end_time)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label
              htmlFor="title"
              className="text-xs font-semibold text-slate-700"
            >
              Show title (optional)
            </label>
            <input
              id="title"
              name="title"
              defaultValue={event.title ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="e.g. Live on the Lawn"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label
              htmlFor="notes"
              className="text-xs font-semibold text-slate-700"
            >
              Notes (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={event.notes ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="e.g. Special guests, merch, etc."
            />
          </div>

          {/* Genre override + Cancelled */}
          <div className="grid gap-4 sm:grid-cols-[2fr,1fr]">
            <div className="space-y-1">
              <label
                htmlFor="genre_override"
                className="text-xs font-semibold text-slate-700"
              >
                Genre override (optional)
              </label>
              <input
                id="genre_override"
                name="genre_override"
                defaultValue={event.genre_override ?? ""}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="If set, replaces the default genre for Tonight/Calendar."
              />
            </div>

            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  name="is_cancelled"
                  defaultChecked={event.is_cancelled}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                />
                Cancelled
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <a
              href="/events"
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </a>
            <button
              type="submit"
              className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-amber-500"
            >
              Save changes
            </button>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}
