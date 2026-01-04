// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\tv-goal\route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabaseServerClient() {
  // Prefer service role for server-side reads (no RLS pain)
  if (SUPABASE_URL && SERVICE_ROLE) {
    return createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  // Fallback (requires RLS policy allowing anon select for tv_goal)
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function clampInt(n: any, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    if (!SUPABASE_URL) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_URL env" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("app_settings")
      .select("key,value,updated_at")
      .eq("key", "tv_goal")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const v = (data?.value || {}) as any;

    // Reasonable guardrails (prevents bad config breaking TV)
    const goalBase = clampInt(v.goalBase, 50, 50000, 500);
    const goalStep = clampInt(v.goalStep, 5, 5000, 50);
    const goalAdvanceAtPct = clampInt(v.goalAdvanceAtPct, 50, 99, 90);

    return NextResponse.json({
      ok: true,
      goalBase,
      goalStep,
      goalAdvanceAtPct,
      updatedAt: data?.updated_at ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
