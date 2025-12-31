// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\page.tsx
// /tv kiosk page (no login required if key matches CHECKIN_BOARD_KEY)
//
// ✅ Production-safe:
// - Query Supabase directly (no /api fetch hop)
// - Use SERVER-ONLY service role client so RLS/auth cookies can't block reads
// - ET-aligned "today" using rewards_scans.scan_date (date) + guest_checkins.day_et (date)

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

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

function getAdminSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export default async function TvPage(props: {
  searchParams?: Promise<{ key?: string }>;
}) {
  const sp = (await props.searchParams) ?? {};
  const providedKey = (sp.key ?? "").trim();
  const kioskKey = (process.env.CHECKIN_BOARD_KEY ?? "").trim();

  if (!kioskKey) redirect("/login");
  if (providedKey !== kioskKey) redirect("/login");

  const supabase = getAdminSupabase();

  const todayEt = getEtYmd();
  const asOfIso = new Date().toISOString();

  // --- VIP check-ins today (rewards_scans) ---
  const { data: vipRows, error: vipErr } = await supabase
    .from("rewards_scans")
    .select("id, scanned_at, source, points, scan_date")
    .eq("source", "qr_checkin")
    .eq("scan_date", todayEt)
    .order("scanned_at", { ascending: false })
    .limit(80);

  if (vipErr) console.error("[tv] rewards_scans error", vipErr);

  const vipCount = (vipRows ?? []).length;

  const vipRecent: RecentItem[] =
    (vipRows ?? []).map((r: any) => ({
      atIso: r.scanned_at as string,
      label: "VIP" as const,
      source: (r.source ?? null) as string | null,
      points: (r.points ?? null) as number | null,
    })) ?? [];

  // --- Guest check-ins today (guest_checkins) ---
  const { data: guestRows, error: guestErr } = await supabase
    .from("guest_checkins")
    .select("id, scanned_at, checked_in_at, day_et")
    .eq("day_et", todayEt)
    .order("scanned_at", { ascending: false })
    .order("checked_in_at", { ascending: false })
    .limit(80);

  if (guestErr) console.error("[tv] guest_checkins error", guestErr);

  const guestCount = (guestRows ?? []).length;

  const guestRecent: RecentItem[] =
    (guestRows ?? [])
      .map((r: any) => {
        const atIso = (r.scanned_at ?? r.checked_in_at) as string | null;
        if (!atIso) return null;
        return { atIso, label: "Guest" as const } satisfies RecentItem;
      })
      .filter((x): x is RecentItem => x !== null);

  const recent = [...vipRecent, ...guestRecent]
    .filter((r) => r.atIso)
    .sort((a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime())
    .slice(0, 20);

  const total = vipCount + guestCount;

  return (
    <div className="min-h-screen bg-slate-950 text-white px-10 py-10">
      <meta httpEquiv="refresh" content="5" />

      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[12px] uppercase tracking-[0.28em] text-slate-300">
              Sugarshack Downtown
            </p>
            <h1 className="mt-2 text-4xl md:text-6xl font-extrabold truncate">
              Check-Ins Today
            </h1>
            <p className="mt-2 text-slate-300">
              Live count · Updates every 5 seconds · Timezone: {ET_TZ}
            </p>
            <p className="mt-1 text-[12px] text-slate-400">
              Date (ET):{" "}
              <span className="font-semibold text-slate-200">{todayEt}</span>
            </p>
          </div>

          <div className="text-right">
            <p className="text-[12px] uppercase tracking-[0.28em] text-slate-400">
              Total
            </p>
            <p className="text-6xl md:text-8xl font-extrabold tabular-nums">
              {total}
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8">
            <p className="text-[12px] uppercase tracking-[0.22em] text-slate-300">
              VIP Check-Ins
            </p>
            <p className="mt-3 text-5xl font-bold tabular-nums">{vipCount}</p>
            <p className="mt-2 text-slate-400 text-sm">
              Rewards check-ins (source: qr_checkin)
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8">
            <p className="text-[12px] uppercase tracking-[0.22em] text-slate-300">
              Guest Check-Ins
            </p>
            <p className="mt-3 text-5xl font-bold tabular-nums">{guestCount}</p>
            <p className="mt-2 text-slate-400 text-sm">
              Guest check-ins (no phone required)
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
            <p className="text-xl md:text-2xl font-semibold">
              Scan the QR to check in & unlock rewards 🎉
            </p>
            <p className="mt-2 text-slate-300">
              VIPs earn points. Guests can still check in — then upgrade anytime.
            </p>
            <p className="mt-4 text-[12px] text-slate-500">
              As of:{" "}
              {new Date(asOfIso).toLocaleString("en-US", { timeZone: ET_TZ })}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            <p className="text-[12px] uppercase tracking-[0.22em] text-slate-300">
              Recent activity
            </p>

            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No recent check-ins yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recent.slice(0, 10).map((r, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">
                      {r.label === "VIP" ? "VIP" : "Guest"}
                    </span>
                    <span className="text-[12px] text-slate-400">
                      {new Date(r.atIso).toLocaleTimeString("en-US", {
                        timeZone: ET_TZ,
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
