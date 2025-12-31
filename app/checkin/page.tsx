// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\checkin\page.tsx
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-static";

const APP_STORE_URL = "https://apps.apple.com/us/app/sugarshack-downtown-app/id6755752186";

export default function CheckinHelpPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-md px-4 py-6">
        {/* Header */}
        <header className="flex items-center gap-5">
          {/* Bigger logo to match “Get the App” */}
          <div className="relative h-[140px] w-[140px] shrink-0">
            <Image
              src="/ssdt-logo.png"
              alt="Sugarshack Downtown"
              fill
              className="object-contain"
              priority
              sizes="88px"
            />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.34em] text-slate-300">Sugarshack Downtown</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight">Get the App</h1>
            <p className="mt-1 text-sm text-slate-300">
              Check in tonight. <span className="text-amber-300 font-extrabold">VIP unlocks perks + surprises</span> 🎁
            </p>
          </div>
        </header>

        {/* Primary CTA */}
        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Step 1</p>
          <p className="mt-1 text-xl font-extrabold">Install the app (iPhone)</p>
          <p className="mt-1 text-sm text-slate-300">Tap below to open the App Store and install.</p>

          {/* Use a plain anchor (most reliable on mobile Safari / in-app browsers) */}
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block w-full rounded-2xl bg-amber-300 px-4 py-3 text-center text-[16px] font-extrabold text-black active:scale-[0.99]"
          >
            Open in the App Store →
          </a>

          {/* Backup link if an embedded browser blocks target=_blank */}
          <p className="mt-3 text-xs text-slate-400">
            If the button doesn’t open,{" "}
            <Link href={APP_STORE_URL} prefetch={false} className="text-amber-300 underline underline-offset-4">
              tap here
            </Link>
            .
          </p>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-black/25 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Android</p>
            <p className="mt-1 text-slate-200 font-extrabold">Coming soon.</p>
          </div>
        </section>

        {/* Steps */}
        <section className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/30 p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Then</p>

          <div className="mt-3 space-y-3">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300 font-extrabold">
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300 font-extrabold">
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
            <p className="mt-1 text-sm text-slate-400">You must scan the Venue QR inside the app.</p>
          </div>
        </section>

        {/* No phone note */}
        <section className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/20 p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">No phone?</p>
          <p className="mt-1 text-slate-200 font-extrabold">No problem — you’re still welcome in.</p>
          <p className="mt-1 text-sm text-slate-400">Staff can help you check in inside the venue.</p>
        </section>

        <p className="mt-6 text-center text-[11px] text-slate-500">Tip: Install → Open app → Check In → Scan QR</p>
      </div>
    </main>
  );
}
