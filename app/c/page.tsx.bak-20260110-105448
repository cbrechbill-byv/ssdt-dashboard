// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\c\page.tsx
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import OneQrClientActions from "./ui";

export const dynamic = "force-static";

// Smart App Banner (Safari iOS)
export const metadata: Metadata = {
  other: {
    "apple-itunes-app": "app-id=6755752186",
  },
};

const APP_STORE_URL =
  "https://apps.apple.com/us/app/sugarshack-downtown-app/id6755752186";

export default function OneQRLandingPage() {
  return (
    <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl text-center">
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

        {/* Client-side interactive buttons live here */}
        <div className="mt-8">
          <OneQrClientActions appStoreUrl={APP_STORE_URL} />
        </div>

        <div className="mt-10 rounded-2xl border border-white/15 bg-white/5 p-6 text-left">
          <h2 className="text-xl font-bold">After you’re in the app</h2>
          <ol className="mt-3 space-y-2 text-white/85">
            <li>
              <span className="font-semibold">1)</span> Login VIP/Guest
            </li>
            <li>
              <span className="font-semibold">2)</span> Tap{" "}
              <span className="font-semibold">Check In</span>
            </li>
            <li>
              <span className="font-semibold">3)</span> Tap{" "}
              <span className="font-semibold">Scan QR</span>
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
