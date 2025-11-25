import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type EventRecord = {
  id: string;
  artist_id: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  genre_override: string | null;
  notes: string | null;
  is_cancelled: boolean;
};

async function updateEvent(id: string, formData: FormData) {
  "use server";

  const artist_id = (formData.get("artist_id") || "").toString().trim();
  const event_date = (formData.get("event_date") || "").toString().trim();
  const start_time_raw = (formData.get("start_time") || "")
    .toString()
    .trim();
  const title = (formData.get("title") || "").toString().trim() || null;
  const genre_override =
    (formData.get("genre_override") || "").toString().trim() || null;
  const notes = (formData.get("notes") || "").toString().trim() || null;
  const is_cancelled = formData.get("is_cancelled") === "on";

  if (!artist_id || !event_date) {
    return;
  }

  const start_time = start_time_raw ? `${start_time_raw}:00` : null;

  const { error } = await supabaseServer
    .from("artist_events")
    .update({
      artist_id,
      event_date,
      start_time,
      title,
      genre_override,
      notes,
      is_cancelled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[Events] update error:", error);
  }

  revalidatePath("/events");
  redirect("/events");
}

export default async function EditEventPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  const [{ data: eventData, error: eventError }, { data: artists }] =
    await Promise.all([
      supabaseServer
        .from("artist_events")
        .select(
          "id, artist_id, event_date, start_time, end_time, title, genre_override, notes, is_cancelled"
        )
        .eq("id", id)
        .single(),
      supabaseServer
        .from("artists")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

  if (eventError || !eventData) {
    console.error("[Events] load event error:", eventError);
    notFound();
  }

  const event = eventData as EventRecord;
  const artistOptions = artists ?? [];

  const startTimeValue = event.start_time
    ? event.start_time.slice(0, 5) // "HH:MM"
    : "";

  async function action(formData: FormData) {
    "use server";
    await updateEvent(id, formData);
  }

  return (
    <DashboardShell
      title="Edit event"
      subtitle="Update details for this show."
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 max-w-xl">
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
              Artist
            </label>
            <select
              name="artist_id"
              required
              defaultValue={event.artist_id}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {artistOptions.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
                Date
              </label>
              <input
                type="date"
                name="event_date"
                required
                defaultValue={event.event_date}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
                Start time
              </label>
              <input
                type="time"
                name="start_time"
                defaultValue={startTimeValue}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
              Event title (optional)
            </label>
            <input
              name="title"
              defaultValue={event.title ?? ""}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
              Genre label (optional)
            </label>
            <input
              name="genre_override"
              defaultValue={event.genre_override ?? ""}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={event.notes ?? ""}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                name="is_cancelled"
                defaultChecked={event.is_cancelled}
                className="rounded border-slate-300"
              />
              Mark as cancelled
            </label>

            <div className="flex gap-2">
              <a
                href="/events"
                className="text-xs px-3 py-1.5 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </a>
              <button
                type="submit"
                className="text-xs px-4 py-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold shadow-sm"
              >
                Save changes
              </button>
            </div>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}
