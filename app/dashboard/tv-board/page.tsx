// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\dashboard\tv-board\page.tsx
// app/dashboard/tv-board/page.tsx
// Path: /dashboard/tv-board
// Purpose: TV Board control center:
// - Preview the TV board (iframe)
// - Manage which sponsors are scheduled to show on the TV board using public.tv_sponsor_schedule
// Notes:
// - This page is SERVER-rendered and uses SERVICE ROLE via supabaseServer (safe on server).
// - TV preview uses CHECKIN_BOARD_KEY in the iframe src; this is only visible to logged-in dashboard users.

import Image from "next/image";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 0;

const ET_TZ = "America/New_York";

type SponsorRow = {
  id: string;
  name: string;
  logo_path: string | null;
  tier: string | null;
  is_active: boolean;
};

type ScheduleRow = {
  id: string;
  sponsor_id: string;
  start_date: string; // date
  end_date: string | null; // date
  is_active: boolean;
  priority: number;
  created_at: string;
  sponsors?: SponsorRow | SponsorRow[] | null; // supabase can return object or array depending on relationship
};

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function coerceSponsor(x: any): SponsorRow | null {
  if (!x) return null;
  if (Array.isArray(x)) return x[0] ?? null;
  return x as SponsorRow;
}

function badgeClass(tone: "emerald" | "amber" | "slate") {
  if (tone === "emerald") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (tone === "amber") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

function getSponsorPublicUrl(logo_path: string | null) {
  if (!logo_path) return null;
  // Storage bucket used elsewhere in your dashboard sponsors page:
  const bucket = "sponsor-logos";
  const { data } = supabaseServer.storage.from(bucket).getPublicUrl(logo_path);
  return data?.publicUrl ?? null;
}

/** SERVER ACTIONS */
async function addSchedule(formData: FormData) {
  "use server";

  const sponsor_id = String(formData.get("sponsor_id") || "").trim();
  const start_date = String(formData.get("start_date") || "").trim();
  const end_date_raw = String(formData.get("end_date") || "").trim();
  const end_date = end_date_raw.length > 0 ? end_date_raw : null;

  const priority_raw = String(formData.get("priority") || "0").trim();
  const priority = Number(priority_raw);
  const is_active = String(formData.get("is_active") || "") === "on";

  if (!sponsor_id) throw new Error("Missing sponsor_id");
  if (!start_date) throw new Error("Missing start_date");
  if (!Number.isFinite(priority)) throw new Error("Priority must be a number");

  const supabase = supabaseServer;

  const { error } = await supabase.from("tv_sponsor_schedule").insert({
    sponsor_id,
    start_date,
    end_date,
    is_active,
    priority: Math.floor(priority),
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/tv-board");
}

async function updateSchedule(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();
  const end_date_raw = String(formData.get("end_date") || "").trim();
  const end_date = end_date_raw.length > 0 ? end_date_raw : null;

  const priority_raw = String(formData.get("priority") || "0").trim();
  const priority = Number(priority_raw);
  const is_active = String(formData.get("is_active") || "") === "on";

  if (!id) throw new Error("Missing schedule id");
  if (!Number.isFinite(priority)) throw new Error("Priority must be a number");

  const supabase = supabaseServer;

  const { error } = await supabase
    .from("tv_sponsor_schedule")
    .update({
      end_date,
      is_active,
      priority: Math.floor(priority),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/tv-board");
}

async function deleteSchedule(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing schedule id");

  const supabase = supabaseServer;

  const { error } = await supabase.from("tv_sponsor_schedule").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/tv-board");
}

export default async function TvBoardDashboardPage() {
  const supabase = supabaseServer;
  const todayEt = getEtYmd();

  // Sponsors (active) for the dropdown
  const { data: sponsorsData, error: sponsorsErr } = await supabase
    .from("sponsors")
    .select("id,name,logo_path,tier,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (sponsorsErr) console.error("[tv-board] sponsors error", sponsorsErr);

  const sponsors: SponsorRow[] = (sponsorsData ?? []) as SponsorRow[];

  // Schedules that are active "today" (ET day) – uses your tv_sponsor_schedule design
  // Ordering matches rule intent:
  // - Highest priority wins
  // - Most recent start_date breaks ties
  // - created_at breaks any remaining ties
  const { data: scheduledTodayData, error: scheduledTodayErr } = await supabase
    .from("tv_sponsor_schedule")
    .select(
      "id,sponsor_id,start_date,end_date,is_active,priority,created_at,sponsors(id,name,logo_path,tier,is_active)"
    )
    .eq("is_active", true)
    .lte("start_date", todayEt)
    .or(`end_date.is.null,end_date.gte.${todayEt}`)
    .order("priority", { ascending: false })
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (scheduledTodayErr) console.error("[tv-board] scheduled today error", scheduledTodayErr);

  const scheduledToday: ScheduleRow[] = (scheduledTodayData ?? []) as ScheduleRow[];

  // “Currently showing on TV” = the top schedule after ordering (matches /api/tv-sponsor selection logic)
  const currentRow = scheduledToday[0] ?? null;
  const currentSponsor = currentRow ? coerceSponsor((currentRow as any).sponsors) : null;
  const currentLogoUrl = currentSponsor ? getSponsorPublicUrl(currentSponsor.logo_path) : null;

  // All schedules (recent first) for management
  const { data: allSchedulesData, error: allSchedulesErr } = await supabase
    .from("tv_sponsor_schedule")
    .select(
      "id,sponsor_id,start_date,end_date,is_active,priority,created_at,sponsors(id,name,logo_path,tier,is_active)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (allSchedulesErr) console.error("[tv-board] all schedules error", allSchedulesErr);

  const allSchedules: ScheduleRow[] = (allSchedulesData ?? []) as ScheduleRow[];

  const key = (process.env.CHECKIN_BOARD_KEY || "").trim();
  const canonicalBase = "https://ssdtapp.byvenuecreative.com/tv";
  const tvUrl = key ? `${canonicalBase}?key=${encodeURIComponent(key)}` : `${canonicalBase}?key=`;

  return (
    <DashboardShell
      title="TV Board"
      subtitle={`Preview the TV + schedule sponsors (ET: ${todayEt})`}
      activeTab="dashboard"
    >
      <div className="space-y-8">
        {/* Preview */}
        <section className="rounded-3xl border border-slate-100 bg-white px-4 py-6 shadow-sm sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">TV Preview</h2>
              <p className="mt-1 text-sm text-slate-500">
                This is the live TV board page. Use it to confirm layout + sponsor visibility.
              </p>
              {!key ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <div className="font-semibold">CHECKIN_BOARD_KEY is missing on the server.</div>
                  <div className="mt-1 text-[13px]">
                    The TV page will show “TV Link Locked” until you set{" "}
                    <code className="font-mono">CHECKIN_BOARD_KEY</code> in your deployment environment.
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={tvUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Open TV in new tab
              </a>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                Canonical: <span className="font-mono">{canonicalBase}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className="aspect-[16/9] w-full">
              <iframe title="SSDT TV Board" src={tvUrl} className="h-full w-full" allow="fullscreen" />
            </div>
          </div>
        </section>

        {/* Currently showing on TV */}
        <section className="rounded-3xl border border-slate-100 bg-white px-4 py-6 shadow-sm sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Currently showing on TV</h2>
              <p className="mt-1 text-sm text-slate-500">
                This is the single sponsor that should render on the TV today based on schedule rules (priority → start date).
              </p>
            </div>
            <div className="text-xs text-slate-500">ET date: {todayEt}</div>
          </div>

          {!currentRow ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              No sponsor scheduled to show on TV today.
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {currentLogoUrl ? (
                    <Image
                      src={currentLogoUrl}
                      alt={currentSponsor?.name || "Sponsor"}
                      fill
                      className="object-contain p-3"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                      No logo
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-base font-semibold text-slate-900">
                      {currentSponsor?.name || "Unknown sponsor"}
                    </div>
                    {currentSponsor?.tier ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                        {currentSponsor.tier}
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass(
                        currentRow.is_active ? "emerald" : "slate"
                      )}`}
                    >
                      {currentRow.is_active ? "Active" : "Off"}
                    </span>
                  </div>

                  <div className="mt-1 text-[12px] text-slate-600">
                    Priority: <span className="font-semibold">{currentRow.priority}</span> · Range:{" "}
                    <span className="font-mono">{currentRow.start_date}</span>
                    {currentRow.end_date ? (
                      <>
                        {" "}
                        → <span className="font-mono">{currentRow.end_date}</span>
                      </>
                    ) : (
                      " → (no end)"
                    )}
                  </div>

                  <div className="mt-1 text-[11px] text-slate-500">
                    This should match what <code className="font-mono">/api/tv-sponsor</code> returns for today.
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Schedule id: <span className="font-mono">{currentRow.id}</span>
              </div>
            </div>
          )}
        </section>

        {/* “Now” line for staff confidence */}
        <section className="rounded-3xl border border-slate-100 bg-white px-4 py-6 shadow-sm sm:px-6 lg:px-8">
          <h2 className="text-base font-semibold text-slate-900">Now line (requested)</h2>
          <p className="mt-1 text-sm text-slate-500">
            You asked for: <span className="font-semibold">“Now: Artist Name · Next set starts in …”</span>
          </p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            This should be rendered on the TV page itself (the <code className="font-mono">/tv</code> UI) by reading the current
            artist/set info from your events data. The TV Board page here is the control center (preview + sponsor schedule).
          </div>
        </section>

        {/* Sponsors scheduled today */}
        <section className="rounded-3xl border border-slate-100 bg-white px-4 py-6 shadow-sm sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Sponsors showing today (ET)</h2>
              <p className="mt-1 text-sm text-slate-500">
                Pulled from <code className="font-mono">tv_sponsor_schedule</code> (active + within date range), ordered by priority.
              </p>
            </div>
            <div className="text-xs text-slate-500">ET date: {todayEt}</div>
          </div>

          {scheduledToday.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              No scheduled TV sponsors for today yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {scheduledToday.map((row) => {
                const s = coerceSponsor((row as any).sponsors);
                const logoUrl = s ? getSponsorPublicUrl(s.logo_path) : null;

                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        {logoUrl ? (
                          <Image src={logoUrl} alt={s?.name || "Sponsor"} fill className="object-contain p-2" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                            No logo
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {s?.name || "Unknown sponsor"}
                          </div>
                          {s?.tier ? (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                              {s.tier}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-600">
                          Priority: <span className="font-semibold">{row.priority}</span> · Range:{" "}
                          <span className="font-mono">{row.start_date}</span>
                          {row.end_date ? (
                            <>
                              {" "}
                              → <span className="font-mono">{row.end_date}</span>
                            </>
                          ) : (
                            " → (no end)"
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass(
                        row.is_active ? "emerald" : "slate"
                      )}`}
                    >
                      {row.is_active ? "Active" : "Off"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Add schedule */}
        <section className="rounded-3xl border border-slate-100 bg-white px-4 py-6 shadow-sm sm:px-6 lg:px-8">
          <h2 className="text-base font-semibold text-slate-900">Add TV sponsor schedule</h2>
          <p className="mt-1 text-sm text-slate-500">
            This controls which sponsor(s) appear on the TV board — it does not change your main Sponsors list.
          </p>

          <form action={addSchedule} className="mt-4 grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Sponsor</label>
              <select
                name="sponsor_id"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              >
                <option value="">Select a sponsor…</option>
                {sponsors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.tier ? ` (${s.tier})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Start date (ET)</label>
              <input
                name="start_date"
                type="date"
                required
                defaultValue={todayEt}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">End date (optional)</label>
              <input
                name="end_date"
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Priority</label>
              <input
                name="priority"
                type="number"
                defaultValue={0}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              />
              <div className="mt-1 text-[11px] text-slate-500">Higher = shows first</div>
            </div>

            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input name="is_active" type="checkbox" defaultChecked className="h-4 w-4" />
                Active
              </label>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/30 hover:bg-sky-400"
              >
                Add
              </button>
            </div>
          </form>
        </section>

        {/* Manage schedules */}
        <section className="rounded-3xl border border-slate-100 bg-white px-4 py-6 shadow-sm sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Manage schedules</h2>
              <p className="mt-1 text-sm text-slate-500">Edit end date / priority / active. (Showing latest 50)</p>
            </div>
          </div>

          {allSchedules.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              No schedules yet.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <div className="min-w-[980px] bg-white">
                <div className="grid grid-cols-[2.2fr_1fr_1fr_0.8fr_0.9fr_0.9fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <div>Sponsor</div>
                  <div>Start</div>
                  <div>End</div>
                  <div className="text-right">Priority</div>
                  <div className="text-center">Active</div>
                  <div className="text-right">Actions</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {allSchedules.map((row) => {
                    const s = coerceSponsor((row as any).sponsors);
                    return (
                      <div
                        key={row.id}
                        className="grid grid-cols-[2.2fr_1fr_1fr_0.8fr_0.9fr_0.9fr] items-center gap-3 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{s?.name || row.sponsor_id}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            id: <span className="font-mono">{row.id}</span>
                          </div>
                        </div>

                        <div className="font-mono text-[13px] text-slate-800">{row.start_date}</div>

                        <form action={updateSchedule} className="contents">
                          <input type="hidden" name="id" value={row.id} />

                          <div>
                            <input
                              name="end_date"
                              type="date"
                              defaultValue={row.end_date ?? ""}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
                            />
                          </div>

                          <div className="text-right">
                            <input
                              name="priority"
                              type="number"
                              defaultValue={row.priority ?? 0}
                              className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-[13px] text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
                            />
                          </div>

                          <div className="flex justify-center">
                            <input
                              name="is_active"
                              type="checkbox"
                              defaultChecked={!!row.is_active}
                              className="h-4 w-4"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="submit"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 hover:bg-amber-50"
                            >
                              Save
                            </button>
                          </div>
                        </form>

                        <div className="flex justify-end">
                          <form action={deleteSchedule}>
                            <input type="hidden" name="id" value={row.id} />
                            <button
                              type="submit"
                              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
