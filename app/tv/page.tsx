// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\page.tsx
// /tv kiosk page (no login required if key matches CHECKIN_BOARD_KEY)
// Fetches totals from GET /api/tv

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

type TvApiResponse = {
  ok: boolean;
  asOfIso: string;
  dateEt: string; // YYYY-MM-DD
  total: number;
  vip: number;
  guest: number;
  recent: Array<
    | { atIso: string; label: "VIP"; source?: string | null; points?: number | null }
    | { atIso: string; label: "Guest" }
  >;
};

async function loadTvData(): Promise<TvApiResponse | null> {
  // Build base URL for server-side fetch
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? process.env.VERCEL_URL.startsWith("http")
        ? process.env.VERCEL_URL
        : `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/tv`, { cache: "no-store" });
  if (!res.ok) return null;

  const json = (await res.json()) as TvApiResponse;
  return json;
}

export default async function TvPage(props: {
  searchParams?: Promise<{ key?: string }>;
}) {
  const sp = (await props.searchParams) ?? {};
  const providedKey = (sp.key ?? "").trim();
  const kioskKey = (process.env.CHECKIN_BOARD_KEY ?? "").trim();

  // If kiosk key isn't configured, don't expose the page.
  if (!kioskKey) redirect("/login");

  // If key doesn't match, require login
  if (providedKey !== kioskKey) redirect("/login");

  const data = await loadTvData();

  const total = data?.total ?? 0;
  const vip = data?.vip ?? 0;
  const guest = data?.guest ?? 0;
  const dateEt = data?.dateEt ?? "";
  const asOfIso = data?.asOfIso ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-white px-10 py-10">
      {/* auto-refresh */}
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
            {dateEt && (
              <p className="mt-1 text-[12px] text-slate-400">
                Date (ET): <span className="font-semibold text-slate-200">{dateEt}</span>
              </p>
            )}
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
            <p className="mt-3 text-5xl font-bold tabular-nums">{vip}</p>
            <p className="mt-2 text-slate-400 text-sm">
              Rewards check-ins (source: qr_checkin)
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8">
            <p className="text-[12px] uppercase tracking-[0.22em] text-slate-300">
              Guest Check-Ins
            </p>
            <p className="mt-3 text-5xl font-bold tabular-nums">{guest}</p>
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
            {asOfIso && (
              <p className="mt-4 text-[12px] text-slate-500">
                As of: {new Date(asOfIso).toLocaleString("en-US", { timeZone: ET_TZ })}
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            <p className="text-[12px] uppercase tracking-[0.22em] text-slate-300">
              Recent activity
            </p>

            {!data?.recent?.length ? (
              <p className="mt-3 text-sm text-slate-400">No recent check-ins yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.recent.slice(0, 10).map((r, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">
                      {r.label === "VIP" ? "VIP" : "Guest"}
                    </span>
                    <span className="text-[12px] text-slate-400">
                      {r.atIso
                        ? new Date(r.atIso).toLocaleTimeString("en-US", {
                            timeZone: ET_TZ,
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
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
