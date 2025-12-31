// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\page.tsx
// /tv kiosk page (no login required if key matches CHECKIN_BOARD_KEY)
//
// ✅ Uses client UI (ui.tsx) for smooth updates + confetti
// ✅ Gate access by query key
// ✅ ET date shown as MM/DD/YYYY
// ✅ Supports location variants via ?loc=entrance|front-bar|back-bar|pergola|tables

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

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

type SearchParams = Promise<{ key?: string; loc?: string }>;

export default async function TvPage(props: { searchParams?: SearchParams }) {
  const sp = (await props.searchParams) ?? {};
  const providedKey = (firstParam(sp.key) ?? "").trim();
  const kioskKey = (process.env.CHECKIN_BOARD_KEY ?? "").trim();

  if (!kioskKey) redirect("/login");
  if (providedKey !== kioskKey) redirect("/login");

  const locRaw = (firstParam(sp.loc) ?? "entrance").trim().toLowerCase();

  // Allowed locations only (prevents bad inputs)
  const allowed = new Set(["entrance", "front-bar", "back-bar", "pergola", "tables"]);
  const loc = allowed.has(locRaw) ? locRaw : "entrance";

  const etDateMdy = formatEtDateMDY();

  return (
    <TvKioskClient
      kioskKey={kioskKey}
      etDateMdy={etDateMdy}
      etTz={ET_TZ}
      goalBase={500}
      goalStep={250}
      goalAdvanceAtPct={90}
      showLogoSrc="/ssdt-logo.png"
      // NEW: location-aware QR assets (place in /public/qr/)
      helpQrSrc={`/qr/help-${loc}.png`}
      venueQrSrc={`/qr/venue-${loc}.png`}
      locationLabel={loc}
    />
  );
}
