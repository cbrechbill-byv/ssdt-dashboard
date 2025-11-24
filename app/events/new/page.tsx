import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

async function createEvent(formData: FormData) {
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

  const start_time = start_time_raw ? `${start_time_raw}:00` : null; // "HH:MM" -> "HH:MM:00"

  const { error } = await supabaseServer.from("artist_events").insert({
    artist_id,
    event_date,
    start_time,
    title,
    genre_override,
    notes,
    is_cancelled,
  });

  if (error) {
    console.error("[Events] create error:", error);
  }

  revalidatePath("/events");
  redirect("/events");
}

export default async function NewEventPage() {
  const { data: artists, error } = await supabaseServer
    .from("artists")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[Events] load artists error:", error);
  }

  const artistOptions = artists ?? [];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <DashboardShell
      title="Add event"
      subtitle="Schedule a new show for Sugarshack Downtown."
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 max-w-xl">
        <form action={createEvent} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
              Artist
            </label>
            <select
              name="artist_id"
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Select an artist
              </option>
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
                defaultValue={today}
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
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Live Mic Night, Acoustic Sessions…"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
              Genre label (optional)
            </label>
            <input
              name="genre_override"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="If blank, uses the artist's genre."
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
              Notes (optional)
            </label>
            <textarea
              name="notes"
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Special guests, debut show, etc."
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                name="is_cancelled"
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
                Save event
              </button>
            </div>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}
