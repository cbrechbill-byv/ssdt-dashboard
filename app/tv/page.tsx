// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\page.tsx
// /tv kiosk page (public access gated by CHECKIN_BOARD_KEY)
// - Loads UI client for polling + confetti
// - Times are ET
// - Goal starts at 500 and auto-levels up

import { redirect } from "next/navigation";
import TvKioskClient from "./ui";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

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

type SearchParams = { [key: string]: string | string[] | undefined };

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default function TvPage(props: { searchParams?: SearchParams }) {
  const sp = props.searchParams ?? {};
  const key = firstParam(sp.key);

  const expected = process.env.CHECKIN_BOARD_KEY;
  if (!expected || !key || key !== expected) redirect("/");

  const etDateMdy = formatEtDateMDY(new Date());

  // Optional: allow /tv?key=...&loc=front-bar, etc (for labels only)
  const locationLabel = firstParam(sp.loc) ?? "Entrance";

  return (
    <TvKioskClient
      kioskKey={key}
      etDateMdy={etDateMdy}
      etTz={ET_TZ}
      goalBase={500}
      goalStep={150}
      goalAdvanceAtPct={90}
      showLogoSrc="/ssdt-logo.png"
      helpQrSrc="/appstore-qr.png"
      venueQrSrc="/SSDTVIP-CHECKIN.png"
      locationLabel={locationLabel}
    />
  );
}
