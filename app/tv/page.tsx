// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\tv\page.tsx
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
  // Always ET, always MM/DD/YYYY
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(now);
}

function getKioskEnvKey(): string | null {
  // Primary (new / desired)
  const primary = process.env.CHECKIN_BOARD_KEY?.trim();
  if (primary) return primary;

  // Backward compatibility (older name some code may have used)
  const fallback = process.env.CHECKIN_BOARD_KEY?.trim();
  if (fallback) return fallback;

  return null;
}

export default async function TvPage(props: { searchParams?: SearchParams }) {
  const sp = (await props.searchParams) ?? {};
  const urlKey = firstParam(sp.key) ?? "";
  const loc = firstParam(sp.loc) ?? "entrance";

  const envKey = getKioskEnvKey();

  // If env not configured or key mismatch, treat as unauthorized.
  // Your "/" likely routes to login — so it will look like "it sent me to login."
  if (!envKey || urlKey !== envKey) redirect("/");

  const etDateMdy = formatEtDateMDY(new Date());

  return (
    <TvKioskClient
      kioskKey={urlKey}
      etDateMdy={etDateMdy}
      etTz={ET_TZ}
      goalBase={500}
      goalStep={100}
      goalAdvanceAtPct={90}
      showLogoSrc="/ssdt-logo.png"
      helpQrSrc="/appstore-qr.png"
      venueQrSrc="/SSDTVIP-CHECKIN.png"
      locationLabel={loc}
    />
  );
}
