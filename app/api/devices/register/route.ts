// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\api\devices\register\route.ts
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function digitsOnly(input: string) {
  return (input || "").replace(/\D/g, "");
}

// Store phone as-is OR normalized 10-digit; here we normalize to help matching.
function phone10(input: string | null | undefined): string | null {
  if (!input) return null;
  const d = digitsOnly(input);
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  if (d.length === 10) return d;
  if (d.length > 10) return d.slice(-10);
  return null;
}

type RegisterBody = {
  phone?: string | null;
  expoPushToken?: string;
  platform?: string | null;
  guestDeviceId?: string | null; // ✅ stable local install id (from app)
  userId?: string | null; // ✅ auth.users id (optional when logged in)
};

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[devices/register] Supabase env vars missing");
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  let body: RegisterBody | null = null;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const expoPushToken = (body?.expoPushToken ?? "").trim();
  const platform = (body?.platform ?? null) ? String(body?.platform).trim() : null;

  const guestDeviceId =
    body?.guestDeviceId && String(body.guestDeviceId).trim().length
      ? String(body.guestDeviceId).trim()
      : null;

  const userId =
    body?.userId && String(body.userId).trim().length
      ? String(body.userId).trim()
      : null;

  // Normalize phone to 10 digits for consistency (optional but recommended)
  const phone = phone10(body?.phone ?? null);

  if (!expoPushToken) {
    return NextResponse.json({ error: "Missing expoPushToken" }, { status: 400 });
  }

  // ✅ If we have *none* of phone/userId/guestDeviceId, we still upsert by token,
  // but ideally the app always sends guestDeviceId.
  const payload = {
    expo_push_token: expoPushToken,
    platform: platform || null,
    phone: phone || null,
    user_id: userId || null,
    guest_device_id: guestDeviceId || null,
    last_seen_at: new Date().toISOString(),
  };

  try {
    // ✅ Use upsert on the unique key expo_push_token
    // Supabase REST: POST with ?on_conflict=expo_push_token and Prefer: resolution=merge-duplicates
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/vip_devices?on_conflict=expo_push_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[devices/register] Supabase upsert error", res.status, text);
      return NextResponse.json({ error: "Failed to register device" }, { status: 500 });
    }

    // representation can be an array
    const data = await res.json().catch(() => null);
    return NextResponse.json({ ok: true, device: data ?? null });
  } catch (err) {
    console.error("[devices/register] Device register error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
