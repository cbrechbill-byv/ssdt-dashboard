// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\page.tsx
// /tv kiosk page (no login required if key matches CHECKIN_BOARD_KEY)
//
// TV MODE (venue display):
// - Big logo, huge totals, simple steps, high-contrast
// - Supabase service-role query (server-only), ET-day totals
// - Auto refresh every 5s (meta refresh)
// - Includes “Download the app” CTA for guests who don’t have it
//
// Assets expected in /public:
// - /ssdt-logo.png
// - /SSDTVIP-CHECKIN.png
// Optional:
// - /appstore-qr.png

import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";
const GOAL_TOTAL_TONIGHT = 500;

const APP_STORE_URL =
  "https://apps.apple.com/us/app/sugarshack-downtown-app/id6755752186";

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

type RecentItem =
  | { atIso: string; label: "VIP"; source?: string | null; points?: number | null }
  | { atIso: string; label: "Guest" };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function getAdminSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function clampPct(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function formatTimeEt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    timeZone: ET_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function TvPage(props: { searchParams?: Promise<{ key?: string }> }) {
  const sp = (await props.searchParams) ?? {};
  const providedKey = (sp.key ?? "").trim();
  const kioskKey = (process.env.CHECKIN_BOARD_KEY ?? "").trim();

  // If kiosk key isn't configured, don't expose the page.
  if (!kioskKey) redirect("/login");
  // If key doesn't match, require login
  if (providedKey !== kioskKey) redirect("/login");

  const supabase = getAdminSupabase();

  const todayEt = getEtYmd();
  const asOfIso = new Date().toISOString();

  // --- VIP check-ins today ---
  const { data: vipRows, error: vipErr } = await supabase
    .from("rewards_scans")
    .select("id, scanned_at, source, points, scan_date")
    .eq("source", "qr_checkin")
    .eq("scan_date", todayEt)
    .order("scanned_at", { ascending: false })
    .limit(140);

  if (vipErr) console.error("[tv] rewards_scans error", vipErr);
  const vipCount = (vipRows ?? []).length;

  const vipRecent: RecentItem[] = (vipRows ?? []).flatMap((r: any) => {
    const atIso = r?.scanned_at as unknown;
    if (!isNonEmptyString(atIso)) return [];
    return [
      {
        atIso,
        label: "VIP" as const,
        source: (r?.source ?? null) as string | null,
        points: (r?.points ?? null) as number | null,
      },
    ];
  });

  // --- Guest check-ins today ---
  const { data: guestRows, error: guestErr } = await supabase
    .from("guest_checkins")
    .select("id, scanned_at, checked_in_at, day_et")
    .eq("day_et", todayEt)
    .order("scanned_at", { ascending: false })
    .order("checked_in_at", { ascending: false })
    .limit(140);

  if (guestErr) console.error("[tv] guest_checkins error", guestErr);
  const guestCount = (guestRows ?? []).length;

  const guestRecent: RecentItem[] = (guestRows ?? []).flatMap((r: any) => {
    const atIso = (r?.scanned_at ?? r?.checked_in_at) as unknown;
    if (!isNonEmptyString(atIso)) return [];
    return [{ atIso, label: "Guest" as const }];
  });

  const recent: RecentItem[] = [...vipRecent, ...guestRecent]
    .sort((a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime())
    .slice(0, 12);

  const total = vipCount + guestCount;
  const goalPct = clampPct(GOAL_TOTAL_TONIGHT > 0 ? (total / GOAL_TOTAL_TONIGHT) * 100 : 0);
  const remaining = Math.max(0, GOAL_TOTAL_TONIGHT - total);

  return (
    <div className="min-h-screen text-white">
      {/* auto-refresh */}
      <meta httpEquiv="refresh" content="5" />

      <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-[#0b1220] px-10 py-10">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6 min-w-0">
              <div className="relative h-20 w-20 md:h-24 md:w-24 shrink-0">
                <Image
                  src="/ssdt-logo.png"
                  alt="Sugarshack Downtown"
                  fill
                  className="object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
                  priority
                />
              </div>

              <div className="min-w-0">
                <p className="text-[12px] uppercase tracking-[0.34em] text-slate-300">
                  Sugarshack Downtown
                </p>
                <h1 className="mt-2 text-4xl md:text-6xl font-extrabold truncate">
                  CHECK IN & GET COUNTED
                </h1>
                <p className="mt-2 text-slate-200 text-lg md:text-xl">
                  Scan the QR • Instant check-in • Unlock rewards 🎉
                </p>
                <p className="mt-1 text-[12px] text-slate-400">
                  ET Date: <span className="font-semibold text-slate-200">{todayEt}</span> • Updates every 5s
                </p>
              </div>
            </div>

            {/* Total */}
            <div className="text-right">
              <p className="text-[12px] uppercase tracking-[0.34em] text-slate-400">
                Total check-ins today
              </p>
              <p className="text-6xl md:text-8xl font-extrabold tabular-nums text-amber-300 drop-shadow-[0_12px_40px_rgba(251,191,36,0.15)]">
                {total}
              </p>
              <p className="mt-2 text-[12px] text-slate-400">
                As of{" "}
                <span className="text-slate-200 font-semibold">
                  {new Date(asOfIso).toLocaleTimeString("en-US", {
                    timeZone: ET_TZ,
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </p>
            </div>
          </div>

          {/* Goal Meter */}
          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[12px] uppercase tracking-[0.28em] text-slate-300">
                  Tonight’s Goal
                </p>
                <p className="mt-2 text-2xl md:text-3xl font-extrabold">
                  Road to <span className="text-emerald-300">{GOAL_TOTAL_TONIGHT}</span> check-ins
                </p>
                <p className="mt-1 text-slate-300 text-lg">
                  {remaining === 0 ? "Goal hit — keep it going! 🚀" : `${remaining} to go — let’s do this!`}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[12px] uppercase tracking-[0.28em] text-slate-400">
                  Progress
                </p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-300">
                  {goalPct.toFixed(0)}%
                </p>
              </div>
            </div>

            <div className="mt-4 h-4 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-4 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 transition-all"
                style={{ width: `${goalPct}%` }}
              />
            </div>
          </div>

          {/* Main CTA + Breakdown */}
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {/* LEFT: “SCAN NOW” + QR + Download App */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-8">
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-3xl md:text-5xl font-extrabold leading-tight">
                    SCAN TO CHECK IN ✅
                  </p>
                  <p className="mt-3 text-lg md:text-2xl text-slate-200">
                    VIPs earn points. Guests check in fast — upgrade anytime.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-[260px_1fr] items-center">
                  <div className="rounded-2xl border border-slate-700 bg-black/30 p-4 w-fit">
                    <Image
                      src="/SSDTVIP-CHECKIN.png"
                      alt="Check-in QR"
                      width={240}
                      height={240}
                      className="rounded-xl"
                      priority
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[12px] uppercase tracking-[0.28em] text-slate-300">
                      3 steps
                    </p>
                    <ul className="mt-3 space-y-2 text-xl md:text-2xl">
                      <li className="flex gap-3">
                        <span className="text-amber-300 font-black">1.</span>
                        <span>Open your camera</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="text-amber-300 font-black">2.</span>
                        <span>Scan the QR</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="text-amber-300 font-black">3.</span>
                        <span>You’re checked in 🎉</span>
                      </li>
                    </ul>

                    <div className="mt-6 rounded-2xl border border-slate-800 bg-black/20 p-4">
                      <p className="text-[12px] uppercase tracking-[0.28em] text-slate-300">
                        Don’t have the app?
                      </p>
                      <p className="mt-2 text-lg md:text-xl text-slate-200 font-semibold">
                        Download “Sugarshack Downtown App”
                      </p>
                      <p className="mt-1 text-slate-300">
                        App Store:{" "}
                        <span className="font-semibold text-amber-300">
                          {APP_STORE_URL}
                        </span>
                      </p>

                      {/* Optional app store QR */}
                      <div className="mt-4 flex items-center gap-4">
                        <div className="rounded-xl border border-slate-800 bg-black/30 p-3">
                          <Image
                            src="/appstore-qr.png"
                            alt="App Store QR"
                            width={110}
                            height={110}
                            className="rounded-lg"
                          />
                        </div>
                        <p className="text-sm text-slate-300">
                          (Optional) Add <span className="font-semibold text-slate-100">/public/appstore-qr.png</span>{" "}
                          to let guests download instantly.
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-[12px] text-slate-400">
                      Staff script: “Scan the QR to check in — it takes 2 seconds.”
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Breakdown + Recent */}
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-6">
                <p className="text-[12px] uppercase tracking-[0.28em] text-slate-300">
                  Breakdown
                </p>

                <div className="mt-4 grid gap-4">
                  <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                    <p className="text-slate-300 text-sm uppercase tracking-[0.18em]">VIP</p>
                    <p className="mt-1 text-5xl font-extrabold tabular-nums text-amber-300">{vipCount}</p>
                    <p className="mt-1 text-[12px] text-slate-400">Rewards check-ins</p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                    <p className="text-slate-300 text-sm uppercase tracking-[0.18em]">Guest</p>
                    <p className="mt-1 text-5xl font-extrabold tabular-nums text-teal-300">{guestCount}</p>
                    <p className="mt-1 text-[12px] text-slate-400">No phone required</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-6">
                <p className="text-[12px] uppercase tracking-[0.28em] text-slate-300">
                  Recent check-ins
                </p>

                {recent.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">No recent check-ins yet.</p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {recent.map((r, idx) => (
                      <li
                        key={`${r.label}-${r.atIso}-${idx}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-black/20 px-4 py-3"
                      >
                        <span
                          className={`text-sm font-extrabold uppercase tracking-[0.12em] ${
                            r.label === "VIP" ? "text-amber-300" : "text-teal-300"
                          }`}
                        >
                          {r.label}
                        </span>
                        <span className="text-[12px] text-slate-300 font-semibold">
                          {formatTimeEt(r.atIso)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-3 text-[11px] text-slate-500">
                  Keep the line moving: “Scan now — it’s instant.”
                </p>
              </div>
            </div>
          </div>

          <p className="mt-10 text-center text-[11px] text-slate-600">
            Timezone: {ET_TZ} • Powered by Sugarshack Downtown Rewards
          </p>
        </div>
      </div>
    </div>
  );
}
