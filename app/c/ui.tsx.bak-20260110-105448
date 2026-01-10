// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\c\ui.tsx
"use client";

type Props = {
  appStoreUrl: string;
};

// ✅ Play Store listing (manual install path for Android if app not installed)
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.cbrechbill1.sugarshackdowntown";

// ✅ This is the real One-QR deep link target (works when app is installed)
// Uses Universal Links (iOS) + App Links (Android)
const ONE_QR_DEEP_LINK =
  "https://ssdtapp.byvenuecreative.com/check-in/scan?payload=SSDTVIP-CHECKIN";

// Optional: scheme fallback for browsers that block universal/app links
// Your Expo scheme from app.json is "ssdtfresh".
const APP_SCHEME_FALLBACK = "ssdtfresh://checkin";

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export default function OneQrClientActions({ appStoreUrl }: Props) {
  function handleOpenInApp() {
    const start = Date.now();

    // 1) Try the verified HTTPS deep link first (best path)
    window.location.href = ONE_QR_DEEP_LINK;

    // 2) If user is still here, try scheme fallback (some browsers block app links)
    window.setTimeout(() => {
      if (Date.now() - start < 1600) {
        window.location.href = APP_SCHEME_FALLBACK;
      }
    }, 700);

    // 3) If still here, send to the correct store
    window.setTimeout(() => {
      if (Date.now() - start < 2600) {
        window.location.href = isAndroid() ? PLAY_STORE_URL : appStoreUrl;
      }
    }, 1600);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        onClick={handleOpenInApp}
        className="rounded-xl bg-white text-black font-bold py-4 text-lg sm:text-xl"
      >
        Open in App
      </button>

      <a
        href={isAndroid() ? PLAY_STORE_URL : appStoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-white/10 border border-white/20 text-white font-bold py-4 text-lg sm:text-xl text-center"
      >
        {isAndroid() ? "Install from Google Play" : "Install from App Store"}
      </a>
    </div>
  );
}
