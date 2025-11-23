import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type Audience = "all" | "vip" | "test";

type NotificationPayload = {
  title: string;
  body: string;
  route?: string;
  audience?: Audience;
  data?: Record<string, any>;
};

export async function POST(req: NextRequest) {
  try {
    const json = (await req.json()) as NotificationPayload;

    const title = json.title?.trim();
    const body = json.body?.trim();
    const route = json.route?.trim() || "/messages";
    const audience = (json.audience ?? "all") as Audience;
    const extraData = json.data ?? {};

    if (!title || !body) {
      return NextResponse.json(
        { error: "Missing title or body" },
        { status: 400 }
      );
    }

    // ---------- Choose devices based on audience ----------
    let devices: { expo_push_token: string; platform: string; phone: string | null }[] =
      [];

    if (audience === "test") {
      // 1) Get all test phones from the dedicated table
      const { data: testRows, error: testError } = await supabaseServer
        .from("notification_test_devices")
        .select("phone");

      if (testError) {
        console.error("[Push API] Error fetching test devices:", testError);
        return NextResponse.json(
          { error: "Failed to fetch test devices" },
          { status: 500 }
        );
      }

      const testPhones = (testRows ?? [])
        .map((r) => r.phone)
        .filter((p): p is string => !!p);

      console.log("[Push API] Test phones:", testPhones);

      if (testPhones.length === 0) {
        // Still log the attempt below, but no devices to send to
        devices = [];
      } else {
        // 2) Find vip_devices with those phones
        const { data: testDevices, error: devicesError } = await supabaseServer
          .from("vip_devices")
          .select("expo_push_token, platform, phone")
          .not("expo_push_token", "is", null)
          .in("phone", testPhones);

        if (devicesError) {
          console.error("[Push API] Error fetching test vip_devices:", devicesError);
          return NextResponse.json(
            { error: "Failed to fetch test devices" },
            { status: 500 }
          );
        }

        devices = (testDevices ?? []) as any[];
      }
    } else {
      // Base query for ALL and VIP
      let query = supabaseServer
        .from("vip_devices")
        .select("expo_push_token, platform, phone")
        .not("expo_push_token", "is", null);

      if (audience === "vip") {
        // VIP = has phone
        query = query.not("phone", "is", null);
      }

      const { data: baseDevices, error: baseError } = await query;

      if (baseError) {
        console.error("[Push API] Error fetching devices:", baseError);
        return NextResponse.json(
          { error: "Failed to fetch devices" },
          { status: 500 }
        );
      }

      devices = (baseDevices ?? []) as any[];
    }

    const safeDevices = devices ?? [];
    const sentCount = safeDevices.length;
    const sampleDevices = safeDevices.slice(0, 5).map((d) => ({
      phone: d.phone,
      platform: d.platform,
    }));

    console.log(
      `[Push API] Audience=${audience} -> ${sentCount} device(s) found. Sample:`,
      sampleDevices
    );

    // ---------- Log in notification_logs ----------
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

    if (sentCount === 0) {
      console.log(
        `[Push API] No devices to notify for audience=${audience}. Logged attempt only.`
      );
      return NextResponse.json(
        {
          ok: true,
          count: 0,
          logId,
          message: "No devices to notify for this audience.",
        },
        { status: 200 }
      );
    }

    // ---------- Send via Expo ----------
    const messages = safeDevices.map((d) => ({
      to: d.expo_push_token,
      sound: "default" as const,
      title,
      body,
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
        logId,
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
