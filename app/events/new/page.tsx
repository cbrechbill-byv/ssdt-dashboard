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
  const end_time_raw = (formData.get("end_time") || "")
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

  // HTML <input type="time" /> is "HH:MM" – Supabase expects "HH:MM:SS"
  const normalizeTime = (value: string) =>
    value ? `${value}:00` : null;

  const start_time = normalizeTime(start_time_raw);
  const end_time = normalizeTime(end_time_raw);

  const { error } = await supabaseServer.from("artist_events").insert({
    artist_id,
    event_date,
    start_time,
    end_time,
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

            <div className="grid gap-2">
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
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
                  End time
                </label>
                <input
                  type="time"
                  name="end_time"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
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
``` :contentReference[oaicite:0]{index=0}  

---

## 2) `app/events/[id]/page.tsx` – Edit event with **end time**

Replace the entire file with:

```tsx
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
  const end_time_raw = (formData.get("end_time") || "")
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

  const normalizeTime = (value: string) =>
    value ? `${value}:00` : null;

  const start_time = normalizeTime(start_time_raw);
  const end_time = normalizeTime(end_time_raw);

  const { error } = await supabaseServer
    .from("artist_events")
    .update({
      artist_id,
      event_date,
      start_time,
      end_time,
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
    ? event.start_time.slice(0, 5)
    : "";
  const endTimeValue = event.end_time ? event.end_time.slice(0, 5) : "";

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

            <div className="grid gap-2">
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
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.12em] mb-1">
                  End time
                </label>
                <input
                  type="time"
                  name="end_time"
                  defaultValue={endTimeValue}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
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
``` :contentReference[oaicite:1]{index=1}  

---

## 3) `app/events/page.tsx` – Events list with working **Edit** links

This version:

- Loads events and artists from Supabase.
- Builds a map so we always have the artist name/genre.
- Shows **start–end** time like `7:00–10:00 PM`.
- Makes the **Edit** button a real link to `/events/[id]`.

Replace the **entire** `app/events/page.tsx` with:

```tsx
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type EventRow = {
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

function formatTimeLabel(start: string | null, end: string | null): string {
  const fmt = (t: string) => {
    const [hStr, mStr] = t.split(":");
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const suffix = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m.toString().padStart(2, "0")}${suffix}`;
  };

  const clean = (t: string | null) =>
    t ? fmt(t.slice(0, 5)) : null; // "HH:MM:SS" -> "HH:MM" -> 12-hr

  const s = clean(start);
  const e = clean(end);

  if (s && e) return `${s}–${e}`;
  if (s) return s;
  return "—";
}

export default async function EventsPage() {
  const [{ data: events, error: eventsError }, { data: artists, error: artistsError }] =
    await Promise.all([
      supabaseServer
        .from("artist_events")
        .select(
          "id, artist_id, event_date, start_time, end_time, title, genre_override, notes, is_cancelled"
        )
        .order("event_date", { ascending: true }),
      supabaseServer
        .from("artists")
        .select("id, name, genre, is_active")
        .order("name", { ascending: true }),
    ]);

  if (eventsError) {
    console.error("[Events] load events error:", eventsError);
  }
  if (artistsError) {
    console.error("[Events] load artists error:", artistsError);
  }

  const artistMap =
    artists?.reduce(
      (acc, a) => {
        acc[a.id] = a;
        return acc;
      },
      {} as Record<
        string,
        { id: string; name: string; genre: string | null; is_active: boolean }
      >
    ) ?? {};

  const rows: EventRow[] = (events ?? []) as EventRow[];

  return (
    <DashboardShell
      title="Events"
      subtitle="Manage the Sugarshack Downtown live music calendar."
      primaryAction={{
        label: "Add event",
        href: "/events/new",
      }}
      activeTab="events"
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 overflow-x-auto">
        <div className="text-[11px] text-slate-500 mb-3">
          These dates drive the Tonight screen and Calendar in the app.
        </div>

        <table className="w-full text-left text-xs border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Time</th>
              <th className="py-2 pr-4">Artist</th>
              <th className="py-2 pr-4">Genre</th>
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Notes</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pl-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((event, idx) => {
              const artist = artistMap[event.artist_id];
              const artistName = artist?.name ?? "Unknown artist";
              const genre =
                event.genre_override || artist?.genre || "—";
              const status = event.is_cancelled ? "Cancelled" : "Scheduled";

              // Nice striped rows
              const rowClass =
                idx % 2 === 0 ? "bg-white" : "bg-slate-50/60";

              return (
                <tr
                  key={event.id}
                  className={`${rowClass} border-b border-slate-100 last:border-0`}
                >
                  <td className="py-2 pr-4 align-top whitespace-nowrap">
                    {new Date(event.event_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-2 pr-4 align-top whitespace-nowrap">
                    {formatTimeLabel(event.start_time, event.end_time)}
                  </td>
                  <td className="py-2 pr-4 align-top whitespace-nowrap">
                    {artistName}
                  </td>
                  <td className="py-2 pr-4 align-top whitespace-nowrap">
                    {genre}
                  </td>
                  <td className="py-2 pr-4 align-top">
                    {event.title || "—"}
                  </td>
                  <td className="py-2 pr-4 align-top">
                    {event.notes || "—"}
                  </td>
                  <td className="py-2 pr-4 align-top whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        event.is_cancelled
                          ? "bg-rose-100 text-rose-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="py-2 pl-4 align-top text-right whitespace-nowrap">
                    <a
                      href={`/events/${event.id}`}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                    >
                      Edit
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </DashboardShell>
  );
}
