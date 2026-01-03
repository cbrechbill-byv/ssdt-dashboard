// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\c\page.tsx
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-static";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/sugarshack-downtown-app/id6755752186";

// IMPORTANT:
// Replace this with your actual app URL scheme if you already have one.
// Examples: "ssdt://checkin" or "sugarshack://checkin" etc.
const APP_SCHEME_URL = "ssdt://checkin";

export default function OneQRLandingPage() {
  return (
    <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl text-center">
        {/* Smart App Banner (Safari) */}
        <head>
          {/* Replace app-id with the Apple ID if you want a Smart App Banner.
              NOTE: Some setups prefer adding this via layout metadata instead.
              If you already have metadata handling, move this there. */}
          <meta name="apple-itunes-app" content="app-id=6755752186" />
        </head>

        <div className="flex justify-center mb-6">
          <Image
            src="/ssdt-logo.png"
            alt="Sugarshack Downtown"
            width={240}
            height={240}
            priority
            className="h-auto w-[220px] sm:w-[260px]"
          />
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          Check In
        </h1>

        <p className="mt-4 text-base sm:text-lg text-white/80 leading-relaxed">
          This is the ONE QR. If you have the app, tap Open in App.
          If you don’t, install it first — then come back here and tap Open in App.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => {
              // Attempt to open the app via URL scheme as a fallback.
              // If it fails, send to App Store after a short delay.
              const start = Date.now();
              window.location.href = APP_SCHEME_URL;

              setTimeout(() => {
                // If user is still here, assume app didn't open
                // (This isn't perfect, but works well in practice.)
                if (Date.now() - start < 1600) {
                  window.location.href = APP_STORE_URL;
                }
              }, 1200);
            }}
            className="rounded-xl bg-white text-black font-bold py-4 text-lg sm:text-xl"
          >
            Open in App
          </button>

          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-white/10 border border-white/20 text-white font-bold py-4 text-lg sm:text-xl"
          >
            Install from App Store
          </a>
        </div>

        <div className="mt-10 rounded-2xl border border-white/15 bg-white/5 p-6 text-left">
          <h2 className="text-xl font-bold">After you’re in the app</h2>
          <ol className="mt-3 space-y-2 text-white/85">
            <li>
              <span className="font-semibold">1)</span> Login VIP/Guest
            </li>
            <li>
              <span className="font-semibold">2)</span> Tap <span className="font-semibold">Check In</span>
            </li>
            <li>
              <span className="font-semibold">3)</span> Tap <span className="font-semibold">Scan QR</span>
            </li>
          </ol>

          <p className="mt-4 text-sm sm:text-base text-white/70 leading-relaxed">
            Need help? Go to{" "}
            <Link href="/checkin" className="underline underline-offset-4">
              /checkin
            </Link>
            .
          </p>
        </div>

        <p className="mt-8 text-xs sm:text-sm text-white/55">
          If “Open in App” does nothing in an in-app browser, open this page in Safari
          or install the app first and try again.
        </p>
      </div>
    </main>
  );
}
