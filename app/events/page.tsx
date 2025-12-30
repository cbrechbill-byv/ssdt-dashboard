// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\events\page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { logDashboardEventServer } from "@/lib/logDashboardEventServer";

const ET_TZ = "America/New_York";

type EventArtist = {
  name: string | null;
  genre: string | null;
};

type EventRow = {
  id: string;
  event_date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM:SS
  end_time: string | null; // HH:MM:SS
  is_cancelled: boolean;
  genre_override: string | null;
  title: string | null;
  notes: string | null;
  artist: EventArtist | EventArtist[] | null;
};

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Date-only strings MUST NOT be parsed as Date("YYYY-MM-DD") (UTC midnight).
// Use a noon-UTC anchor so it formats safely in ET.
function formatDateEt(ymd: string | null): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  if (!y || !m || !d) return ymd;

  const safeUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(safeUtc);
}

function formatTimeEt(time: string | null): string {
  if (!time) return "—";
  const [hhRaw, mmRaw] = time.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return time;

  const suffix = hh >= 12 ? "PM" : "AM";
  const hour12 = ((hh + 11) % 12) + 1;
  const mm2 = String(mm).padStart(2, "0");
  return `${hour12}:${mm2} ${suffix}`;
}

function formatTimeRangeEt(start: string | null, end: string | null): string {
  const startLabel = formatTimeEt(start);
  const endLabel = formatTimeEt(end);
  if (start && end) return `${startLabel}–${endLabel}`;
  if (start) return startLabel;
  return "TBD";
}

function getArtistNames(artist: EventRow["artist"]): string {
  // ✅ Change: If no artist is linked, show "SSDT Event" (not "Unknown artist")
  if (!artist) return "SSDT Event";

  if (Array.isArray(artist)) {
    const names = artist
      .map((a) => a?.name?.trim())
      .filter((name): name is string => !!name);
    return names.length ? names.join(", ") : "SSDT Event";
  }

  return artist.name?.trim() ? artist.name : "SSDT Event";
}

function getArtistGenre(evt: EventRow): string {
  if (evt.genre_override) return evt.genre_override;

  const { artist } = evt;
  if (!artist) return "—";

  if (Array.isArray(artist)) {
    const genres = artist
      .map((a) => a?.genre?.trim())
      .filter((g): g is string => !!g);
    return genres.length ? genres.join(", ") : "—";
  }

  return artist.genre || "—";
}

function isTonight(eventDate: string | null | undefined) {
  if (!eventDate) return false;
  return eventDate === getEtYmd();
}

// --- Server action: delete event --------------------------------------------
async function deleteEvent(formData: FormData) {
  "use server";

  const id = formData.get("id")?.toString();
  if (!id) return;

  const { error } = await supabaseServer
    .from("artist_events")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[Events] delete error:", error);
    throw new Error(error.message);
  }

  await logDashboardEventServer({
    action: "delete",
    entity: "events",
    entityId: id,
    details: { id },
  });

  revalidatePath("/events");
}

export default async function EventsPage() {
  // ✅ ET-safe “today” so .gte("event_date", today) works correctly
  const todayEt = getEtYmd();

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
    .not("start_time", "is", null)
    .gte("event_date", todayEt)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("[Events] load error:", error);
  }

  const events = (data ?? []) as EventRow[];

  return (
    <DashboardShell
      title="Events"
      subtitle={`Manage the Sugarshack Downtown live music calendar. (Timezone: ${ET_TZ})`}
      activeTab="events"
    >
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 sm:px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              Upcoming shows
            </p>
            <p className="mt-1 text-xs text-slate-500">
              These dates drive the Tonight screen and Calendar in the app.
            </p>
          </div>
          <Link
            href="/events/new"
            className="inline-flex items-center rounded-full bg-amber-400 hover:bg-amber-500 text-slate-900 text-xs font-semibold px-3 py-1.5 shadow-sm"
          >
            + Add event
          </Link>
        </div>

        {error && (
          <p className="text-xs text-rose-600">
            There was a problem loading events:{" "}
            <span className="font-mono">{error.message}</span>
          </p>
        )}

        {events.length === 0 && !error ? (
          <p className="text-xs text-slate-400">
            No upcoming events with times set. Click &ldquo;Add event&rdquo; to
            schedule your first show.
          </p>
        ) : (
          // ✅ Mobile Safari fix:
          // - keep overflow scroll
          // - but bump base font to 13px on mobile + force full opacity
          <div className="-mx-4 sm:mx-0 overflow-x-auto">
            <table className="min-w-[980px] w-full text-[13px] sm:text-xs text-slate-900">
              <thead>
                <tr className="text-[12px] sm:text-[11px] uppercase tracking-[0.12em] text-slate-600 border-b border-slate-100">
                  <th className="py-2 pr-3 pl-4 sm:pl-0 text-left font-semibold">
                    Date
                  </th>
                  <th className="py-2 pr-3 text-left font-semibold">Time</th>
                  <th className="py-2 pr-3 text-left font-semibold">Artist</th>
                  <th className="py-2 pr-3 text-left font-semibold">Genre</th>
                  <th className="py-2 pr-3 text-left font-semibold">Title</th>
                  <th className="py-2 pr-3 text-left font-semibold">Notes</th>
                  <th className="py-2 pr-3 text-right font-semibold">Status</th>
                  <th className="py-2 pr-4 sm:pr-0 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="text-slate-900 opacity-100">
                {events.map((evt) => {
                  const dateLabel = formatDateEt(evt.event_date);
                  const timeLabel = formatTimeRangeEt(
                    evt.start_time,
                    evt.end_time
                  );
                  const artistName = getArtistNames(evt.artist);
                  const genre = getArtistGenre(evt);

                  const statusLabel = evt.is_cancelled
                    ? "Cancelled"
                    : "Scheduled";
                  const statusClass = evt.is_cancelled
                    ? "bg-rose-100 text-rose-700"
                    : "bg-emerald-100 text-emerald-700";

                  const tonight = isTonight(evt.event_date);

                  return (
                    <tr
                      key={evt.id}
                      className="border-b border-slate-100 last:border-0 transition-colors hover:bg-amber-50/60"
                    >
                      <td className="py-2 pr-3 pl-4 sm:pl-0 align-top whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{dateLabel}</span>
                          {tonight && (
                            <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-slate-900 uppercase tracking-wide">
                              Tonight
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        {timeLabel}
                      </td>
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        {artistName}
                      </td>
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        {genre}
                      </td>
                      <td className="py-2 pr-3 align-top">{evt.title || "—"}</td>
                      <td className="py-2 pr-3 align-top">{evt.notes || "—"}</td>

                      <td className="py-2 pr-3 align-top text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </td>

                      <td className="py-2 pl-3 pr-4 sm:pr-0 align-top text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/events/edit?id=${evt.id}`}
                            className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                          >
                            Edit
                          </Link>
                          <form action={deleteEvent}>
                            <input type="hidden" name="id" value={evt.id} />
                            <button
                              type="submit"
                              className="text-xs font-semibold text-rose-700 hover:text-rose-900 hover:underline"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
