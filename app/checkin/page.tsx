// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\checkin\page.tsx
"use client";

import Image from "next/image";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

const APP_STORE_URL = "https://apps.apple.com/us/app/sugarshack-downtown-app/id6755752186";

function prettyLoc(loc?: string) {
  if (!loc) return null;
  const s = loc.replace(/[-_]/g, " ").trim();
  if (!s) return null;
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function CheckinHelpInner() {
  const sp = useSearchParams();

  const loc = useMemo(() => {
    const raw = sp?.get("loc") ?? undefined;
    return prettyLoc(raw);
  }, [sp]);

  const onOpenAppStore = () => {
    // Fallback for some in-app browsers / QR scanner webviews
    try {
      window.location.href = APP_STORE_URL;
    } catch {
      // no-op
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-[#0b1220] text-white">
      {/* Subtle background glow */}
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-400 blur-[110px]" />
        <div className="absolute bottom-[-120px] right-[-120px] h-80 w-80 rounded-full bg-teal-400 blur-[140px]" />
      </div>

      <div className="relative mx-auto w-full max-w-md px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            <Image src="/ssdt-logo.png" alt="Sugarshack Downtown" fill className="object-contain" priority />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.34em] text-slate-300">Sugarshack Downtown</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight">Check In &amp; Get Counted</h1>
            <p className="mt-1 text-sm text-slate-300">
              Guest is fast ✅ <span className="text-amber-300 font-extrabold">VIP unlocks rewards</span> 🎁
            </p>

            {loc ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-black/30 px-3 py-1 text-xs text-slate-200">
                <span className="text-slate-400">Location</span>
                <span className="font-extrabold">{loc}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Primary CTA */}
        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/45 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Step 1</p>
          <p className="mt-1 text-xl font-extrabold">Install the app (iPhone)</p>
          <p className="mt-1 text-sm text-slate-300">Tap below to open the App Store and install in seconds.</p>

          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpenAppStore}
            className="mt-4 block w-full rounded-2xl bg-amber-300 px-4 py-3 text-center text-[16px] font-extrabold text-black active:scale-[0.99]"
          >
            Open in the App Store →
          </a>

          <div className="mt-3 rounded-2xl border border-slate-800 bg-black/25 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Android</p>
            <p className="mt-1 text-slate-200 font-extrabold">Coming soon.</p>
          </div>
        </div>

        {/* Steps */}
        <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/35 p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">After install</p>

          <div className="mt-3 space-y-3">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300 font-extrabold">
                2
              </div>
              <div>
                <p className="font-extrabold text-slate-100">Open the app + log in</p>
                <p className="text-sm text-slate-300">
                  Choose <span className="font-extrabold text-teal-300">Guest</span> (fast) or{" "}
                  <span className="font-extrabold text-amber-300">VIP</span> (rewards + perks).
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300 font-extrabold">
                3
              </div>
              <div>
                <p className="font-extrabold text-slate-100">Check In → Scan QR</p>
                <p className="text-sm text-slate-300">
                  In the app, tap <span className="font-extrabold">Check In</span>, then{" "}
                  <span className="font-extrabold">Scan QR</span> on the venue screen.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-black/25 p-4">
            <p className="text-sm text-slate-200 font-extrabold">
              Important: your phone camera scan does <span className="text-amber-300">not</span> check you in.
            </p>
            <p className="mt-1 text-sm text-slate-400">
              You must scan the <span className="font-semibold text-slate-200">Venue QR</span> inside the app.
            </p>
          </div>
        </div>

        {/* No phone note */}
        <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/25 p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">No phone?</p>
          <p className="mt-1 text-slate-200 font-extrabold">No problem — you’re still welcome in.</p>
          <p className="mt-1 text-sm text-slate-400">You won’t be denied entry. Staff can help you check in inside the venue.</p>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-500">Tip: Install → Open app → Check In → Scan QR</p>
      </div>
    </div>
  );
}

export default function CheckinHelpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-[#0b1220] text-white">
          <div className="mx-auto w-full max-w-md px-4 py-10">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <Image src="/ssdt-logo.png" alt="Sugarshack Downtown" fill className="object-contain" priority />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.34em] text-slate-300">Sugarshack Downtown</p>
                <p className="mt-2 text-2xl font-extrabold">Loading…</p>
                <p className="mt-1 text-sm text-slate-400">Preparing check-in steps</p>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <CheckinHelpInner />
    </Suspense>
  );
}
