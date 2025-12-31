// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\page.tsx
// /tv kiosk page (no login required if key matches CHECKIN_BOARD_KEY)
//
// ✅ Uses client UI (ui.tsx) for smooth updates + confetti
// ✅ Gate access by query key
// ✅ ET date shown as MM/DD/YYYY

import { redirect } from "next/navigation";
import TvKioskClient from "./ui";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatEtDateMDY(now = new Date()): string {
  // Force ET display
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

export default async function TvPage(props: { searchParams?: SearchParams }) {
  const sp = (await props.searchParams) ?? {};

  const kioskKey = firstParam(sp.key) ?? "";
  const requiredKey = process.env.CHECKIN_BOARD_KEY ?? "";

  // Hard gate: must include correct key
  if (!requiredKey || kioskKey !== requiredKey) {
    redirect("/login");
  }

  // Optional: location label from URL (for display only)
  // Example: /tv?key=...&loc=front-bar
  const loc = firstParam(sp.loc) ?? "entrance";

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
      // ✅ CAMERA SCAN QR → /checkin help page (you already saved this file)
      helpQrSrc="/qr/ssdt_checkin_qr.png"
      // ✅ IN-APP SCAN QR → MUST be the SAME venue QR your app expects (from scan.js flow)
      venueQrSrc="/SSDTVIP-CHECKIN.png"
      locationLabel={loc}
    />
  );
}
