// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\page.tsx
// /tv kiosk page (no login required if key matches CHECKIN_BOARD_KEY)
//
// ✅ Uses client UI (ui.tsx) for smooth updates + confetti
// ✅ Gate access by query key
// ✅ ET date shown as MM/DD/YYYY
//
// Canonical production TV URL:
// https://ssdtapp.byvenuecreative.com/tv?key=ssdt-tv-2026
//
// ✅ IMPORTANT:
// The QR rendered on this TV page must be an IMAGE FILE (PNG) that encodes the One-QR deep link
// (NOT a QR that encodes /tv?key=...).
//
// Place the file here:
// C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\public\qr\SSDT_ONEQR_TV_CHECKIN.png
// It will be served at:
// /qr/SSDT_ONEQR_TV_CHECKIN.png

import TvKioskClient from "./ui";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

// ✅ Must match the PNG filename in /public/qr
const ONE_QR_IMAGE_SRC = "/qr/SSDT_ONEQR_TV_CHECKIN.png";

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

  // TV-friendly gate (no redirect)
  let gateOk = true;
  let gateReason:
    | "missing_key"
    | "invalid_key"
    | "missing_server_key"
    | undefined = undefined;

  if (!requiredKey) {
    gateOk = false;
    gateReason = "missing_server_key";
  } else if (!kioskKey) {
    gateOk = false;
    gateReason = "missing_key";
  } else if (kioskKey !== requiredKey) {
    gateOk = false;
    gateReason = "invalid_key";
  }

  const loc = firstParam(sp.loc) ?? "entrance";
  const etDateMdy = formatEtDateMDY(new Date());

  return (
    <TvKioskClient
      kioskKey={kioskKey}
      etDateMdy={etDateMdy}
      etTz={ET_TZ}
      // Defaults only — live goal comes from app_settings via /api/tv-goal
      goalBase={500}
      goalStep={50}
      goalAdvanceAtPct={90}
      showLogoSrc="/ssdt-logo.png"
      // ✅ One-QR image (deep link QR)
      helpQrSrc={ONE_QR_IMAGE_SRC}
      venueQrSrc={ONE_QR_IMAGE_SRC}
      locationLabel={loc}
      oneQrMode={true}
      gateOk={gateOk}
      gateReason={gateReason}
    />
  );
}
