// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\page.tsx
// /tv kiosk page (no login required if key matches CHECKIN_BOARD_KEY)
//
// ✅ Uses client UI (ui.tsx) for smooth updates + confetti
// ✅ Gate access by query key
// ✅ ET date shown as MM/DD/YYYY
//
// Canonical production TV URL:
// https://ssdtapp.byvenuecreative.com/tv?key=ssdt-tv-2026

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
      // ✅ SINGLE QR image (points to https://ssdtapp.byvenuecreative.com/c)
      helpQrSrc="/qr/ssdt_oneqr_c.png"
      venueQrSrc="/qr/ssdt_oneqr_c.png"
      locationLabel={loc}
      // ✅ turns on single-QR lane layout
      oneQrMode={true}
    />
  );
}
