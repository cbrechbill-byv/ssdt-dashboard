import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Simple server-side insert using Supabase REST.
export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Supabase env vars missing");
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { phone, expoPushToken, platform } = await req.json();

  if (!expoPushToken) {
    return NextResponse.json({ error: "Missing expoPushToken" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/vip_devices`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          phone: phone || null,
          expo_push_token: expoPushToken,
          platform: platform || null,
          last_seen_at: new Date().toISOString()
        })
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Supabase insert error", res.status, text);
      return NextResponse.json({ error: "Failed to register device" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Device register error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
