// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\ui.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type RecentItem =
  | { atIso: string; label: "VIP"; source?: string | null; points?: number | null }
  | { atIso: string; label: "Guest" };

type TvApiResponse = {
  ok: boolean;
  asOfIso: string;
  dateEt: string; // YYYY-MM-DD (from API), we show MDY passed from page.tsx
  total: number;
  vip: number;
  guest: number;
  recent: RecentItem[];
};

function clampPct(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function formatTime(iso: string, timeZone: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
}

// Tiny confetti without dependencies
function burstConfetti(container: HTMLElement) {
  const colors = ["#FBBF24", "#34D399", "#22D3EE", "#A78BFA", "#FB7185", "#FFFFFF"];
  const count = 26;

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const size = 6 + Math.random() * 8;
    const left = 10 + Math.random() * 80;
    const delay = Math.random() * 80;
    const duration = 900 + Math.random() * 700;
    const rotate = Math.random() * 360;

    p.style.position = "absolute";
    p.style.left = `${left}%`;
    p.style.top = `18%`;
    p.style.width = `${size}px`;
    p.style.height = `${size * 0.65}px`;
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.borderRadius = "2px";
    p.style.transform = `rotate(${rotate}deg)`;
    p.style.opacity = "0.95";
    p.style.pointerEvents = "none";
    p.style.filter = "drop-shadow(0 10px 18px rgba(0,0,0,0.35))";

    p.animate(
      [
        { transform: `translate(0px, 0px) rotate(${rotate}deg)`, opacity: 1 },
        {
          transform: `translate(${(Math.random() - 0.5) * 220}px, ${260 + Math.random() * 260}px) rotate(${rotate + 240}deg)`,
          opacity: 0,
        },
      ],
      {
        duration,
        delay,
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "forwards",
      }
    );

    container.appendChild(p);
    window.setTimeout(() => p.remove(), duration + delay + 20);
  }
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Safari fallback
    // eslint-disable-next-line deprecation/deprecation
    mql.addListener(onChange);
    // eslint-disable-next-line deprecation/deprecation
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}

export default function TvKioskClient(props: {
  kioskKey: string;
  etDateMdy: string;
  etTz: string;
  goalTotal: number;

  appStoreLabel: string;
  showLogoSrc: string;
  checkinQrSrc: string;
  appStoreQrSrc: string;
}) {
  const { kioskKey, etDateMdy, etTz, goalTotal, appStoreLabel, showLogoSrc, checkinQrSrc, appStoreQrSrc } = props;

  const [data, setData] = useState<TvApiResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const lastTotalRef = useRef<number>(0);
  const confettiRef = useRef<HTMLDivElement | null>(null);

  const isLg = useMediaQuery("(min-width: 1024px)");

  async function load() {
    try {
      setErr(null);
      const res = await fetch(`/api/tv?key=${encodeURIComponent(kioskKey)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = (await res.json()) as TvApiResponse;
      setData(json);

      const prev = lastTotalRef.current ?? 0;
      const next = json?.total ?? 0;
      if (next > prev && confettiRef.current) {
        burstConfetti(confettiRef.current);
      }
      lastTotalRef.current = next;
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    }
  }

  useEffect(() => {
    load();
    const t = window.setInterval(load, 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = data?.total ?? 0;
  const vip = data?.vip ?? 0;
  const guest = data?.guest ?? 0;
  const asOfIso = data?.asOfIso ?? null;

  const goalPct = useMemo(() => clampPct(goalTotal > 0 ? (total / goalTotal) * 100 : 0), [total, goalTotal]);

  const recentCount = isLg ? 8 : 5;
  const recent = (data?.recent ?? []).slice(0, recentCount);

  return (
    <div className="min-h-screen lg:h-[100svh] lg:overflow-hidden text-white">
      {/* Confetti layer */}
      <div ref={confettiRef} className="pointer-events-none fixed inset-0 z-50" />

      <div className="min-h-screen lg:h-[100svh] bg-gradient-to-br from-black via-slate-950 to-[#0b1220] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-6">
        <div className="mx-auto w-full max-w-7xl lg:h-full lg:flex lg:flex-col">
          {/* HEADER (TV-safe: wraps, clamps, never clips) */}
          <div className="flex items-start justify-between gap-4 lg:gap-8">
            <div className="flex items-start gap-4 lg:gap-6 min-w-0">
              <div className="relative shrink-0 h-[clamp(64px,7vh,120px)] w-[clamp(64px,7vh,120px)]">
                <Image
                  src={showLogoSrc}
                  alt="Sugarshack Downtown"
                  fill
                  className="object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.75)]"
                  priority
                />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] sm:text-[12px] uppercase tracking-[0.34em] text-slate-300">
                  Sugarshack Downtown
                </p>

                <h1 className="mt-1 font-extrabold leading-[1.05] text-[clamp(26px,3.6vw,56px)]">
                  CHECK IN & GET COUNTED
                </h1>

                <p className="mt-1 text-slate-200 text-[clamp(14px,1.5vw,22px)]">
                  **Install the app first**, then scan to check in for rewards 🎉
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-[12px] text-slate-400">
                  <span>
                    ET Date: <span className="font-semibold text-slate-200">{etDateMdy}</span>
                  </span>
                  <span className="opacity-50">•</span>
                  <span>
                    Updates every <span className="font-semibold text-slate-200">5s</span>
                  </span>
                  <span className="opacity-50">•</span>
                  <span>
                    As of{" "}
                    <span className="text-slate-200 font-semibold">
                      {asOfIso ? formatTime(asOfIso, etTz) : "—"}
                    </span>
                  </span>
                </div>

                {err && (
                  <p className="mt-2 text-sm text-rose-300">
                    Data loading issue: {err}
                  </p>
                )}
              </div>
            </div>

            {/* TOTAL (big, always visible, TV-safe) */}
            <div className="text-right shrink-0">
              <p className="text-[11px] sm:text-[12px] uppercase tracking-[0.34em] text-slate-400">
                Total today
              </p>
              <p className="font-extrabold tabular-nums text-amber-300 drop-shadow-[0_12px_40px_rgba(251,191,36,0.15)] text-[clamp(44px,6.2vw,96px)] leading-none">
                {total}
              </p>
            </div>
          </div>

          {/* TV-safe compact progress bar (keeps “pop” without adding vertical bulk) */}
          <div className="mt-3 lg:mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-slate-200 font-extrabold text-[clamp(12px,1.2vw,16px)]">
                Tonight’s goal: <span className="text-emerald-300">{goalTotal}</span>
              </p>
              <p className="text-slate-300 font-semibold tabular-nums text-[clamp(12px,1.2vw,16px)]">
                {goalPct.toFixed(0)}%
              </p>
            </div>
            <div className="mt-2 h-3 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 transition-all"
                style={{ width: `${goalPct}%` }}
              />
            </div>
          </div>

          {/* MAIN (fills remaining height on TV) */}
          <div className="mt-4 lg:mt-5 grid gap-4 lg:gap-6 lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {/* LEFT: QR + Steps */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-5 sm:p-6 lg:p-7 lg:min-h-0">
              <div className="flex flex-col gap-4 lg:gap-5 h-full">
                <div>
                  <p className="font-extrabold leading-tight text-[clamp(18px,2.4vw,44px)]">
                    INSTALL APP → CHECK IN → SCAN QR ✅
                  </p>
                  <p className="mt-1 text-slate-200 text-[clamp(13px,1.5vw,22px)]">
                    Get counted tonight — earn rewards, perks, and VIP surprises.
                  </p>
                </div>

                <div className="grid gap-4 lg:gap-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] items-center">
                  {/* BIG CHECK-IN QR */}
                  <div className="rounded-2xl border border-slate-700 bg-black/40 p-3 w-fit">
                    <div className="text-center text-[11px] uppercase tracking-[0.28em] text-slate-300 mb-2">
                      Venue Check-In QR
                    </div>
                    <Image
                      src={checkinQrSrc}
                      alt="Venue Check-In QR"
                      width={isLg ? 300 : 240}
                      height={isLg ? 300 : 240}
                      className="rounded-xl"
                      priority
                    />
                    <div className="mt-2 text-center text-[12px] text-slate-200 font-extrabold">
                      Scan this **inside the app**
                    </div>
                  </div>

                  {/* Steps + App Store QR */}
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-300">
                      3 quick steps
                    </p>

                    <ol className="mt-2 space-y-1.5 text-[clamp(14px,1.6vw,24px)]">
                      <li className="flex gap-3">
                        <span className="text-amber-300 font-black">1.</span>
                        <span>
                          <span className="font-extrabold">Install the app first</span> (scan App Store QR)
                        </span>
                      </li>
                      <li className="flex gap-3">
                        <span className="text-amber-300 font-black">2.</span>
                        <span>
                          Open the app → <span className="font-extrabold">Check In</span>
                        </span>
                      </li>
                      <li className="flex gap-3">
                        <span className="text-amber-300 font-black">3.</span>
                        <span>
                          Tap <span className="font-extrabold">Scan QR</span> → you’re counted 🎉
                        </span>
                      </li>
                    </ol>

                    {/* App install box */}
                    <div className="mt-4 rounded-2xl border border-slate-800 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-300">
                        Don’t have the app yet?
                      </p>

                      <p className="mt-1 text-slate-200 font-extrabold text-[clamp(14px,1.5vw,20px)]">
                        {appStoreLabel}
                      </p>

                      <p className="mt-1 text-slate-300 text-[clamp(12px,1.2vw,16px)]">
                        Rewards • VIP perks • Track your check-ins
                      </p>

                      <div className="mt-3 flex items-center gap-4">
                        <div className="rounded-xl border border-slate-800 bg-black/30 p-2.5">
                          <Image
                            src={appStoreQrSrc}
                            alt="App Store QR"
                            width={isLg ? 128 : 110}
                            height={isLg ? 128 : 110}
                            className="rounded-lg"
                          />
                        </div>

                        <p className="text-slate-200 text-[clamp(12px,1.2vw,16px)]">
                          Scan to install now.
                          <span className="block text-slate-400 mt-1 text-[clamp(11px,1.0vw,14px)]">
                            Then open the app and scan the big Venue QR.
                          </span>
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-[11px] text-slate-400">
                      Staff script: “Install the app, tap Check In, then Scan QR — 10 seconds.”
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Cards + Recent (right side becomes height-managed on TV) */}
            <div className="space-y-4 lg:space-y-6 lg:min-h-0">
              {/* Breakdown */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-5 sm:p-6">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-300">
                  Breakdown
                </p>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                    <p className="text-slate-300 text-[11px] uppercase tracking-[0.18em]">Total</p>
                    <p className="mt-1 font-extrabold tabular-nums text-amber-300 text-[clamp(24px,2.6vw,44px)] leading-none">
                      {total}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                    <p className="text-slate-300 text-[11px] uppercase tracking-[0.18em]">VIP</p>
                    <p className="mt-1 font-extrabold tabular-nums text-amber-300 text-[clamp(24px,2.6vw,44px)] leading-none">
                      {vip}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">Rewards</p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                    <p className="text-slate-300 text-[11px] uppercase tracking-[0.18em]">Guest</p>
                    <p className="mt-1 font-extrabold tabular-nums text-teal-300 text-[clamp(24px,2.6vw,44px)] leading-none">
                      {guest}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">Not logged in</p>
                  </div>
                </div>
              </div>

              {/* Recent check-ins (this is the ONLY internal scroll area on TV) */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-5 sm:p-6 lg:min-h-0">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-300">
                    Recent check-ins
                  </p>
                  <p className="text-[11px] text-slate-500">
                    ET time
                  </p>
                </div>

                {recent.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">No recent check-ins yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2 lg:max-h-[calc(100svh-520px)] lg:overflow-auto pr-1">
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

                        <span className="text-[12px] text-slate-200 font-semibold tabular-nums">
                          {formatTime(r.atIso, etTz)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-3 text-[11px] text-slate-500">
                  Keep it moving: “Install the app → Check In → Scan QR.”
                </p>
              </div>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] text-slate-600">
            Timezone: {etTz} • Live venue display
          </p>
        </div>
      </div>
    </div>
  );
}
