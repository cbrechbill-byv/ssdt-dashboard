import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Audience = "all" | "vip" | "test";

type NotificationPayload = {
  title: string;
  body: string;          // 👈 this matches your page.tsx
  route?: string;
  audience?: Audience;   // "all" | "vip" | "test"
  data?: Record<string, any>;
};

export async function POST(req: NextRequest) {
  try {
    const json = (await req.json()) as NotificationPayload;

    const title = json.title?.trim();
    const body = json.body?.trim();
    const route = json.route ?? "/home";
    const audience = (json.audience ?? "all") as Audience;
    const extraData = json.data ?? {};

    if (!title || !body) {
      return NextResponse.json(
        { error: "Missing title or body" },
        { status: 400 }
      );
    }

    // 1) Pick devices based on audience
    let query = supabaseServer
      .from("vip_devices")
      .select("expo_push_token, platform, phone")
      .not("expo_push_token", "is", null);

    if (audience === "vip") {
      query = query.not("phone", "is", null);
    } else if (audience === "test") {
      const testPhone =
        process.env.TEST_DEVICE_PHONE ?? "+12394105626";
      query = query.eq("phone", testPhone);
    }

    const { data: devices, error: devicesError } = await query;

    if (devicesError) {
      console.error("[Push API] Error fetching devices:", devicesError);
      return NextResponse.json(
        { error: "Failed to fetch devices" },
        { status: 500 }
      );
    }

    if (!devices || devices.length === 0) {
      return NextResponse.json(
        { message: "No devices to notify" },
        { status: 200 }
      );
    }

    const sentCount = devices.length;
    const sampleDevices = devices.slice(0, 5).map((d) => ({
      phone: d.phone,
      platform: d.platform,
    }));

    // 2) Create log entry first and get its ID
    const { data: logRows, error: logError } = await supabaseServer
      .from("notification_logs")
      .insert({
        title,
        body,
        audience,
        route,
        sent_count: sentCount,
        sample_devices: sampleDevices,
      })
      .select("id")
      .limit(1);

    if (logError) {
      console.error("[Push API] Log insert error:", logError);
    }

    const logId = logRows?.[0]?.id as string | undefined;

    // 3) Build messages for Expo
    const messages = devices.map((d) => ({
      to: d.expo_push_token,
      sound: "default" as const,
      title,
      body,           // 👈 THIS is your typed message
      data: {
        route,
        platform: d.platform,
        phone: d.phone,
        audience,
        notification_log_id: logId ?? null,
        ...extraData,
      },
    }));

    console.log(
      `[Push API] Sending ${messages.length} notifications (audience=${audience})`
    );

    // 4) Call Expo push API
    const expoResponse = await fetch(
      "https://exp.host/--/api/v2/push/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(messages),
      }
    );

    const expoJson = await expoResponse.json();

    if (!expoResponse.ok) {
      console.error("[Push API] Expo push error:", expoJson);
      return NextResponse.json(
        { error: "Expo push failed", expo: expoJson },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        count: messages.length,
        expo: expoJson,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[Push API] Unexpected:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
