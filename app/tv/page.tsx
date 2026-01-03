// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\page.tsx
// /tv kiosk page (no login required if key matches CHECKIN_BOARD_KEY)
//
// ✅ Uses client UI (ui.tsx) for smooth updates + confetti
// ✅ Gate access by query key (TV-safe: no /login redirect)
// ✅ ET date shown as MM/DD/YYYY
//
// Optional flags:
// - one=1  => enables "one QR mode" (both lanes can point to same destination/QR during transition)
// - loc=front-bar => display-only label

import TvKioskClient from "./ui";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatEtDateMDY(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";

  return `${mm}/${dd}/${yyyy}`;
}

function AccessRequired() {
  return (
    <main className="min-h-screen w-full bg-black text-white flex items-center justify-center px-8 py-10">
      <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-white/5 p-10 text-center">
        <div className="text-4xl sm:text-5xl font-extrabold">TV Access Required</div>
        <p className="mt-4 text-white/80 text-lg sm:text-xl leading-relaxed">
          This TV board requires a valid kiosk key in the URL.
        </p>
        <div className="mt-6 rounded-2xl border border-white/15 bg-black/30 p-5 text-left">
          <div className="text-white/85 font-bold">Example:</div>
          <div className="mt-2 font-mono text-white/70 break-all">
            /tv?key=YOUR_KEY
          </div>
          <div className="mt-3 text-white/70">
            Optional: <span className="font-mono">one=1</span> enables one-QR transition mode.
          </div>
        </div>
      </div>
    </main>
  );
}

export default async function TvPage(props: { searchParams?: SearchParams }) {
  const sp = (await props.searchParams) ?? {};

  const kioskKey = firstParam(sp.key) ?? "";
  const requiredKey = process.env.CHECKIN_BOARD_KEY ?? "";

  // Hard gate: must include correct key
  // TV-safe behavior: show an access screen (no auth redirect)
  if (!requiredKey || kioskKey !== requiredKey) {
    return <AccessRequired />;
  }

  // Optional: location label from URL (for display only)
  // Example: /tv?key=...&loc=front-bar
  const loc = firstParam(sp.loc) ?? "entrance";

  // Optional: one QR mode (transition mode)
  // Example: /tv?key=...&one=1
  const oneQrMode = (firstParam(sp.one) ?? "") === "1";

  const etDateMdy = formatEtDateMDY(new Date());

  return (
    <TvKioskClient
      kioskKey={kioskKey}
      etDateMdy={etDateMdy}
      etTz={ET_TZ}
      goalBase={500}
      goalStep={50}
      goalAdvanceAtPct={90}
      showLogoSrc="/ssdt-logo.png"
      // CAMERA SCAN QR
      // NOTE: when you regenerate your TRUE one-QR png, you can point BOTH lanes to that.
      helpQrSrc="/qr/ssdt_checkin_qr.png"
      // IN-APP scan QR (current)
      venueQrSrc="/SSDTVIP-CHECKIN.png"
      locationLabel={loc}
      oneQrMode={oneQrMode}
    />
  );
}
