// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\ui.tsx
// app/tv/ui.tsx
// Client UI + polling. Calls /api/tv every few seconds.
// Fun mode: confetti on new check-ins + big scan prompt.

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const ET_TZ = "America/New_York";

type Payload = {
  ok: boolean;
  asOfIso: string;
  dateEt: string; // YYYY-MM-DD
  total: number;
  vip: number;
  guest: number;
  recent: Array<{
    atIso: string;
    label: "VIP" | "Guest";
    source?: string | null;
    points?: number | null;
  }>;
};

function formatTimeEt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    timeZone: ET_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Confetti = {
  id: string;
  leftPct: number;
  size: number;
  delayMs: number;
  durationMs: number;
  rotate: number;
};

function makeConfettiBurst(count = 26): Confetti[] {
  const out: Confetti[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: `${Date.now()}-${i}`,
      leftPct: Math.random() * 100,
      size: 6 + Math.floor(Math.random() * 10),
      delayMs: Math.floor(Math.random() * 150),
      durationMs: 900 + Math.floor(Math.random() * 700),
      rotate: Math.floor(Math.random() * 360),
    });
  }
  return out;
}

export default function TvBoardClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [pulse, setPulse] = useState(false);
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const lastTotalRef = useRef<number>(0);

  async function load() {
    try {
      setErr(null);
      const res = await fetch("/api/tv", { cache: "no-store" });
      const json = (await res.json()) as Payload;
      if (!res.ok || !json?.ok) throw new Error("Failed to load check-ins");

      const nextTotal = json.total ?? 0;
      const prevTotal = lastTotalRef.current ?? 0;

      if (nextTotal > prevTotal) {
        setPulse(true);
        setTimeout(() => setPulse(false), 650);

        setConfetti(makeConfettiBurst());
        setTimeout(() => setConfetti([]), 1800);
      }

      lastTotalRef.current = nextTotal;
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Error loading check-ins");
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000); // refresh every 5s
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = data?.total ?? 0;
  const vip = data?.vip ?? 0;
  const guest = data?.guest ?? 0;

  // “Tonight goal” can be tuned (or made configurable later)
  const goal = 300;

  const progressPct = useMemo(() => {
    if (goal <= 0) return 0;
    return clamp((total / goal) * 100, 0, 100);
  }, [total]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 text-white">
      {/* Confetti layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((c) => (
          <span
            key={c.id}
            className="absolute top-[-20px] rounded-sm bg-white/90"
            style={{
              left: `${c.leftPct}%`,
              width: `${c.size}px`,
              height: `${c.size * 1.6}px`,
              transform: `rotate(${c.rotate}deg)`,
              animation: `fall ${c.durationMs}ms ease-in ${c.delayMs}ms forwards`,
            }}
          />
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.30em] text-amber-200/80">
              Sugarshack Downtown • Live Check-Ins
            </p>
            <h1 className="mt-2 text-3xl md:text-6xl font-extrabold tracking-tight truncate">
              Check in & get counted
            </h1>
            <p className="mt-2 text-sm md:text-base text-slate-200/80">
              Scan the QR • Unlock rewards • Help us hit tonight’s goal
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-200/70">
              Tonight (ET)
            </p>
            <p className="mt-1 text-sm text-slate-100">
              {data?.asOfIso ? formatTimeEt(data.asOfIso) : "—"}
            </p>
            <p className="text-[11px] text-slate-300/70">
              {data?.dateEt ? data.dateEt : ""}
            </p>
          </div>
        </div>

        {/* Main grid */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* Big number + stats */}
          <div className="rounded-[34px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[12px] uppercase tracking-[0.28em] text-amber-200/80">
                  Checked in tonight
                </p>

                <div
                  className={`mt-3 text-6xl md:text-9xl font-extrabold tracking-tight ${
                    pulse ? "scale-[1.03]" : "scale-100"
                  } transition-transform duration-300`}
                >
                  {total.toLocaleString()}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-200/70">
                      VIP check-ins
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {vip.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-200/70">
                      Guest check-ins
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {guest.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Goal bar */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-200/70">
                  <span className="uppercase tracking-[0.18em]">
                    Tonight’s goal
                  </span>
                  <span>{goal.toLocaleString()}</span>
                </div>
                <div className="mt-2 h-3 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-200/70">
                  Every scan helps. If you haven’t checked in yet — do it now 👇
                </p>
              </div>

              {/* Big “Scan” callout */}
              <div className="rounded-[28px] border border-amber-200/20 bg-amber-400/10 px-6 py-6 text-center">
                <p className="text-[12px] uppercase tracking-[0.28em] text-amber-200/90">
                  Scan to check in
                </p>
                <p className="mt-2 text-2xl md:text-4xl font-extrabold tracking-tight">
                  Open your camera → scan the QR
                </p>
                <p className="mt-2 text-sm text-slate-100/80">
                  It takes 5 seconds. You’ll unlock rewards + special offers.
                </p>
              </div>

              {err && (
                <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {err}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: QR placeholder + recent */}
          <div className="space-y-6">
            {/* QR slot (drop your actual QR image later) */}
            <div className="rounded-[34px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
              <p className="text-[12px] uppercase tracking-[0.28em] text-amber-200/80">
                Check-in QR
              </p>
              <div className="mt-4 aspect-square w-full rounded-3xl border border-white/10 bg-black/20 grid place-items-center">
                <div className="text-center">
                  <p className="text-sm font-semibold">Place QR here</p>
                  <p className="mt-1 text-[11px] text-slate-200/70">
                    (We’ll drop your shared QR image into this slot.)
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-200/60">
                Tip: Put this TV near the entrance + stage mention every 30 min.
              </p>
            </div>

            {/* Recent check-ins */}
            <div className="rounded-[34px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
              <p className="text-[12px] uppercase tracking-[0.28em] text-amber-200/80">
                Recent check-ins
              </p>

              <div className="mt-4 space-y-2">
                {(data?.recent ?? []).length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200/70">
                    No check-ins yet. Be the first 🎸
                  </div>
                ) : (
                  (data?.recent ?? []).slice(0, 10).map((r, idx) => (
                    <div
                      key={`${r.atIso}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {r.label === "VIP" ? "VIP check-in" : "Guest check-in"}
                        </p>
                        <p className="text-[11px] text-slate-200/70">
                          {formatTimeEt(r.atIso)}
                          {r.source ? ` · ${r.source}` : ""}
                        </p>
                      </div>
                      <span className="text-[11px] rounded-full border border-white/15 bg-white/10 px-3 py-1 text-slate-100">
                        {r.label}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <p className="mt-4 text-[11px] text-slate-200/60">
                Updates every 5 seconds.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom footer */}
        <div className="mt-10 rounded-[34px] border border-white/10 bg-white/5 p-6 text-center backdrop-blur">
          <p className="text-lg md:text-3xl font-extrabold tracking-tight">
            Sugarshack Downtown Rewards
          </p>
          <p className="mt-2 text-sm text-slate-200/80">
            Check in tonight to unlock perks — and help us make every night bigger.
          </p>
        </div>
      </div>

      {/* CSS keyframes */}
      <style>{`
        @keyframes fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(520deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
