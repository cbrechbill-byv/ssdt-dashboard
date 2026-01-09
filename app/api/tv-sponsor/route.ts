// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv-sponsor\route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";
const SPONSOR_BUCKET = "sponsor-logos";

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function jsonNoStore(body: any, init?: { status?: number }) {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

export async function GET(req: NextRequest) {
  const envKey = process.env.CHECKIN_BOARD_KEY?.trim() ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";

  // Lock this endpoint behind the same key used by the TV board
  if (!envKey || key !== envKey) {
    return jsonNoStore({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer;
  const todayEt = getEtYmd(new Date());

  // Find the “best” schedule row for today:
  // active, in date range, highest priority, most recent start_date
  const { data: sched, error: schedErr } = await supabase
    .from("tv_sponsor_schedule")
    .select("id,sponsor_id,start_date,end_date,priority,is_active")
    .eq("is_active", true)
    .lte("start_date", todayEt)
    .or(`end_date.is.null,end_date.gte.${todayEt}`)
    .order("priority", { ascending: false })
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (schedErr) return jsonNoStore({ ok: false, error: schedErr.message }, { status: 500 });

  if (!sched) {
    return jsonNoStore({
      ok: true,
      found: false,
      todayEt,
      schedule: null,
      sponsor: null,
    });
  }

  const { data: sponsor, error: sponsorErr } = await supabase
    .from("sponsors")
    .select("id,name,logo_path,website_url,tier,sponsor_message")
    .eq("id", sched.sponsor_id)
    .maybeSingle();

  if (sponsorErr) return jsonNoStore({ ok: false, error: sponsorErr.message }, { status: 500 });

  // Build a public URL for the logo (bucket must be public)
  let logoUrl: string | null = null;
  if (sponsor?.logo_path) {
    const { data } = supabase.storage.from(SPONSOR_BUCKET).getPublicUrl(sponsor.logo_path);
    logoUrl = data?.publicUrl ?? null;
  }

  return jsonNoStore({
    ok: true,
    found: true,
    todayEt,
    schedule: {
      id: sched.id,
      start_date: sched.start_date,
      end_date: sched.end_date,
      priority: sched.priority,
    },
    sponsor: sponsor
      ? {
          id: sponsor.id,
          name: sponsor.name,
          tier: sponsor.tier,
          website_url: sponsor.website_url,
          sponsor_message: sponsor.sponsor_message,
          logo_url: logoUrl,
        }
      : null,
  });
}
