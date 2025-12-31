// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\checkin\page.tsx
import Image from "next/image";

export const dynamic = "force-dynamic";

const APP_STORE_URL = "https://apps.apple.com/us/app/sugarshack-downtown-app/id6755752186";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function prettyLoc(loc?: string) {
  if (!loc) return null;
  const s = loc.replace(/[-_]/g, " ").trim();
  if (!s) return null;
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function CheckinHelpPage(props: { searchParams?: SearchParams }) {
  const sp = (await props.searchParams) ?? {};
  const locRaw = firstParam(sp.loc);
  const loc = prettyLoc(locRaw);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-[#0b1220] text-white">
      <div className="mx-auto w-full max-w-xl px-5 py-8">
        <div className="flex items-center gap-4">
          <div className="relative h-14 w-14">
            <Image src="/ssdt-logo.png" alt="Sugarshack Downtown" fill className="object-contain" priority />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.34em] text-slate-300">Sugarshack Downtown</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight">Check In Tonight 🎉</h1>
            {loc ? <p className="mt-1 text-sm text-slate-300">Location: <span className="font-semibold text-slate-100">{loc}</span></p> : null}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/45 p-5">
          <p className="text-sm text-slate-200 font-semibold">
            You can check in as <span className="text-teal-300 font-extrabold">Guest</span> (fast) or{" "}
            <span className="text-amber-300 font-extrabold">VIP</span> (rewards + perks).
          </p>

          <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-base">
            <div className="font-black text-amber-300">1</div>
            <div>
              <div className="font-extrabold">Install the app (iPhone)</div>
              <div className="text-slate-300 text-sm">Tap the button below or scan the App Store QR.</div>
            </div>

            <div className="font-black text-amber-300">2</div>
            <div>
              <div className="font-extrabold">Open the app + log in</div>
              <div className="text-slate-300 text-sm">Guest is fine. VIP unlocks surprises + rewards.</div>
            </div>

            <div className="font-black text-amber-300">3</div>
            <div>
              <div className="font-extrabold">Check In → Scan QR</div>
              <div className="text-slate-300 text-sm">Use the Scan QR button inside the Check In menu.</div>
            </div>
          </div>

          <a
            href={APP_STORE_URL}
            className="mt-5 block w-full rounded-2xl bg-amber-300 px-4 py-3 text-center font-extrabold text-black active:scale-[0.99]"
          >
            Open in the App Store
          </a>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Android</p>
            <p className="mt-1 text-slate-200 font-extrabold">Coming soon.</p>
            <p className="mt-1 text-sm text-slate-400">
              For tonight: iPhone app only — staff can still help you check in.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/30 p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">No phone?</p>
          <p className="mt-1 text-slate-200 font-extrabold">No problem — you’re still welcome in.</p>
          <p className="mt-1 text-sm text-slate-400">
            You won’t be denied entry. Staff can help you at the TV screen or with a table card inside.
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Tip: After install, open the app → Check In → Scan QR.
        </p>
      </div>
    </div>
  );
}
