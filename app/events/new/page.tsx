import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { logDashboardEventServer } from "@/lib/logDashboardEventServer";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  // Fetch artists for dropdown
  const { data: artists, error: artistsError } = await supabaseServer
    .from("artists")
    .select("id, name")
    .order("name", { ascending: true });

  if (artistsError) {
    console.error("[Event new] load artists error:", artistsError);
  }

  async function createEvent(formData: FormData) {
    "use server";

    const supabase = supabaseServer;

    // Match the artist_events schema used by the edit page
    const event_date = formData.get("event_date")?.toString() || null;
    const start_time_raw = formData.get("start_time")?.toString() || "";
    const end_time_raw = formData.get("end_time")?.toString() || "";

    // Store as HH:MM:SS just like the edit form does
    const start_time = start_time_raw ? `${start_time_raw}:00` : null;
    const end_time = end_time_raw ? `${end_time_raw}:00` : null;

    const title = formData.get("title")?.toString().trim() || null;
    const genre_override =
      formData.get("genre_override")?.toString().trim() || null;
    const notes = formData.get("notes")?.toString().trim() || null;
    const artist_id = formData.get("artist_id")?.toString() || null;

    if (!event_date) {
      throw new Error("Event date is required.");
    }

    const payload: Record<string, any> = {
      event_date,
      start_time,
      end_time,
      title,
      genre_override,
      notes,
      is_cancelled: false,
    };

    if (artist_id) {
      payload.artist_id = artist_id;
    }

    const { data, error } = await supabase
      .from("artist_events")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      console.error("[Event new] insert error:", error);
      throw new Error(error.message);
    }

    const eventId = data.id;

    // 🔐 AUDIT LOG — CREATE EVENT (keep entity name as "events" for consistency)
    await logDashboardEventServer({
      action: "create",
      entity: "events",
      entityId: eventId,
      details: payload,
    });

    revalidatePath("/events");
    redirect("/events");
  }

  return (
    <DashboardShell
      title="Events"
      subtitle="Create a new Sugarshack Downtown event"
      activeTab="events"
    >
      <form action={createEvent} className="space-y-4 max-w-3xl">
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm space-y-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Event details
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Set the date, time, artist, and notes for this show. These
                details drive Tonight&apos;s Board and the mobile app.
              </p>
            </div>
          </div>

          {/* Date + time */}
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
                required
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>
          </div>

          {/* Title + genre override */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="title"
                className="text-xs font-medium text-slate-800"
              >
                Title (optional)
              </label>
              <input
                id="title"
                name="title"
                placeholder="Event title shown in the app"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="genre_override"
                className="text-xs font-medium text-slate-800"
              >
                Genre override (optional)
              </label>
              <input
                id="genre_override"
                name="genre_override"
                placeholder="If tonight's vibe is different from the artist's default genre."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label
              htmlFor="notes"
              className="text-xs font-medium text-slate-800"
            >
              Internal notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Optional notes about this show (special guests, sets, etc.)."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
            />
          </div>

          {/* Artist */}
          <div className="space-y-1.5">
            <label
              htmlFor="artist_id"
              className="text-xs font-medium text-slate-800"
            >
              Artist (optional)
            </label>
            <select
              id="artist_id"
              name="artist_id"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              defaultValue=""
            >
              <option value="">No artist linked</option>
              {artists?.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {artistsError && (
              <p className="text-[11px] text-rose-500">
                Could not load artists; you can still create the event and link
                later.
              </p>
            )}
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
            Create event
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
