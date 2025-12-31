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

    // animation
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
  const remaining = Math.max(0, goalTotal - total);

  const recent = (data?.recent ?? []).slice(0, 8);

  return (
    <div className="min-h-screen text-white">
      {/* Confetti layer */}
      <div ref={confettiRef} className="pointer-events-none fixed inset-0 z-50" />

      <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-[#0b1220] px-10 py-10">
        <div className="mx-auto max-w-6xl">
          {/* HEADER */}
          <div className="flex items-start justify-between gap-10">
            <div className="flex items-start gap-8 min-w-0">
              <div className="relative h-24 w-24 md:h-28 md:w-28 shrink-0">
                <Image
                  src={showLogoSrc}
                  alt="Sugarshack Downtown"
                  fill
                  className="object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.75)]"
                  priority
                />
              </div>

              <div className="min-w-0">
                <p className="text-[12px] uppercase tracking-[0.34em] text-slate-300">
                  Sugarshack Downtown
                </p>

                {/* NO truncate: allow wrap */}
                <h1 className="mt-2 text-4xl md:text-6xl font-extrabold leading-tight">
                  CHECK IN & GET COUNTED
                </h1>

                <p className="mt-2 text-slate-200 text-lg md:text-xl">
                  Scan the QR • Instant check-in • Unlock rewards 🎉
                </p>

                <p className="mt-1 text-[12px] text-slate-400">
                  ET Date:{" "}
                  <span className="font-semibold text-slate-200">{etDateMdy}</span> • Updates every 5s
                </p>

                {err && (
                  <p className="mt-2 text-sm text-rose-300">
                    Data loading issue: {err}
                  </p>
                )}
              </div>
            </div>

            {/* TOTAL */}
            <div className="text-right shrink-0">
              <p className="text-[12px] uppercase tracking-[0.34em] text-slate-400">
                Total check-ins today
              </p>
              <p className="text-6xl md:text-8xl font-extrabold tabular-nums text-amber-300 drop-shadow-[0_12px_40px_rgba(251,191,36,0.15)]">
                {total}
              </p>
              <p className="mt-2 text-[12px] text-slate-400">
                As of{" "}
                <span className="text-slate-200 font-semibold">
                  {asOfIso ? formatTime(asOfIso, etTz) : "—"}
                </span>
              </p>
            </div>
          </div>

          {/* GOAL */}
          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[12px] uppercase tracking-[0.28em] text-slate-300">
                  Tonight’s Goal
                </p>
                <p className="mt-2 text-2xl md:text-3xl font-extrabold">
                  Road to <span className="text-emerald-300">{goalTotal}</span> check-ins
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

          {/* MAIN GRID */}
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {/* LEFT: SCAN + QR + APP INSTALL CTA */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-8">
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-3xl md:text-5xl font-extrabold leading-tight">
                    SCAN TO CHECK IN ✅
                  </p>
                  <p className="mt-3 text-lg md:text-2xl text-slate-200">
                    Get counted tonight — unlock perks, rewards, and VIP surprises.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-[280px_1fr] items-center">
                  <div className="rounded-2xl border border-slate-700 bg-black/30 p-4 w-fit">
                    <Image
                      src={checkinQrSrc}
                      alt="Check-in QR"
                      width={260}
                      height={260}
                      className="rounded-xl"
                      priority
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[12px] uppercase tracking-[0.28em] text-slate-300">
                      How to check in
                    </p>
                    <ol className="mt-3 space-y-2 text-xl md:text-2xl">
                      <li className="flex gap-3">
                        <span className="text-amber-300 font-black">1.</span>
                        <span>
                          <span className="font-extrabold">Install the app</span> (scan the App Store QR below)
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
                          Tap <span className="font-extrabold">Scan QR</span> → you’re checked in 🎉
                        </span>
                      </li>
                    </ol>

                    <div className="mt-6 rounded-2xl border border-slate-800 bg-black/20 p-5">
                      <p className="text-[12px] uppercase tracking-[0.28em] text-slate-300">
                        Don’t have the app?
                      </p>
                      <p className="mt-2 text-lg md:text-xl text-slate-200 font-extrabold">
                        {appStoreLabel}
                      </p>
                      <p className="mt-1 text-slate-300">
                        Earn rewards • Track check-ins • Unlock VIP perks
                      </p>

                      <div className="mt-4 flex items-center gap-4">
                        <div className="rounded-xl border border-slate-800 bg-black/30 p-3">
                          <Image
                            src={appStoreQrSrc}
                            alt="App Store QR"
                            width={120}
                            height={120}
                            className="rounded-lg"
                          />
                        </div>
                        <p className="text-base text-slate-200">
                          Scan to install now.
                          <span className="block text-sm text-slate-400 mt-1">
                            Then come back and scan the big Check-In QR.
                          </span>
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-[12px] text-slate-400">
                      Staff script: “Install the app, open Check In, then scan the QR — it takes 10 seconds.”
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: BREAKDOWN + RECENT */}
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-6">
                <p className="text-[12px] uppercase tracking-[0.28em] text-slate-300">
                  Breakdown
                </p>

                <div className="mt-4 grid gap-4">
                  <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                    <p className="text-slate-300 text-sm uppercase tracking-[0.18em]">VIP</p>
                    <p className="mt-1 text-5xl font-extrabold tabular-nums text-amber-300">{vip}</p>
                    <p className="mt-1 text-[12px] text-slate-400">Rewards check-ins</p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                    <p className="text-slate-300 text-sm uppercase tracking-[0.18em]">Guest</p>
                    <p className="mt-1 text-5xl font-extrabold tabular-nums text-teal-300">{guest}</p>
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

          <p className="mt-10 text-center text-[11px] text-slate-600">
            Timezone: {etTz} • Live venue display
          </p>
        </div>
      </div>
    </div>
  );
}
