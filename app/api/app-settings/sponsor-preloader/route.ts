// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\app-settings\sponsor-preloader\route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PRELOADER_KEY = "sponsor_preloader";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !service) {
    throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(url, service, { auth: { persistSession: false } });
}

const DEFAULTS = {
  enabled: true,
  title: "Live music stays free because of our sponsors",
  body: "Thanks to these sponsors, the music is free — please support the businesses that support live music.",
  duration_ms: 2200,
  starts_on: null as string | null, // YYYY-MM-DD
  ends_on: null as string | null, // YYYY-MM-DD
  max_sponsors: 8,
  vip_max_shows: 3, // per day (ET)

  // V2 (we keep these for forward-compat, but we ALSO keep sponsor_ids for the app)
  pools: { global: [] as string[] },
  contexts: {} as Record<
    string,
    {
      enabled?: boolean;
      vip_max_shows?: number | null;
      max_sponsors?: number | null;

      // V2 pointer (optional)
      pool?: string | null;

      // Back-compat arrays (your APP reads sponsor_ids today)
      sponsor_ids?: string[] | null;
      allowlist_ids?: string[] | null;
    }
  >,
};

function isPlainObject(v: any) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isYmd(s: any) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function clampNumber(v: any, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function normalizePools(raw: any) {
  const out: Record<string, string[]> = {};
  if (!isPlainObject(raw)) {
    out.global = [];
    return out;
  }

  for (const [k, v] of Object.entries(raw)) {
    const key = String(k || "").trim();
    if (!key) continue;
    const ids = Array.isArray(v)
      ? (v as any[])
          .map((x) => String(x || "").trim())
          .filter(Boolean)
          .slice(0, 500)
      : [];
    out[key] = ids;
  }

  if (!out.global) out.global = [];
  return out;
}

function normalizeContexts(raw: any, poolsOut: Record<string, string[]>) {
  const out: any = {};
  if (!raw || typeof raw !== "object") return out;

  for (const [ctxKeyRaw, ctxValRaw] of Object.entries(raw)) {
    const ctxKey = String(ctxKeyRaw || "").trim();
    if (!ctxKey) continue;

    const v: any = ctxValRaw && typeof ctxValRaw === "object" ? ctxValRaw : {};

    const enabled = v.enabled === undefined ? undefined : !!v.enabled;

    const vip =
      v.vip_max_shows === null || v.vip_max_shows === undefined
        ? v.vip_max_shows
        : clampNumber(v.vip_max_shows, DEFAULTS.vip_max_shows, 0, 50);

    const maxSponsors =
      v.max_sponsors === null || v.max_sponsors === undefined
        ? v.max_sponsors
        : clampNumber(v.max_sponsors, DEFAULTS.max_sponsors, 1, 30);

    // Preferred V2 pointer
    const pool =
      typeof v.pool === "string" && v.pool.trim().length > 0
        ? v.pool.trim()
        : v.pool === null
        ? null
        : undefined;

    // Back-compat allowlist arrays
    const sponsorIds =
      v.sponsor_ids === null
        ? null
        : Array.isArray(v.sponsor_ids)
        ? v.sponsor_ids.map((x: any) => String(x || "").trim()).filter(Boolean)
        : undefined;

    const allowlistIds =
      v.allowlist_ids === null
        ? null
        : Array.isArray(v.allowlist_ids)
        ? v.allowlist_ids.map((x: any) => String(x || "").trim()).filter(Boolean)
        : undefined;

    // Decide "legacy ids" if provided (dashboard writes sponsor_ids)
    const legacyIds = Array.isArray(sponsorIds)
      ? sponsorIds
      : Array.isArray(allowlistIds)
      ? allowlistIds
      : null;

    // If they provided legacy allowlists but not pool, convert into a generated pool key
    let finalPool = pool;

    if ((finalPool === undefined || finalPool === null || finalPool === "global") && Array.isArray(legacyIds)) {
      const generated = `ctx:${ctxKey}`;
      poolsOut[generated] = legacyIds.slice(0, 500);
      finalPool = generated;
    }

    // IMPORTANT: keep sponsor_ids for the APP.
    // Rule: app uses sponsor_ids array = allowlist mode, null/undefined = global pool.
    // - If user explicitly set sponsor_ids to null => keep null
    // - If we have legacyIds array => keep it
    // - Else if they pointed at a non-global pool => expose that pool as sponsor_ids (so app can use it)
    // - Else => leave undefined (app uses global pool)
    let sponsor_ids_out: string[] | null | undefined = undefined;

    if (sponsorIds === null || allowlistIds === null || finalPool === null) {
      sponsor_ids_out = null;
    } else if (Array.isArray(legacyIds)) {
      sponsor_ids_out = legacyIds.slice(0, 500);
    } else if (typeof finalPool === "string" && finalPool !== "global" && Array.isArray(poolsOut[finalPool])) {
      sponsor_ids_out = poolsOut[finalPool].slice(0, 500);
    }

    out[ctxKey] = {
      ...(enabled === undefined ? {} : { enabled }),
      ...(vip === undefined ? {} : { vip_max_shows: vip }),
      ...(maxSponsors === undefined ? {} : { max_sponsors: maxSponsors }),
      ...(finalPool === undefined ? {} : { pool: finalPool }),

      // Back-compat fields (APP reads sponsor_ids)
      ...(sponsor_ids_out === undefined ? {} : { sponsor_ids: sponsor_ids_out }),
      ...(sponsor_ids_out === undefined ? {} : { allowlist_ids: sponsor_ids_out }),
    };
  }

  return out;
}

function normalize(value: any) {
  const merged: any = { ...DEFAULTS, ...(value && typeof value === "object" ? value : {}) };

  merged.enabled = !!merged.enabled;

  merged.title = String(merged.title || DEFAULTS.title).slice(0, 120);
  merged.body = String(merged.body || DEFAULTS.body).slice(0, 400);

  merged.duration_ms = clampNumber(merged.duration_ms, DEFAULTS.duration_ms, 800, 8000);
  merged.max_sponsors = clampNumber(merged.max_sponsors, DEFAULTS.max_sponsors, 1, 30);

  merged.starts_on = isYmd(merged.starts_on) ? String(merged.starts_on).slice(0, 10) : null;
  merged.ends_on = isYmd(merged.ends_on) ? String(merged.ends_on).slice(0, 10) : null;

  merged.vip_max_shows = clampNumber(merged.vip_max_shows, DEFAULTS.vip_max_shows, 0, 50);

  // Pools first (so contexts can write generated pools)
  const poolsOut = normalizePools(merged.pools);
  merged.pools = poolsOut;

  // Context controls (normalize + keep sponsor_ids so app works)
  merged.contexts = normalizeContexts(merged.contexts, poolsOut);

  // Ensure global exists
  if (!merged.pools.global) merged.pools.global = [];

  return merged;
}

export async function GET() {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("app_settings")
      .select("key,value")
      .eq("key", PRELOADER_KEY)
      .maybeSingle();

    if (error) throw error;

    const value = normalize(data?.value);
    return NextResponse.json({ ok: true, data: { key: PRELOADER_KEY, value } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getAdminClient();
    const body = await req.json().catch(() => ({}));

    const next = normalize(body?.value);

    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: PRELOADER_KEY, value: next }, { onConflict: "key" });

    if (error) throw error;

    return NextResponse.json({ ok: true, value: next });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
