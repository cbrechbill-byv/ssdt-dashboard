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

function formatEtDateMDY(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).formatToParts(now);

  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  const yy = parts.find((p) => p.type === "year")?.value ?? "2000";
  return `${mm}/${dd}/${yy}`;
}

export default async function TvPage(props: { searchParams?: Promise<{ key?: string }> }) {
  const sp = (await props.searchParams) ?? {};
  const providedKey = (sp.key ?? "").trim();
  const kioskKey = (process.env.CHECKIN_BOARD_KEY ?? "").trim();

  // If kiosk key isn't configured, don't expose the page.
  if (!kioskKey) redirect("/login");

  // If key doesn't match, require login
  if (providedKey !== kioskKey) redirect("/login");

  const etDateMdy = formatEtDateMDY();

  return (
    <TvKioskClient
      kioskKey={kioskKey}
      etDateMdy={etDateMdy}
      etTz={ET_TZ}
      goalTotal={500}
      appStoreLabel="Download the Sugarshack Downtown App"
      showLogoSrc="/ssdt-logo.png"
      checkinQrSrc="/SSDTVIP-CHECKIN.png"
      appStoreQrSrc="/appstore-qr.png"
    />
  );
}
