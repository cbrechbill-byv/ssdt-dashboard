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
  const count = size === "big" ? 70 : 26;
  const baseTop = size === "big" ? 6 : 10;
  const baseDuration = size === "big" ? 1350 : 900;

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const px = size === "big" ? 8 + Math.random() * 12 : 6 + Math.random() * 8;
    const left = 4 + Math.random() * 92;
    const delay = Math.random() * (size === "big" ? 140 : 70);
    const duration = baseDuration + Math.random() * (size === "big" ? 950 : 650);
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
    p.style.filter = "drop-shadow(0 14px 26px rgba(0,0,0,0.55))";

    const drift = (Math.random() - 0.5) * (size === "big" ? 520 : 260);
    const fall = (size === "big" ? 520 : 260) + Math.random() * (size === "big" ? 420 : 260);

    p.animate(
      [
        { transform: `translate(0px, 0px) rotate(${rotate}deg)`, opacity: 1 },
        { transform: `translate(${drift}px, ${fall}px) rotate(${rotate + 320}deg)`, opacity: 0 },
      ],
      { duration, delay, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }
    );

    container.appendChild(p);
    window.setTimeout(() => p.remove(), duration + delay + 50);
  }
}

function prettyLoc(loc: string) {
  const s = loc.replace(/[-_]/g, " ").trim();
  if (!s) return "Entrance";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatCard(props: {
  label: string;
  value: number;
  valueClassName?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[calc(2.2*var(--u))] border border-slate-800 bg-slate-900/50 px-[calc(2.0*var(--u))] py-[calc(1.8*var(--u))]">
      <p className="uppercase tracking-[0.28em] text-slate-400" style={{ fontSize: "calc(1.1*var(--u))" }}>
        {props.label}
      </p>
      <div
        className={`mt-[calc(0.7*var(--u))] font-extrabold tabular-nums leading-none ${props.valueClassName ?? ""}`}
        style={{ fontSize: "calc(7.0*var(--u))" }}
      >
        {props.value}
      </div>
      {props.sub ? (
        <p className="mt-[calc(0.55*var(--u))] text-slate-300" style={{ fontSize: "calc(1.25*var(--u))" }}>
          {props.sub}
        </p>
      ) : null}
    </div>
  );
}

function StepRow(props: { n: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-[calc(1.0*var(--u))]">
      <div
        className="shrink-0 rounded-[calc(1.4*var(--u))] border border-amber-300/30 bg-amber-300/10 text-amber-300 font-extrabold flex items-center justify-center"
        style={{
          width: "calc(4.2*var(--u))",
          height: "calc(4.2*var(--u))",
          fontSize: "calc(2.4*var(--u))",
          lineHeight: 1,
        }}
      >
        {props.n}
      </div>
      <div className="min-w-0">
        <div className="text-slate-100 font-extrabold" style={{ fontSize: "calc(1.8*var(--u))" }}>
          {props.title}
        </div>
        <div className="text-slate-300" style={{ fontSize: "calc(1.35*var(--u))" }}>
          {props.desc}
        </div>
      </div>
    </div>
  );
}

function QrLane(props: {
  tone: "need" | "have";
  heading: string;
  headline: string;
  bullets: string[];
  qrSrc: string;
  qrAlt: string;
  footnote: string;
}) {
  const isHave = props.tone === "have";
  return (
    <div
      className={
        isHave
          ? "rounded-[calc(2.2*var(--u))] border border-amber-300/25 bg-gradient-to-br from-slate-900/60 via-black/40 to-slate-900/50 px-[calc(2.2*var(--u))] py-[calc(2.0*var(--u))]"
          : "rounded-[calc(2.2*var(--u))] border border-slate-800 bg-slate-900/50 px-[calc(2.2*var(--u))] py-[calc(2.0*var(--u))]"
      }
    >
      <div className="flex items-start justify-between gap-[calc(1.6*var(--u))]">
        <div className="min-w-0">
          <p
            className={isHave ? "uppercase tracking-[0.34em] text-amber-200/80" : "uppercase tracking-[0.34em] text-slate-300"}
            style={{ fontSize: "calc(1.15*var(--u))" }}
          >
            {props.heading}
          </p>

          <div
            className="mt-[calc(0.7*var(--u))] font-extrabold leading-[1.05]"
            style={{ fontSize: isHave ? "calc(3.0*var(--u))" : "calc(2.85*var(--u))" }}
          >
            {props.headline}
          </div>

          <div className="mt-[calc(1.0*var(--u))] space-y-[calc(0.55*var(--u))]">
            {props.bullets.map((b, idx) => (
              <div key={idx} className="flex items-start gap-[calc(0.7*var(--u))]">
                <div
                  className={isHave ? "text-amber-300" : "text-emerald-300"}
                  style={{ fontSize: "calc(1.5*var(--u))", lineHeight: 1 }}
                >
                  •
                </div>
                <div className={isHave ? "text-slate-200" : "text-slate-300"} style={{ fontSize: "calc(1.4*var(--u))" }}>
                  {b}
                </div>
              </div>
            ))}
          </div>

          <div
            className={
              isHave
                ? "mt-[calc(1.1*var(--u))] rounded-[calc(1.8*var(--u))] border border-amber-300/20 bg-black/35 px-[calc(1.4*var(--u))] py-[calc(1.0*var(--u))]"
                : "mt-[calc(1.1*var(--u))] rounded-[calc(1.8*var(--u))] border border-slate-800 bg-black/30 px-[calc(1.4*var(--u))] py-[calc(1.0*var(--u))]"
            }
          >
            <div className="text-slate-100 font-extrabold" style={{ fontSize: "calc(1.45*var(--u))" }}>
              {props.footnote}
            </div>
          </div>
        </div>

        {/* SAME SIZE QR for BOTH lanes */}
        <div className="shrink-0 rounded-[calc(2.0*var(--u))] bg-white p-[calc(1.0*var(--u))]">
          <div
            className="relative"
            style={{
              width: "calc(16.0*var(--u))",
              height: "calc(16.0*var(--u))",
            }}
          >
            <Image src={props.qrSrc} alt={props.qrAlt} fill className="object-contain" priority={isHave} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TvKioskClient(props: {
  kioskKey: string;
  etDateMdy: string;
  etTz: string;

  goalBase: number;
  goalStep: number;
  goalAdvanceAtPct: number;

  showLogoSrc: string;
  helpQrSrc: string; // camera scan -> should go to /checkin
  venueQrSrc: string; // in-app scan -> check-in token QR
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
      const nextGoal = computeDynamicGoal({
        total: nextTotal,
        base: goalBase,
        step: goalStep,
        advanceAtPct: goalAdvanceAtPct,
      });

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

  return (
    <div className="fixed inset-0 overflow-hidden text-white">
      <style jsx global>{`
        :root {
          --u: min(1vw, 1vh);
        }

        .tvSafe {
          padding:
            calc(2.3 * var(--u) + env(safe-area-inset-top))
            calc(2.8 * var(--u) + env(safe-area-inset-right))
            calc(2.3 * var(--u) + env(safe-area-inset-bottom))
            calc(2.8 * var(--u) + env(safe-area-inset-left));
        }

        @keyframes ssdtLevelUpIn {
          0% { transform: translateY(10px) scale(0.98); opacity: 0; }
          25% { transform: translateY(0px) scale(1.02); opacity: 1; }
          70% { transform: translateY(0px) scale(1.02); opacity: 1; }
          100% { transform: translateY(-6px) scale(1); opacity: 0; }
        }
        @keyframes ssdtGlowPulse {
          0% { filter: drop-shadow(0 0 0 rgba(251,191,36,0.0)); }
          50% { filter: drop-shadow(0 0 34px rgba(251,191,36,0.65)); }
          100% { filter: drop-shadow(0 0 0 rgba(251,191,36,0.0)); }
        }
      `}</style>

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-950 to-[#0b1220]" />
      <div className="pointer-events-none absolute inset-0 opacity-35">
        <div className="absolute -top-[12vh] left-[10vw] h-[34vh] w-[34vh] rounded-full bg-amber-400 blur-[120px]" />
        <div className="absolute bottom-[-12vh] right-[-10vw] h-[34vh] w-[34vh] rounded-full bg-teal-400 blur-[140px]" />
        <div className="absolute top-[28vh] right-[30vw] h-[26vh] w-[26vh] rounded-full bg-fuchsia-400 blur-[140px] opacity-50" />
      </div>

      <div ref={confettiRef} className="pointer-events-none fixed inset-0 z-50" />

      {levelUpVisible && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
          <div
            className="relative rounded-[calc(2.2*var(--u))] border border-amber-300/40 bg-gradient-to-br from-slate-950/95 via-black/85 to-slate-950/95 px-[calc(4*var(--u))] py-[calc(3.2*var(--u))] text-center"
            style={{ animation: "ssdtLevelUpIn 1350ms cubic-bezier(.2,.8,.2,1) forwards" }}
          >
            <div style={{ animation: "ssdtGlowPulse 700ms ease-in-out 2" }}>
              <p className="uppercase tracking-[0.34em] text-slate-300" style={{ fontSize: "calc(1.1*var(--u))" }}>
                Sugarshack Downtown
              </p>
              <p
                className="mt-[calc(1*var(--u))] font-extrabold leading-none text-amber-300"
                style={{ fontSize: "calc(7.4*var(--u))" }}
              >
                LEVEL UP!
              </p>
              <p className="mt-[calc(0.8*var(--u))] text-slate-200 font-extrabold" style={{ fontSize: "calc(2.2*var(--u))" }}>
                New Goal: <span className="text-emerald-300 tabular-nums">{levelUpGoal ?? dynamicGoal}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Layout */}
      <div className="relative h-[100svh] w-full tvSafe">
        <div className="mx-auto h-full w-full max-w-[1850px]">
          <div className="grid h-full grid-rows-[auto_auto_1fr_auto] gap-[calc(1.3*var(--u))]">
            {/* HEADER */}
            <div className="flex items-start justify-between gap-[calc(1.6*var(--u))]">
              <div className="flex items-start gap-[calc(1.8*var(--u))] min-w-0">
                {/* BIGGER LOGO */}
                <div
                  className="relative shrink-0"
                  style={{
                    width: "calc(9.2*var(--u))",
                    height: "calc(9.2*var(--u))",
                    minWidth: "calc(9.2*var(--u))",
                  }}
                >
                  <Image src={showLogoSrc} alt="Sugarshack Downtown" fill className="object-contain" priority />
                </div>

                <div className="min-w-0">
                  <p className="uppercase tracking-[0.34em] text-slate-300" style={{ fontSize: "calc(1.1*var(--u))" }}>
                    Sugarshack Downtown
                  </p>

                  {/* Required: split title across two lines */}
                  <div className="mt-[calc(0.55*var(--u))] leading-[0.9] font-extrabold">
                    <div style={{ fontSize: "calc(6.0*var(--u))" }}>CHECK IN</div>
                    <div style={{ fontSize: "calc(5.2*var(--u))" }}>GET COUNTED</div>
                  </div>

                  <p className="mt-[calc(0.9*var(--u))] text-slate-200" style={{ fontSize: "calc(1.65*var(--u))" }}>
                    New app. New perks.{" "}
                    <span className="text-amber-300 font-extrabold">VIP gets the good stuff</span> — don’t miss out.
                  </p>

                  <div className="mt-[calc(0.85*var(--u))] flex flex-wrap items-center gap-x-[calc(0.9*var(--u))] gap-y-[calc(0.5*var(--u))] text-slate-400">
                    <span style={{ fontSize: "calc(1.05*var(--u))" }}>
                      ET: <span className="font-semibold text-slate-200">{etDateMdy}</span>
                    </span>
                    <span className="opacity-50">•</span>
                    <span style={{ fontSize: "calc(1.05*var(--u))" }}>
                      As of <span className="font-semibold text-slate-200">{asOfIso ? formatTime(asOfIso, etTz) : "—"}</span>
                    </span>
                    <span className="opacity-50">•</span>
                    <span className="text-slate-200 font-semibold" style={{ fontSize: "calc(1.05*var(--u))" }}>
                      {locLabel}
                    </span>
                    <span className="opacity-50">•</span>
                    <span style={{ fontSize: "calc(1.05*var(--u))" }}>Auto-updates 5s</span>
                  </div>

                  {err && (
                    <p className="mt-[calc(0.7*var(--u))] text-rose-300" style={{ fontSize: "calc(1.2*var(--u))" }}>
                      Data loading issue: {err}
                    </p>
                  )}
                </div>
              </div>

              {/* TOTAL TODAY */}
              <div className="shrink-0 text-right">
                <p className="uppercase tracking-[0.34em] text-slate-400" style={{ fontSize: "calc(1.1*var(--u))" }}>
                  TOTAL TODAY
                </p>
                <div className="font-extrabold tabular-nums text-amber-300 leading-none" style={{ fontSize: "calc(11.0*var(--u))" }}>
                  {total}
                </div>
              </div>
            </div>

            {/* GOAL */}
            <div className="rounded-[calc(2.2*var(--u))] border border-slate-800 bg-slate-900/50 px-[calc(2.2*var(--u))] py-[calc(1.9*var(--u))]">
              <div className="flex items-end justify-between gap-[calc(1.2*var(--u))]">
                <div>
                  <div className="text-slate-200 font-extrabold" style={{ fontSize: "calc(2.35*var(--u))" }}>
                    Tonight’s Goal: <span className="text-emerald-300 tabular-nums">{dynamicGoal}</span>{" "}
                    <span className="text-slate-400 font-semibold">({remainingToGoal} to go)</span>
                  </div>
                  <div className="text-slate-300 font-semibold" style={{ fontSize: "calc(1.3*var(--u))" }}>
                    Hit the goal → the goal levels up 🔥 Bigger confetti when it advances 🎉
                  </div>
                </div>
                <div className="text-slate-200 font-extrabold tabular-nums" style={{ fontSize: "calc(2.35*var(--u))" }}>
                  {goalPct.toFixed(0)}%
                </div>
              </div>

              <div className="mt-[calc(1.15*var(--u))] h-[calc(2.15*var(--u))] w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 transition-all"
                  style={{ width: `${goalPct}%` }}
                />
              </div>
            </div>

            {/* MIDDLE: BIG COUNTS + VIP MOMENT (side-by-side) */}
            <div className="min-h-0 grid grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.35fr)] gap-[calc(1.3*var(--u))]">
              <StatCard label="VIP" value={vip} valueClassName="text-amber-300" sub="Rewards • perks • surprises" />
              <StatCard label="GUEST" value={guest} valueClassName="text-teal-300" sub="Fast check-in (VIP later)" />
              <StatCard label="TOTAL" value={total} valueClassName="text-amber-300" sub="Get counted tonight" />

              {/* VIP MOMENT */}
              <div className="rounded-[calc(2.2*var(--u))] border border-slate-800 bg-gradient-to-br from-slate-900/60 via-black/35 to-slate-900/50 px-[calc(2.2*var(--u))] py-[calc(2.0*var(--u))] min-h-0">
                <p className="uppercase tracking-[0.34em] text-slate-400" style={{ fontSize: "calc(1.1*var(--u))" }}>
                  VIP MOMENT
                </p>

                <div className="mt-[calc(0.9*var(--u))] font-extrabold leading-[1.05]" style={{ fontSize: "calc(3.05*var(--u))" }}>
                  VIP gets perks, rewards & surprises.
                  <span className="text-amber-300"> Guests miss out.</span>
                </div>

                <div className="mt-[calc(1.2*var(--u))] space-y-[calc(0.9*var(--u))]">
                  <StepRow n={1} title="Install the app" desc="Camera scan the “I NEED THE APP” QR below." />
                  <StepRow n={2} title="Login (Guest is OK)" desc="VIP is where the rewards live." />
                  <StepRow n={3} title="Check In → Scan QR" desc="Use the scanner inside the app to get counted." />
                </div>

                <div className="mt-[calc(1.25*var(--u))] rounded-[calc(1.8*var(--u))] border border-slate-800 bg-black/30 px-[calc(1.6*var(--u))] py-[calc(1.2*var(--u))]">
                  <div className="text-slate-100 font-extrabold" style={{ fontSize: "calc(1.55*var(--u))" }}>
                    Tonight’s vibe:
                  </div>
                  <div className="text-slate-300" style={{ fontSize: "calc(1.35*var(--u))" }}>
                    Check in now → build your VIP history → unlock more later 🎁
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM: TWO CLEAR LANES (side-by-side) */}
            <div className="grid grid-cols-2 gap-[calc(1.3*var(--u))]">
              <QrLane
                tone="need"
                heading="I NEED THE APP"
                headline="Scan this with your CAMERA"
                bullets={[
                  "This takes you to the quick install + steps page",
                  "iPhone app now • Android coming soon",
                  "Then open the app to check in",
                ]}
                qrSrc={helpQrSrc}
                qrAlt="Install / Help QR"
                footnote="Camera scan = install/help (does NOT check you in yet)"
              />

              <QrLane
                tone="have"
                heading="I HAVE THE APP"
                headline="Scan to get counted ✅"
                bullets={[
                  "Open app → Check In → Scan QR",
                  "This is the VIP way to check in",
                  "Build VIP history + rewards",
                ]}
                qrSrc={venueQrSrc}
                qrAlt="Venue Check-In QR"
                footnote="Must scan INSIDE the app (camera scan won’t check you in)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
