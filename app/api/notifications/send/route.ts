import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN;

// Expo push endpoint
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Supabase env vars missing");
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { title, message } = await req.json();

  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  try {
    // 1) Load all registered push tokens from Supabase
    const devicesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/vip_devices?select=expo_push_token`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        cache: "no-store",
      }
    );

    if (!devicesRes.ok) {
      const text = await devicesRes.text();
      console.error("Supabase fetch devices error", devicesRes.status, text);
      return NextResponse.json(
        { error: "Failed to fetch devices" },
        { status: 500 }
      );
    }

    const devices: { expo_push_token: string | null }[] = await devicesRes.json();
    const tokens = devices
      .map((d) => d.expo_push_token)
      .filter((t): t is string => !!t);

    if (tokens.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, note: "No devices registered" });
    }

    // 2) Build Expo push messages
    const messages = tokens.map((token) => ({
      to: token,
      sound: "default" as const,
      title: title || "Sugarshack Downtown",
      body: message,
      data: { source: "ssdt-dashboard" },
    }));

    // 3) Send to Expo
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(EXPO_ACCESS_TOKEN
          ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(messages),
    });

    if (!expoRes.ok) {
      const text = await expoRes.text();
      console.error("Expo push error", expoRes.status, text);
      return NextResponse.json(
        { error: "Failed to send push notifications" },
        { status: 502 }
      );
    }

    const expoJson = await expoRes.json();

    return NextResponse.json({
      ok: true,
      sent: tokens.length,
      expoResponse: expoJson,
    });
  } catch (err) {
    console.error("Send notification error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
