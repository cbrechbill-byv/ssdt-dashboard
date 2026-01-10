// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\c\ui.tsx
"use client";

type Props = {
  appStoreUrl: string;
};

// ✅ Play Store listing (manual install path for Android if app not installed)
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.cbrechbill1.sugarshackdowntown";

// ✅ Expo scheme fallback (does NOT hit your website, so no 404)
// NOTE: This should match your app’s configured scheme.
const APP_SCHEME_BASE = "ssdtfresh://check-in/scan";
const DEFAULT_PAYLOAD = "SSDTVIP-CHECKIN";

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function getStoreUrl(appStoreUrl: string) {
  return isAndroid() ? PLAY_STORE_URL : appStoreUrl;
}

export default function OneQrClientActions({ appStoreUrl }: Props) {
  function handleOpenInApp() {
    const storeUrl = getStoreUrl(appStoreUrl);

    // Scheme-first (prevents “Open in App” from sending users to a web 404 if app isn't installed)
    // If app is installed -> it should open.
    // If not installed -> user remains here -> we send them to the store after a short delay.
    const schemeUrl = `${APP_SCHEME_BASE}?payload=${encodeURIComponent(
      DEFAULT_PAYLOAD
    )}`;

    const start = Date.now();
    window.location.href = schemeUrl;

    // If still here after ~900ms, assume app didn't open -> send to store
    window.setTimeout(() => {
      // If the app opened, the browser is backgrounded; if not, we’re still here
      if (Date.now() - start < 2000) {
        window.location.href = storeUrl;
      }
    }, 900);
  }

  const storeUrl = getStoreUrl(appStoreUrl);

  return (
    <div className="grid grid-cols-1 gap-3">
      {/* ✅ Primary CTA: INSTALL */}
      <a
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-white text-black font-extrabold py-4 text-lg sm:text-xl text-center"
      >
        {isAndroid() ? "Install from Google Play" : "Install from App Store"}
      </a>

      {/* ✅ Secondary CTA: OPEN (fallback) */}
      <button
        onClick={handleOpenInApp}
        className="rounded-xl bg-white/0 border border-white/25 text-white font-bold py-3 text-base sm:text-lg"
      >
        Already installed? Open the App
      </button>

      <div className="text-xs sm:text-sm text-white/55">
        After installing, scan either TV QR again to check in.
      </div>
    </div>
  );
}
