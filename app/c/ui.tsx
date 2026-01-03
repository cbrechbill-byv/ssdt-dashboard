// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\c\ui.tsx
"use client";

type Props = {
  appStoreUrl: string;
};

// Your Expo scheme from app.json is "ssdtfresh".
// This is the fallback deep link attempt for browsers that don't trigger Universal Links.
const APP_SCHEME_URL = "ssdtfresh://checkin";

export default function OneQrClientActions({ appStoreUrl }: Props) {
  function handleOpenInApp() {
    const start = Date.now();
    window.location.href = APP_SCHEME_URL;

    window.setTimeout(() => {
      // If user is still here, assume app didn't open.
      if (Date.now() - start < 1600) {
        window.location.href = appStoreUrl;
      }
    }, 1200);
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
        href={appStoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-white/10 border border-white/20 text-white font-bold py-4 text-lg sm:text-xl text-center"
      >
        Install from App Store
      </a>
    </div>
  );
}
