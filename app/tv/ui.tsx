/* eslint-disable react-hooks/exhaustive-deps */
// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\ui.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type TvApiResponse = {
  ok: boolean;
  asOfIso: string;
  dateEt: string;
  total: number;
  vip: number;
  guest: number;
};

type TvGoalResponse = {
  ok: boolean;
  goalBase?: number;
  goalStep?: number;
  goalAdvanceAtPct?: number;
  updatedAt?: string | null;
  error?: string;
};

function clampPct(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function computeDynamicGoal(params: { total: number; base: number; step: number; advanceAtPct: number }): number {
  const total = Math.max(0, Math.floor(params.total || 0));
  const base = Math.max(1, Math.floor(params.base || 1));
  const step = Math.max(1, Math.floor(params.step || 1));
  const advanceAtPct = Math.max(1, Math.min(99, Math.floor(params.advanceAtPct || 90)));

  let goal = base;
  for (let i = 0; i < 250; i++) {
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

function formatTime(iso: string, timeZone: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
}

function prettyLoc(loc: string) {
  const s = (loc || "").replace(/[-_]/g, " ").trim();
  if (!s) return "Entrance";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
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

function DoorCard(props: {
  tone: "vip" | "install";
  eyebrow: string;
  title: string;
  bullets: string[];
  qrSrc: string;
  qrAlt: string;
  foot: string;
  qrU: number; // QR square size in "u" units
  titleScale: number; // relative scale for title
}) {
  const isVip = props.tone === "vip";

  return (
    <div
      className={[
        "h-full min-h-0 overflow-hidden rounded-[calc(2.8*var(--u))] border bg-gradient-to-br",
        isVip ? "vipElite" : "",
        isVip
          ? "border-[2.5px] border-amber-300/80 from-black/70 via-slate-950/60 to-black/55"
          : "border-slate-800 from-slate-900/55 via-black/40 to-slate-900/45",
      ].join(" ")}
      style={{
        boxShadow: isVip
          ? "0 0 0 1px rgba(251,191,36,0.26) inset, 0 0 34px rgba(251,191,36,0.10)"
          : "none",
      }}
    >
      {/* ✅ 2-row layout: top content, foot bottom (prevents overlap) */}
      <div className="h-full min-h-0 grid grid-rows-[minmax(0,1fr)_auto] px-[calc(2.7*var(--u))] py-[calc(2.45*var(--u))]">
        {/* ✅ 2-column layout: copy left, QR right (NO spacer column) */}
        <div className="min-h-0 grid grid-cols-[1.15fr_auto] gap-[calc(2.4*var(--u))] items-center">
          {/* COPY */}
          <div className="min-w-0 overflow-hidden">
            <div
              className={["uppercase tracking-[0.34em] font-extrabold", isVip ? "text-amber-300" : "text-slate-300"].join(
                " "
              )}
              style={{ fontSize: "calc(1.15*var(--u))" }}
            >
              {props.eyebrow}
            </div>

            {/* Title: keep one line, but do NOT allow it to run under the QR on TVs */}
            <div
              className="mt-[calc(0.7*var(--u))] font-extrabold text-slate-100 leading-[1.02] whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ fontSize: `clamp(34px, calc(${3.10 * (props.titleScale ?? 1)}*var(--u)), 86px)` }}
              title={props.title}
            >
              {props.title}
            </div>

            <div className="mt-[calc(1.05*var(--u))] space-y-[calc(0.75*var(--u))]">
              {props.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-[calc(0.8*var(--u))]">
                  <div
                    className={isVip ? "text-amber-300" : "text-slate-300"}
                    style={{ fontSize: "calc(2.05*var(--u))", lineHeight: 1 }}
                  >
                    •
                  </div>
                  <div className="text-slate-100 font-extrabold" style={{ fontSize: "calc(1.95*var(--u))" }}>
                    {b}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* QR */}
          <div className="shrink-0 flex items-center justify-center">
            {/* 
              ✅ The bleed issue is caused by the title getting too wide on TVs.
              Fix: reserve space for QR by tightening the copy column (above),
              and keep QR centered in its column (below).
            */}
            <div className="rounded-[calc(2.2*var(--u))] bg-white p-[calc(1.15*var(--u))]">
              <div
                className="relative"
                style={{
                  width: `calc(${props.qrU}*var(--u))`,
                  height: `calc(${props.qrU}*var(--u))`,
                }}
              >
                <Image src={props.qrSrc} alt={props.qrAlt} fill className="object-contain" priority />
              </div>
            </div>
          </div>
        </div>

        {/* FOOT (full width, cannot overlap QR) */}
        <div className="mt-[calc(1.0*var(--u))] min-w-0">
          <div
            className={[
              "rounded-[calc(1.9*var(--u))] border px-[calc(1.55*var(--u))] py-[calc(1.0*var(--u))]",
              isVip ? "border-amber-300/35 bg-black/35" : "border-slate-800 bg-black/30",
            ].join(" ")}
          >
            <div className={isVip ? "text-amber-300" : "text-slate-200"} style={{ fontSize: "calc(1.6*var(--u))", fontWeight: 900 }}>
              {props.foot}
            </div>
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
  helpQrSrc: string; // NEED APP
  venueQrSrc: string; // HAVE APP
  locationLabel: string;

  oneQrMode?: boolean;

  gateOk?: boolean;
  gateReason?: string;
}) {
  const {
    kioskKey,
    etDateMdy,
    etTz,
    goalBase,
    goalStep,
    goalAdvanceAtPct,
    showLogoSrc,
    helpQrSrc,
    venueQrSrc,
    locationLabel,
    gateOk = true,
    gateReason,
  } = props;

  const [data, setData] = useState<TvApiResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [liveGoal, setLiveGoal] = useState<{ base: number; step: number; pct: number } | null>(null);
  const [goalErr, setGoalErr] = useState<string | null>(null);

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

      const base = liveGoal?.base ?? goalBase;
      const step = liveGoal?.step ?? goalStep;
      const pct = liveGoal?.pct ?? goalAdvanceAtPct;

      const nextGoal = computeDynamicGoal({ total: nextTotal, base, step, advanceAtPct: pct });

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

  async function loadGoal() {
    try {
      setGoalErr(null);
      const res = await fetch(`/api/tv-goal`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Goal API ${res.status}`);
      const json = (await res.json()) as TvGoalResponse;

      if (!json?.ok) {
        setGoalErr(json?.error ?? "Failed to load goal");
        return;
      }

      const base = Number(json.goalBase);
      const step = Number(json.goalStep);
      const pct = Number(json.goalAdvanceAtPct);

      const safeBase = Number.isFinite(base) ? Math.max(50, Math.min(50000, Math.floor(base))) : goalBase;
      const safeStep = Number.isFinite(step) ? Math.max(5, Math.min(5000, Math.floor(step))) : goalStep;
      const safePct = Number.isFinite(pct) ? Math.max(50, Math.min(99, Math.floor(pct))) : goalAdvanceAtPct;

      setLiveGoal({ base: safeBase, step: safeStep, pct: safePct });
      didInitRef.current = false;
    } catch (e: any) {
      setGoalErr(e?.message ?? "Goal load error");
    }
  }

  useEffect(() => {
    loadGoal();
    const g = window.setInterval(loadGoal, 30000);

    load();
    const t = window.setInterval(load, 5000);

    return () => {
      window.clearInterval(t);
      window.clearInterval(g);
      if (levelUpTimerRef.current) window.clearTimeout(levelUpTimerRef.current);
    };
  }, []);

  const total = data?.total ?? 0;
  const asOfIso = data?.asOfIso ?? "";
  const locLabel = prettyLoc(locationLabel);

  const base = liveGoal?.base ?? goalBase;
  const step = liveGoal?.step ?? goalStep;
  const pct = liveGoal?.pct ?? goalAdvanceAtPct;

  const dynamicGoal = useMemo(
    () => computeDynamicGoal({ total, base, step, advanceAtPct: pct }),
    [total, base, step, pct]
  );

  const goalPct = useMemo(() => clampPct(dynamicGoal > 0 ? (total / dynamicGoal) * 100 : 0), [total, dynamicGoal]);
  const remainingToGoal = Math.max(0, dynamicGoal - total);

  if (!gateOk) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white p-10">
        <div className="max-w-3xl text-center">
          <div className="text-4xl font-extrabold">TV Link Locked</div>
          <div className="mt-4 text-slate-300 text-xl">
            {gateReason === "missing_server_key"
              ? "CHECKIN_BOARD_KEY is not set on the server."
              : gateReason === "missing_key"
              ? "Missing ?key=... in the URL."
              : "Invalid key in the URL."}
          </div>
          <div className="mt-6 text-slate-400">Use the canonical link with the correct key.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden text-white">
      <style jsx global>{`
        :root {
          --u: calc(min(1vw, 1vh) * 0.98);
        }

        .tvSafe {
          padding: calc(2.1 * var(--u) + env(safe-area-inset-top))
            calc(2.6 * var(--u) + env(safe-area-inset-right))
            calc(2.1 * var(--u) + env(safe-area-inset-bottom))
            calc(2.6 * var(--u) + env(safe-area-inset-left));
        }

        @keyframes ssdtLevelUpIn {
          0% {
            transform: translateY(10px) scale(0.98);
            opacity: 0;
          }
          25% {
            transform: translateY(0px) scale(1.02);
            opacity: 1;
          }
          70% {
            transform: translateY(0px) scale(1.02);
            opacity: 1;
          }
          100% {
            transform: translateY(-6px) scale(1);
            opacity: 0;
          }
        }
        @keyframes ssdtGlowPulse {
          0% {
            filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0));
          }
          50% {
            filter: drop-shadow(0 0 34px rgba(251, 191, 36, 0.65));
          }
          100% {
            filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0));
          }
        }

        @keyframes ssdtVipPulse {
          0% {
            box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.26) inset, 0 0 34px rgba(251, 191, 36, 0.1);
          }
          50% {
            box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.34) inset, 0 0 58px rgba(251, 191, 36, 0.16);
          }
          100% {
            box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.26) inset, 0 0 34px rgba(251, 191, 36, 0.1);
          }
        }

        .vipElite {
          position: relative;
          animation: ssdtVipPulse 3.6s ease-in-out infinite;
        }

        /* Inner highlight line + top sheen */
        .vipElite::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: calc(2.8 * var(--u));
          pointer-events: none;

          box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.22) inset, 0 0 0 2px rgba(0, 0, 0, 0.35) inset;

          background: linear-gradient(
            180deg,
            rgba(251, 191, 36, 0.12) 0%,
            rgba(251, 191, 36, 0.05) 12%,
            rgba(0, 0, 0, 0) 38%,
            rgba(0, 0, 0, 0) 100%
          );
          mix-blend-mode: screen;
          opacity: 0.9;
        }
      `}</style>

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
              <p className="mt-[calc(1*var(--u))] font-extrabold leading-none text-amber-300" style={{ fontSize: "calc(7.4*var(--u))" }}>
                LEVEL UP!
              </p>
              <p className="mt-[calc(0.8*var(--u))] text-slate-200 font-extrabold" style={{ fontSize: "calc(2.2*var(--u))" }}>
                New Goal: <span className="text-emerald-300 tabular-nums">{levelUpGoal ?? dynamicGoal}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="relative h-[100svh] w-full tvSafe">
        <div className="mx-auto h-full w-full max-w-[1900px]">
          {/* ✅ Stable 4-row layout: Header / Goal / Doors / Status */}
          <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-[calc(1.2*var(--u))]">
            {/* HEADER */}
            <div className="flex items-start justify-between gap-[calc(2.0*var(--u))]">
              <div className="flex items-start gap-[calc(2.2*var(--u))] min-w-0">
                <div
                  className="relative shrink-0"
                  style={{ width: "calc(14.8*var(--u))", height: "calc(14.8*var(--u))", minWidth: "calc(14.8*var(--u))" }}
                >
                  <Image src={showLogoSrc} alt="Sugarshack Downtown" fill className="object-contain" priority />
                </div>

                <div className="min-w-0 overflow-hidden">
                  <div className="font-extrabold leading-[0.95]">
                    <div style={{ fontSize: "calc(6.0*var(--u))" }}>CHECK IN</div>
                    <div style={{ fontSize: "calc(5.1*var(--u))" }} className="text-amber-300">
                      GET COUNTED
                    </div>
                  </div>

                  <div className="mt-[calc(0.85*var(--u))] flex flex-wrap items-center gap-[calc(0.9*var(--u))]">
                    <div
                      className="rounded-[calc(1.6*var(--u))] border border-slate-800 bg-black/25 px-[calc(1.2*var(--u))] py-[calc(0.7*var(--u))]"
                      style={{ fontSize: "calc(1.6*var(--u))" }}
                    >
                      <span className="text-slate-200 font-extrabold">New app. New perks.</span>{" "}
                      <span className="text-amber-300 font-extrabold">VIP gets the good stuff</span>{" "}
                      <span className="text-slate-200 font-extrabold">— don’t miss out.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="uppercase tracking-[0.34em] text-slate-400" style={{ fontSize: "calc(1.1*var(--u))" }}>
                  TOTAL TODAY
                </div>
                <div className="font-extrabold tabular-nums text-amber-300 leading-none" style={{ fontSize: "calc(11.8*var(--u))" }}>
                  {total}
                </div>
              </div>
            </div>

            {/* GOAL (moved ABOVE doors for gamification) */}
            <div className="rounded-[calc(2.2*var(--u))] border border-slate-800 bg-slate-900/55 px-[calc(2.2*var(--u))] py-[calc(1.55*var(--u))]">
              <div className="flex items-end justify-between gap-[calc(1.2*var(--u))]">
                <div>
                  <div className="text-slate-200 font-extrabold" style={{ fontSize: "calc(2.35*var(--u))" }}>
                    Tonight’s Goal: <span className="text-emerald-300 tabular-nums">{dynamicGoal}</span>{" "}
                    <span className="text-slate-400 font-semibold">({remainingToGoal} to go)</span>
                  </div>
                  <div className="text-slate-300 font-semibold" style={{ fontSize: "calc(1.45*var(--u))" }}>
                    Hit the goal → it levels up 🔥 Bigger confetti when it advances 🎉
                  </div>
                </div>

                <div className="text-slate-200 font-extrabold tabular-nums" style={{ fontSize: "calc(2.35*var(--u))" }}>
                  {goalPct.toFixed(0)}%
                </div>
              </div>

              <div className="mt-[calc(0.95*var(--u))] h-[calc(2.05*var(--u))] w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 transition-all" style={{ width: `${goalPct}%` }} />
              </div>
            </div>

            {/* DOORS */}
            <div className="min-h-0">
              <div className="h-full min-h-0 grid grid-cols-2 gap-[calc(1.35*var(--u))] items-stretch">
                <DoorCard
                  tone="vip"
                  eyebrow="👑 VIP FAST LANE"
                  title="HAVE APP"
                  bullets={["Scan with your CAMERA", "Opens the app instantly", "You’re checked in"]}
                  qrSrc={venueQrSrc}
                  qrAlt="VIP Fast Lane QR"
                  foot="HAVE APP = FASTEST ENTRY"
                  qrU={34}
                  titleScale={1.06}
                />

                <DoorCard
                  tone="install"
                  eyebrow="📲 GET THE APP"
                  title="NO APP YET"
                  bullets={["Scan to install", "Then use VIP FAST LANE", "VIP perks live in the app 👀"]}
                  qrSrc={helpQrSrc}
                  qrAlt="Get the App QR"
                  foot="INSTALL → THEN SCAN VIP FAST LANE"
                  qrU={30}
                  titleScale={0.98}
                />
              </div>
            </div>

            {/* STATUS STRIP */}
            <div className="rounded-[calc(2.0*var(--u))] border border-slate-800 bg-black/25 px-[calc(2.0*var(--u))] py-[calc(1.1*var(--u))]">
              <div className="flex flex-wrap items-center gap-x-[calc(1.0*var(--u))] gap-y-[calc(0.5*var(--u))] text-slate-400">
                <span style={{ fontSize: "calc(1.2*var(--u))" }}>
                  ET: <span className="font-semibold text-slate-200">{etDateMdy}</span>
                </span>
                <span className="opacity-50">•</span>
                <span style={{ fontSize: "calc(1.2*var(--u))" }}>
                  As of <span className="font-semibold text-slate-200">{asOfIso ? formatTime(asOfIso, etTz) : "—"}</span>
                </span>
                <span className="opacity-50">•</span>
                <span className="text-slate-200 font-semibold" style={{ fontSize: "calc(1.2*var(--u))" }}>
                  {locLabel}
                </span>
                <span className="opacity-50">•</span>
                <span style={{ fontSize: "calc(1.2*var(--u))" }}>Auto-updates 5s</span>

                {goalErr ? (
                  <>
                    <span className="opacity-50">•</span>
                    <span className="text-rose-300" style={{ fontSize: "calc(1.2*var(--u))" }}>
                      Goal config issue
                    </span>
                  </>
                ) : null}

                {err ? (
                  <>
                    <span className="opacity-50">•</span>
                    <span className="text-rose-300" style={{ fontSize: "calc(1.2*var(--u))" }}>
                      Data loading issue
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          {/* /grid */}
        </div>
      </div>
    </div>
  );
}
