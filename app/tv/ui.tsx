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
  const baseTop = size === "big" ? 6 : 10;
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

function prettyLoc(loc: string) {
  const s = loc.replace(/[-_]/g, " ").trim();
  if (!s) return "Entrance";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Auto-fit scaler (FIXED):
 * - Renders a fixed 1920x1080 stage
 * - Scales DOWN on small viewports, scales UP on large (4K) viewports
 * - Safe padding protects against TV overscan / kiosk browser chrome
 */
function useStageScale(stageW: number, stageH: number, safePaddingPx: number) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const availW = Math.max(1, vw - safePaddingPx * 2);
      const availH = Math.max(1, vh - safePaddingPx * 2);

      // ✅ Allow upscale (this is the fix)
      const s = Math.min(availW / stageW, availH / stageH);

      // Guard against bizarre values
      const safe = Number.isFinite(s) && s > 0 ? s : 1;

      setScale(safe);
    };

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, [stageW, stageH, safePaddingPx]);

  return scale;
}

export default function TvKioskClient(props: {
  kioskKey: string;
  etDateMdy: string;
  etTz: string;

  goalBase: number;
  goalStep: number;
  goalAdvanceAtPct: number;

  showLogoSrc: string;
  helpQrSrc: string;
  venueQrSrc: string;
  locationLabel: string;
}) {
  const { kioskKey, etDateMdy, etTz, goalBase, goalStep, goalAdvanceAtPct, showLogoSrc, helpQrSrc, venueQrSrc, locationLabel } =
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

  const locLabel = prettyLoc(locationLabel);

  const STAGE_W = 1920;
  const STAGE_H = 1080;

  // If a TV is cropping edges, increase to 40.
  const scale = useStageScale(STAGE_W, STAGE_H, 28);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black via-slate-950 to-[#0b1220] text-white overflow-hidden">
      <style jsx global>{`
        @keyframes ssdtLevelUpIn {
          0% { transform: translateY(10px) scale(0.98); opacity: 0; }
          25% { transform: translateY(0px) scale(1.02); opacity: 1; }
          70% { transform: translateY(0px) scale(1.02); opacity: 1; }
          100% { transform: translateY(-6px) scale(1); opacity: 0; }
        }
        @keyframes ssdtGlowPulse {
          0% { filter: drop-shadow(0 0 0 rgba(251,191,36,0.0)); }
          50% { filter: drop-shadow(0 0 30px rgba(251,191,36,0.6)); }
          100% { filter: drop-shadow(0 0 0 rgba(251,191,36,0.0)); }
        }
      `}</style>

      <div ref={confettiRef} className="pointer-events-none fixed inset-0 z-50" />

      {levelUpVisible && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
          <div
            className="relative rounded-[28px] border border-amber-300/35 bg-gradient-to-br from-slate-950/95 via-black/85 to-slate-950/95 px-12 py-10 text-center"
            style={{ animation: "ssdtLevelUpIn 1350ms cubic-bezier(.2,.8,.2,1) forwards" }}
          >
            <div style={{ animation: "ssdtGlowPulse 700ms ease-in-out 2" }}>
              <p className="text-[14px] uppercase tracking-[0.34em] text-slate-300">Sugarshack Downtown</p>
              <p className="mt-3 font-extrabold text-[84px] leading-none text-amber-300">LEVEL UP!</p>
              <p className="mt-3 text-slate-200 font-extrabold text-[28px]">
                New Goal: <span className="text-emerald-300 tabular-nums">{levelUpGoal ?? dynamicGoal}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STAGE WRAPPER (centered + scaled) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="origin-center"
          style={{
            width: `${STAGE_W}px`,
            height: `${STAGE_H}px`,
            transform: `scale(${scale})`,
          }}
        >
          {/* STAGE CONTENT */}
          <div className="h-full w-full p-8">
            {/* HEADER */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 min-w-0">
                <div className="relative h-[120px] w-[120px] shrink-0">
                  <Image src={showLogoSrc} alt="Sugarshack Downtown" fill className="object-contain" priority />
                </div>

                <div className="min-w-0">
                  <p className="text-[12px] uppercase tracking-[0.34em] text-slate-300">Sugarshack Downtown</p>
                  <h1 className="mt-2 text-[56px] font-extrabold leading-[1.0]">CHECK IN &amp; GET COUNTED</h1>
                  <p className="mt-2 text-[20px] text-slate-200">
                    Guest is fast. <span className="text-amber-300 font-extrabold">VIP unlocks rewards</span>.
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400">
                    <span>
                      ET: <span className="font-semibold text-slate-200">{etDateMdy}</span>
                    </span>
                    <span className="opacity-50">•</span>
                    <span>
                      As of{" "}
                      <span className="text-slate-200 font-semibold">{asOfIso ? formatTime(asOfIso, etTz) : "—"}</span>
                    </span>
                    <span className="opacity-50">•</span>
                    <span className="text-slate-300 font-semibold">{locLabel}</span>
                    <span className="opacity-50">•</span>
                    <span>Auto-updates 5s</span>
                  </div>

                  {err && <p className="mt-2 text-[14px] text-rose-300">Data loading issue: {err}</p>}
                </div>
              </div>

              <div className="text-right">
                <p className="text-[14px] uppercase tracking-[0.34em] text-slate-400">TOTAL TODAY</p>
                <p className="mt-2 font-extrabold tabular-nums text-amber-300 leading-none text-[220px]">{total}</p>
              </div>
            </div>

            {/* GOAL */}
            <div className="mt-6 rounded-[28px] border border-slate-800 bg-slate-900/40 px-8 py-7">
              <div className="flex items-center justify-between">
                <p className="text-[26px] text-slate-200 font-extrabold">
                  Next goal: <span className="text-emerald-300 tabular-nums">{dynamicGoal}</span>{" "}
                  <span className="text-slate-400 font-semibold">({remainingToGoal} to go)</span>
                </p>
                <p className="text-[26px] text-slate-200 font-extrabold tabular-nums">{goalPct.toFixed(0)}%</p>
              </div>

              <div className="mt-5 h-[26px] w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 transition-all"
                  style={{ width: `${goalPct}%` }}
                />
              </div>
            </div>

            {/* COUNTS */}
            <div className="mt-6 grid grid-cols-3 gap-6">
              <div className="rounded-[28px] border border-slate-800 bg-slate-900/40 px-8 py-7">
                <p className="text-[14px] uppercase tracking-[0.28em] text-slate-400">VIP</p>
                <p className="mt-3 text-[120px] font-extrabold tabular-nums text-amber-300 leading-none">{vip}</p>
                <p className="mt-2 text-[16px] text-slate-300">Rewards • perks • surprises</p>
              </div>

              <div className="rounded-[28px] border border-slate-800 bg-slate-900/40 px-8 py-7">
                <p className="text-[14px] uppercase tracking-[0.28em] text-slate-400">GUEST</p>
                <p className="mt-3 text-[120px] font-extrabold tabular-nums text-teal-300 leading-none">{guest}</p>
                <p className="mt-2 text-[16px] text-slate-300">Fast check-in (VIP later)</p>
              </div>

              <div className="rounded-[28px] border border-slate-800 bg-slate-900/40 px-8 py-7">
                <p className="text-[14px] uppercase tracking-[0.28em] text-slate-400">TOTAL</p>
                <p className="mt-3 text-[120px] font-extrabold tabular-nums text-amber-300 leading-none">{total}</p>
                <p className="mt-2 text-[16px] text-slate-300">Get counted tonight</p>
              </div>
            </div>

            {/* BOTTOM: TWO LANES */}
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div className="rounded-[28px] border border-slate-800 bg-slate-900/45 px-8 py-7">
                <p className="text-[14px] uppercase tracking-[0.34em] text-slate-400">STILL NEED THE APP?</p>
                <p className="mt-3 text-[40px] font-extrabold leading-tight">Don’t miss out — get VIP rewards 🎁</p>
                <p className="mt-2 text-[18px] text-slate-300">
                  Scan with your camera to install + see steps. iPhone now • Android soon.
                </p>

                <div className="mt-6 flex items-center gap-6">
                  <div className="rounded-[28px] bg-white p-5">
                    <div className="relative h-[240px] w-[240px]">
                      <Image src={helpQrSrc} alt="Help / Install QR" fill className="object-contain" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[22px] font-extrabold text-slate-200">Camera scan → Get started</p>
                    <p className="mt-2 text-[16px] text-slate-400">
                      Install → Open app → Login (Guest OK) → Check In → Scan Venue QR
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-800 bg-slate-900/45 px-8 py-7">
                <p className="text-[14px] uppercase tracking-[0.34em] text-slate-400">GOT THE APP?</p>
                <p className="mt-3 text-[40px] font-extrabold leading-tight">I’m ready — scan to check in ✅</p>
                <p className="mt-2 text-[18px] text-slate-300">
                  Open app → <span className="font-extrabold text-slate-100">Check In</span> →{" "}
                  <span className="font-extrabold text-slate-100">Scan QR</span>
                </p>

                <div className="mt-6 flex items-center justify-center">
                  <div className="rounded-[32px] bg-white p-6">
                    <div className="relative h-[380px] w-[380px]">
                      <Image src={venueQrSrc} alt="Venue QR" fill className="object-contain" priority />
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-center text-[14px] text-slate-400">
                  Must scan inside the app (camera scan won’t check you in).
                </p>
              </div>
            </div>
          </div>
          {/* /STAGE CONTENT */}
        </div>
      </div>
    </div>
  );
}
