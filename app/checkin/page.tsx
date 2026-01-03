// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\checkin\page.tsx
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-static";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/sugarshack-downtown-app/id6755752186";

// If you want the “ONE QR” page to be the default entry point later,
// you can optionally reference /c here as well.
const ONE_QR_URL = "https://ssdtapp.byvenuecreative.com/c";

export default function CheckinHelpPage() {
  return (
    <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl text-center">
        {/* Big logo (no extra top text line) */}
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
          Get the App
        </h1>

        <p className="mt-4 text-base sm:text-lg text-white/80 leading-relaxed">
          Check-ins and perks happen inside the Sugarshack Downtown app.
          Install it first, then come back and get counted.
        </p>

        {/* Primary CTA: plain <a> for reliability */}
        <div className="mt-8 flex flex-col gap-3">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-xl bg-white text-black font-bold py-4 text-lg sm:text-xl"
          >
            Open in the App Store
          </a>

          {/* Backup link (some in-app browsers behave oddly) */}
          <Link
            href={APP_STORE_URL}
            target="_blank"
            className="text-white/80 underline underline-offset-4"
          >
            If the button didn’t work, tap here
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border border-white/15 bg-white/5 p-6 text-left">
          <h2 className="text-xl font-bold">How check-in works</h2>
          <ol className="mt-3 space-y-2 text-white/85">
            <li>
              <span className="font-semibold">1)</span> Install the app and open it
            </li>
            <li>
              <span className="font-semibold">2)</span> Login as VIP (or continue as Guest)
            </li>
            <li>
              <span className="font-semibold">3)</span> Tap <span className="font-semibold">Check In</span>
            </li>
            <li>
              <span className="font-semibold">4)</span> Tap <span className="font-semibold">Scan QR</span> (this opens the camera inside the app)
            </li>
          </ol>

          <p className="mt-4 text-sm sm:text-base text-white/70 leading-relaxed">
            Want the simplest flow? Use the ONE QR link:
            <span className="ml-2 font-semibold text-white">{ONE_QR_URL}</span>
          </p>
        </div>

        <p className="mt-8 text-xs sm:text-sm text-white/55">
          Tip: phone camera scanning won’t complete check-in unless it opens the app flow.
          Install the app first for VIP perks.
        </p>
      </div>
    </main>
  );
}
