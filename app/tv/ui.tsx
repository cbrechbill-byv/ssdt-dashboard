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
  dateEt: string;
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
  return d.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
}

function computeDynamicGoal(params: { total: number; base: number; step: number; advanceAtPct: number }): number {
  const total = Math.max(0, Math.floor(params.total || 0));
  const base = Math.max(1, Math.floor(params.base || 1));
  const step = Math.max(1, Math.floor(params.step || 1));
  const advanceAtPct = Math.max(1, Math.min(99, Math.floor(params.advanceAtPct || 90)));

  let goal = base;
  for (let i = 0; i < 200; i++) {
    const threshold = Math.floor(goal * (advanceAtPct / 100));
    if (total >= threshold) goal += step;
    else break;
  }
  if (goal <= total) {
    const bumps = Math.ceil((total - goal + 1) / step);
    goal += bumps * step;
  }
  return goal;
}

type ConfettiSize = "normal" | "big";

function burstConfetti(container: HTMLElement, size: ConfettiSize) {
  const colors = ["#FBBF24", "#34D399", "#22D3EE", "#A78BFA", "#FB7185", "#FFFFFF"];
  const count = size === "big" ? 64 : 22;
  const baseTop = size === "big" ? 8 : 10;
  const baseDuration = size === "big" ? 1200 : 850;

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const px = size === "big" ? 8 + Math.random() * 10 : 6 + Math.random() * 8;
    const left = 5 + Math.random() * 90;
    const delay = Math.random() * (size === "big" ? 120 : 60);
    const duration = baseDuration + Math.random() * (size === "big" ? 900 : 650);
    const rotate = Math.random() * 360;

    p.style.position = "absolute";
    p.style.left = `${left}%`;
    p.style.top = `${baseTop}%`;
    p.style.width = `${px}px`;
    p.style.height = `${px * 0.65}px`;
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.borderRadius = "2px";
    p.style.transform = `rotate(${rotate}deg)`;
    p.style.opacity = "0.98";
    p.style.pointerEvents = "none";
    p.style.filter = "drop-shadow(0 12px 22px rgba(0,0,0,0.45))";

    const drift = (Math.random() - 0.5) * (size === "big" ? 420 : 220);
    const fall = (size === "big" ? 420 : 240) + Math.random() * (size === "big" ? 380 : 240);

    p.animate(
      [
        { transform: `translate(0px, 0px) rotate(${rotate}deg)`, opacity: 1 },
        { transform: `translate(${drift}px, ${fall}px) rotate(${rotate + 300}deg)`, opacity: 0 },
      ],
      { duration, delay, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }
    );

    container.appendChild(p);
    window.setTimeout(() => p.remove(), duration + delay + 30);
  }
}

export default function TvKioskClient(props: {
  kioskKey: string;
  etDateMdy: string;
  etTz: string;

  goalBase: number;
  goalStep: number;
  goalAdvanceAtPct: number;

  appStoreLabel: string;
  showLogoSrc: string;
  checkinQrSrc: string;
  appStoreQrSrc: string;
}) {
  const { kioskKey, etDateMdy, etTz, goalBase, goalStep, goalAdvanceAtPct, appStoreLabel, showLogoSrc, checkinQrSrc, appStoreQrSrc } =
    props;

  const [data, setData] = useState<TvApiResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const lastTotalRef = useRef<number>(0);
  const lastGoalRef = useRef<number>(0);
  const didInitRef = useRef<boolean>(false);

  const confettiRef = useRef<HTMLDivElement | null>(null);

  const [levelUpVisible, setLevelUpVisible] = useState(false);
  const [levelUpGoal, setLevelUpGoal] = useState<number | null>(null);
  const levelUpTimerRef = useRef<number | null>(null);

  function showLevelUp(newGoal: number) {
    setLevelUpGoal(newGoal);
    setLevelUpVisible(true);
    if (levelUpTimerRef.current) window.clearTimeout(levelUpTimerRef.current);
    levelUpTimerRef.current = window.setTimeout(() => setLevelUpVisible(false), 1350);
  }

  async function load() {
    try {
      setErr(null);
      const res = await fetch(`/api/tv?key=${encodeURIComponent(kioskKey)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = (await res.json()) as TvApiResponse;

      const nextTotal = json?.total ?? 0;
      const nextGoal = computeDynamicGoal({ total: nextTotal, base: goalBase, step: goalStep, advanceAtPct: goalAdvanceAtPct });

      if (!didInitRef.current) {
        didInitRef.current = true;
        lastTotalRef.current = nextTotal;
        lastGoalRef.current = nextGoal;
        setData(json);
        return;
      }

      const prevTotal = lastTotalRef.current ?? 0;
      const prevGoal = lastGoalRef.current ?? 0;

      const totalIncreased = nextTotal > prevTotal;
      const goalLeveledUp = nextGoal > prevGoal;

      lastTotalRef.current = nextTotal;
      lastGoalRef.current = nextGoal;

      setData(json);

      if (confettiRef.current) {
        if (goalLeveledUp) {
          showLevelUp(nextGoal);
          burstConfetti(confettiRef.current, "big");
        } else if (totalIncreased) {
          burstConfetti(confettiRef.current, "normal");
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    }
  }

  useEffect(() => {
    load();
    const t = window.setInterval(load, 5000);
    return () => {
      window.clearInterval(t);
      if (levelUpTimerRef.current) window.clearTimeout(levelUpTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = data?.total ?? 0;
  const vip = data?.vip ?? 0;
  const guest = data?.guest ?? 0;
  const asOfIso = data?.asOfIso ?? null;

  const dynamicGoal = useMemo(
    () => computeDynamicGoal({ total, base: goalBase, step: goalStep, advanceAtPct: goalAdvanceAtPct }),
    [total, goalBase, goalStep, goalAdvanceAtPct]
  );

  const goalPct = useMemo(() => clampPct(dynamicGoal > 0 ? (total / dynamicGoal) * 100 : 0), [total, dynamicGoal]);
  const remainingToGoal = Math.max(0, dynamicGoal - total);

  return (
    <div className="tv-root min-h-screen md:h-[100dvh] md:overflow-hidden text-white">
      <style jsx global>{`
        .tv-root {
          --pad: clamp(10px, 1.4vh, 18px);
          --gap: clamp(10px, 1.3vh, 16px);
          --logo: clamp(52px, 6.2vh, 110px);
          --h1: clamp(22px, 2.9vh, 44px);
          --body: clamp(12px, 1.35vh, 17px);
          --total: clamp(38px, 4.8vh, 86px);
          --venueQR: clamp(220px, 28vh, 360px);
          --installQR: clamp(120px, 16vh, 170px);
        }
        @media (max-height: 820px) {
          .tv-root {
            --venueQR: clamp(210px, 26vh, 330px);
            --installQR: clamp(110px, 14vh, 150px);
          }
        }

        @keyframes ssdtLevelUpIn {
          0% { transform: translateY(10px) scale(0.98); opacity: 0; }
          25% { transform: translateY(0px) scale(1.02); opacity: 1; }
          70% { transform: translateY(0px) scale(1.02); opacity: 1; }
          100% { transform: translateY(-6px) scale(1); opacity: 0; }
        }
        @keyframes ssdtGlowPulse {
          0% { filter: drop-shadow(0 0 0 rgba(251,191,36,0.0)); }
          50% { filter: drop-shadow(0 0 22px rgba(251,191,36,0.45)); }
          100% { filter: drop-shadow(0 0 0 rgba(251,191,36,0.0)); }
        }
      `}</style>

      <div ref={confettiRef} className="pointer-events-none fixed inset-0 z-50" />

      {levelUpVisible && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
          <div
            className="relative rounded-[28px] border border-amber-300/35 bg-gradient-to-br from-slate-950/95 via-black/85 to-slate-950/95 px-8 py-6 text-center"
            style={{ animation: "ssdtLevelUpIn 1350ms cubic-bezier(.2,.8,.2,1) forwards" }}
          >
            <div style={{ animation: "ssdtGlowPulse 700ms ease-in-out 2" }}>
              <p className="text-[12px] uppercase tracking-[0.34em] text-slate-300">Sugarshack Downtown</p>
              <p className="mt-2 font-extrabold text-[clamp(38px,6vw,84px)] leading-none text-amber-300">LEVEL UP!</p>
              <p className="mt-2 text-slate-200 font-extrabold text-[clamp(16px,2vw,28px)]">
                New Goal: <span className="text-emerald-300 tabular-nums">{levelUpGoal ?? dynamicGoal}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen md:h-[100dvh] bg-gradient-to-br from-black via-slate-950 to-[#0b1220] px-[var(--pad)] py-[var(--pad)]">
        <div className="mx-auto w-full max-w-7xl md:h-full md:flex md:flex-col md:min-h-0">
          {/* HEADER */}
          <div className="flex items-start justify-between gap-[var(--gap)]">
            <div className="flex items-start gap-[var(--gap)] min-w-0">
              <div className="relative shrink-0 h-[var(--logo)] w-[var(--logo)]">
                <Image src={showLogoSrc} alt="Sugarshack Downtown" fill className="object-contain" priority />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] sm:text-[12px] uppercase tracking-[0.32em] text-slate-300">Sugarshack Downtown</p>
                <h1 className="mt-1 font-extrabold leading-[1.05] text-[length:var(--h1)]">CHECK IN & GET COUNTED</h1>
                <p className="mt-1 text-slate-200 text-[length:var(--body)]">
                  Guest is fast. <span className="text-amber-300 font-extrabold">VIP unlocks rewards</span> — join the VIP count.
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
                  <span>
                    ET: <span className="font-semibold text-slate-200">{etDateMdy}</span>
                  </span>
                  <span className="opacity-50">•</span>
                  <span>
                    As of{" "}
                    <span className="text-slate-200 font-semibold">{asOfIso ? formatTime(asOfIso, etTz) : "—"}</span>
                  </span>
                  <span className="opacity-50">•</span>
                  <span>Auto-updates 5s</span>
                </div>

                {err && <p className="mt-2 text-sm text-rose-300">Data loading issue: {err}</p>}
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-400">Total today</p>
              <p className="font-extrabold tabular-nums text-amber-300 leading-none text-[length:var(--total)]">{total}</p>
            </div>
          </div>

          {/* GOAL */}
          <div className="mt-[var(--gap)] rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-2.5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-slate-200 font-extrabold text-[clamp(12px,1.1vw,14px)]">
                Next goal: <span className="text-emerald-300 tabular-nums">{dynamicGoal}</span>
                <span className="text-slate-400 font-semibold">{" "}({remainingToGoal} to go)</span>
              </p>
              <p className="text-slate-300 font-semibold tabular-nums text-[clamp(12px,1.1vw,14px)]">{goalPct.toFixed(0)}%</p>
            </div>
            <div className="mt-2 h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div className="h-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 transition-all" style={{ width: `${goalPct}%` }} />
            </div>
          </div>

          {/* MAIN: scoreboard + two QRs */}
          <div className="mt-[var(--gap)] grid gap-[var(--gap)] md:flex-1 md:min-h-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            {/* LEFT: VIP vs Guest conversion + quick steps */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-4 sm:p-5 md:p-6 md:min-h-0 flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-300">Tonight’s mission</p>
                  <p className="mt-1 font-extrabold text-[clamp(18px,2.2vw,34px)] leading-tight">
                    Help VIP win — check in now 🔥
                  </p>
                  <p className="mt-1 text-slate-200 text-[length:var(--body)]">
                    Install → Login → Check In → Scan the Venue QR.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 shrink-0">
                  <div className="rounded-2xl border border-slate-800 bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Total</p>
                    <p className="font-extrabold tabular-nums text-amber-300 text-[clamp(16px,1.9vw,28px)] leading-none">{total}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">VIP</p>
                    <p className="font-extrabold tabular-nums text-amber-300 text-[clamp(16px,1.9vw,28px)] leading-none">{vip}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Guest</p>
                    <p className="font-extrabold tabular-nums text-teal-300 text-[clamp(16px,1.9vw,28px)] leading-none">{guest}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Fast steps</p>
                <p className="mt-1 text-slate-200 font-extrabold text-[clamp(14px,1.4vw,18px)]">
                  Guest is OK ✅ VIP gets rewards 🎁
                </p>
                <div className="mt-2 text-slate-300 text-[clamp(12px,1.2vw,15px)]">
                  1) Install the app (camera scan){" "}
                  <span className="opacity-60">•</span> 2) Open app & login{" "}
                  <span className="opacity-60">•</span> 3) Check In → Scan QR
                </div>
              </div>

              <div className="mt-auto pt-4">
                <div className="rounded-2xl border border-slate-800 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">No phone?</p>
                  <p className="mt-1 text-slate-200 font-extrabold">No problem — you’re still welcome in.</p>
                  <p className="mt-1 text-sm text-slate-400">Staff can help you check in later inside the venue.</p>
                </div>
              </div>
            </div>

            {/* RIGHT: QRs (bounded so they never cover anything) */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-4 sm:p-5 md:p-6 md:min-h-0 flex flex-col gap-[var(--gap)]">
              {/* Install QR */}
              <div className="rounded-3xl border border-slate-800 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Camera scan</p>
                    <p className="mt-1 font-extrabold text-[clamp(16px,1.8vw,22px)]">Install the app</p>
                    <p className="mt-1 text-slate-300 text-[clamp(12px,1.1vw,14px)]">
                      iPhone now • Android coming soon
                    </p>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-white p-2">
                    <div className="relative h-[var(--installQR)] w-[var(--installQR)]">
                      <Image src={appStoreQrSrc} alt="App Store QR" fill className="object-contain" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Venue QR */}
              <div className="rounded-3xl border border-slate-700 bg-black/30 p-4 flex-1 flex flex-col">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-300">Inside the app</p>
                <p className="mt-1 font-extrabold text-[clamp(16px,1.8vw,22px)]">Scan Venue QR to check in</p>
                <p className="mt-1 text-slate-300 text-[clamp(12px,1.1vw,14px)]">
                  Open app → Check In → Scan QR
                </p>

                <div className="mt-3 flex-1 flex items-center justify-center">
                  <div className="rounded-2xl bg-white p-3">
                    <div className="relative h-[var(--venueQR)] w-[var(--venueQR)] max-w-[38vw] max-h-[38vw]">
                      <Image src={checkinQrSrc} alt="Venue Check-In QR" fill className="object-contain" priority />
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-center text-slate-400 text-[clamp(11px,1.0vw,13px)]">
                  (Camera scan won’t check you in — you must scan this inside the app.)
                </p>
              </div>

              {/* tiny helper copy (no raw URL) */}
              <div className="rounded-2xl border border-slate-800 bg-black/20 p-3">
                <p className="text-[11px] text-slate-400">
                  Staff script: “Install → login (Guest OK) → Check In → Scan Venue QR.”
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2 md:hidden text-center text-[11px] text-slate-600">Timezone: {etTz}</div>
        </div>
      </div>
    </div>
  );
}
