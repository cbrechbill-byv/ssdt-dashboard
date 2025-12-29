// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\events\edit\page.tsx
// app/events/edit/page.tsx
// Path: /events/edit?id=...
// Purpose: Edit a scheduled event (date/time/artist/title/notes/cancelled).
// Sprint 7: Add ability to change the linked artist on edit.
// Keeps: Timezone-safe defaults + validate end_time >= start_time (same-day) + store HH:MM:SS.
// Sprint 9: Add optional event image upload (stored in public `events` bucket) using same UX as artists.

export const dynamic = "force-dynamic";

import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logDashboardEventServer } from "@/lib/logDashboardEventServer";
import EventImageUploader from "@/components/events/EventImageUploader";

type EventRow = {
  id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_cancelled: boolean;
  genre_override: string | null;
  title: string | null;
  notes: string | null;
  details: string | null;
  artist_id: string | null;
  image_path: string | null; // ✅ NEW
};

type ArtistOption = {
  id: string;
  name: string | null;
};

const ET_TZ = "America/New_York";

function getIdFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): string {
  const raw = searchParams.id;
  if (!raw) return "";
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw;
}

function publicUrlFromStoragePath(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;

  const parts = path.split("/");
  if (parts.length < 2) return null;

  const bucket = parts[0];
  const key = parts.slice(1).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${key}`;
}

async function fetchEvent(id: string): Promise<{
  event: EventRow | null;
  errorMessage: string | null;
}> {
  if (!id) {
    return {
      event: null,
      errorMessage: "No event id provided in query (?id=…).",
    };
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
      notes,
      details,
      artist_id,
      image_path
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[Event edit] load error:", error);
    return { event: null, errorMessage: error.message };
  }

  if (!data) {
    return { event: null, errorMessage: "No event found for this id." };
  }

  return { event: data as EventRow, errorMessage: null };
}

async function fetchArtists(): Promise<{
  artists: ArtistOption[];
  errorMessage: string | null;
}> {
  const { data, error } = await supabaseServer
    .from("artists")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("[Event edit] load artists error:", error);
    return { artists: [], errorMessage: error.message };
  }

  return { artists: (data ?? []) as ArtistOption[], errorMessage: null };
}

function isoDateToInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function timeToInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

function minutesFromHm(hm: string | null): number | null {
  if (!hm) return null;
  const parts = hm.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function toHmsOrNull(hm: string | null): string | null {
  const v = (hm ?? "").trim();
  if (!v) return null;
  return v.includes(":") && v.split(":").length === 2 ? `${v}:00` : v;
}

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default async function EventEditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const id = getIdFromSearchParams(resolvedSearchParams);

  const [{ event, errorMessage }, { artists, errorMessage: artistsErrorMessage }] =
    await Promise.all([fetchEvent(id), fetchArtists()]);

  async function updateEvent(formData: FormData) {
    "use server";

    const eventId = formData.get("id")?.toString() ?? "";
    if (!eventId) throw new Error("Event id is required.");

    const event_date = (formData.get("event_date")?.toString() || "").trim();
    if (!event_date) {
      throw new Error("Event date is required.");
    }

    const start_hm = (formData.get("start_time")?.toString() || "").trim();
    const end_hm = (formData.get("end_time")?.toString() || "").trim();

    const startMin = minutesFromHm(start_hm || null);
    const endMin = minutesFromHm(end_hm || null);
    if (startMin !== null && endMin !== null && endMin < startMin) {
      throw new Error("End time cannot be earlier than start time.");
    }

    const start_time = toHmsOrNull(start_hm || null);
    const end_time = toHmsOrNull(end_hm || null);

    const title = formData.get("title")?.toString().trim() || null;
    const genre_override = formData.get("genre_override")?.toString().trim() || null;
    const notes = formData.get("notes")?.toString().trim() || null;
    const details = formData.get("details")?.toString().trim() || null;

    const is_cancelled = formData.get("is_cancelled") === "on";

    const artistRaw = (formData.get("artist_id")?.toString() || "").trim();
    const artist_id = artistRaw.length > 0 ? artistRaw : null;

    // ✅ NEW: image path from uploader hidden input
    const imageRaw = (formData.get("image_path")?.toString() || "").trim();
    const image_path = imageRaw.length > 0 ? imageRaw : null;

    const payload = {
      event_date,
      start_time,
      end_time,
      title,
      genre_override,
      notes,
      details,
      is_cancelled,
      artist_id,
      image_path,
    };

    const { error } = await supabaseServer
      .from("artist_events")
      .update(payload)
      .eq("id", eventId);

    if (error) {
      console.error("[Event edit] update error:", error);
      throw error;
    }

    await logDashboardEventServer({
      action: "update",
      entity: "events",
      entityId: eventId,
      details: payload,
    });

    revalidatePath("/events");
    redirect("/events");
  }

  if (!event) {
    return (
      <DashboardShell title="Edit event" subtitle="Unable to load event" activeTab="events">
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 sm:px-5 py-4 text-sm text-rose-800 space-y-2">
          <p className="font-semibold">Could not load event</p>
          <p>
            Query id:&nbsp;
            <code className="font-mono text-xs">{id || "(missing or undefined)"}</code>
          </p>
          <p className="text-xs">
            searchParams:&nbsp;
            <code className="font-mono text-[10px]">{JSON.stringify(resolvedSearchParams)}</code>
          </p>
          {errorMessage && (
            <p className="text-xs">
              Supabase error: <span className="font-mono">{errorMessage}</span>
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

  const initialEventImageUrl = publicUrlFromStoragePath(event.image_path ?? null);

  return (
    <DashboardShell title="Edit event" subtitle={event.title || "Untitled event"} activeTab="events">
      <form action={updateEvent} className="space-y-4 w-full max-w-3xl">
        <input type="hidden" name="id" defaultValue={event.id} />

        <section className="rounded-2xl border border-slate-200 bg-white px-4 sm:px-5 py-4 shadow-sm space-y-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Event details
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Update date, time, artist, and description for tonight&apos;s show.
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Timezone: {ET_TZ} (Florida time)</p>
            </div>
          </div>

          {/* ✅ Event image uploader (same UX pattern as artists) */}
          <EventImageUploader
            eventId={event.id}
            eventTitle={event.title || "Event"}
            initialPath={event.image_path}
            initialUrl={initialEventImageUrl}
            fieldName="image_path"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="event_date" className="text-xs font-medium text-slate-800">
                Date
              </label>
              <input
                id="event_date"
                name="event_date"
                type="date"
                required
                defaultValue={isoDateToInput(event.event_date) || getEtYmd()}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="artist_id" className="text-xs font-medium text-slate-800">
                Artist (optional)
              </label>
              <select
                id="artist_id"
                name="artist_id"
                defaultValue={event.artist_id ?? ""}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              >
                <option value="">No artist linked</option>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? "Untitled artist"}
                  </option>
                ))}
              </select>

              {artistsErrorMessage && (
                <p className="text-[11px] text-rose-500">
                  Could not load artists list:{" "}
                  <span className="font-mono">{artistsErrorMessage}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <div className="space-y-1.5">
                <label htmlFor="start_time" className="text-xs font-medium text-slate-800">
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
                <label htmlFor="end_time" className="text-xs font-medium text-slate-800">
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
              <label htmlFor="title" className="text-xs font-medium text-slate-800">
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
              <label htmlFor="genre_override" className="text-xs font-medium text-slate-800">
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
              <label htmlFor="details" className="text-xs font-medium text-slate-800">
                Event details (optional)
              </label>
              <textarea
                id="details"
                name="details"
                defaultValue={event.details ?? ""}
                rows={4}
                placeholder="Optional event description shown to users in the app."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label htmlFor="notes" className="text-xs font-medium text-slate-800">
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

        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 sm:px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-800">Event status</p>
            <p className="text-[11px] text-slate-500">
              Cancelled shows stay in history but are hidden from Tonight&apos;s Board and the app.
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
            <label htmlFor="is_cancelled" className="text-xs font-medium text-slate-800">
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
