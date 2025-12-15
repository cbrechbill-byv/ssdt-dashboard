// app/api/mobile/account/delete/route.ts
//
// Mobile account deletion endpoint used by the SSDT Fresh app Profile screen.
// Expects: Authorization: Bearer <access_token> from the Supabase session.
// Flow:
//   1) Validate token -> get auth user.
//   2) Look up rewards_users for phone/email.
//   3) Delete/anonymize related records in:
//      - fan_wall_posts
//      - rewards_scans
//      - rewards_redemptions
//      - vip_devices
//      - rewards_users
//      - feedback (strip contact info)
//   4) Attempt to delete Supabase auth user (non-fatal if it fails).
//   5) Log to activity_log via logDashboardEventServer (best-effort).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, createUserClient } from "@/lib/supabaseAdmin";
import { logDashboardEventServer } from "@/lib/logDashboardEventServer";

export async function POST(req: NextRequest) {
  try {
    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice("bearer ".length).trim();
    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing access token" },
        { status: 401 }
      );
    }

    // 1) Validate token & get auth user
    const userClient = createUserClient(accessToken);
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      console.error("[account delete] auth error", authError);
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userEmail = user.email ?? null;

    // 2) Look up rewards_users profile for phone/email
    const { data: rewardsProfile, error: profileError } = await supabaseAdmin
      .from("rewards_users")
      .select("user_id, phone, email")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[account delete] rewards_users lookup error", profileError);
      // not fatal – we can still attempt deletes by userId
    }

    const phone = rewardsProfile?.phone ?? null;
    const rewardsEmail = rewardsProfile?.email ?? null;

    // 3) Delete/anonymize dependent records

    // 3a) Fan wall posts
    const { error: fanWallError } = await supabaseAdmin
      .from("fan_wall_posts")
      .delete()
      .eq("user_id", userId);

    if (fanWallError) {
      console.error("[account delete] fan_wall_posts delete error", fanWallError);
    }

    // 3b) Rewards scans
    const { error: scansError } = await supabaseAdmin
      .from("rewards_scans")
      .delete()
      .eq("user_id", userId);

    if (scansError) {
      console.error("[account delete] rewards_scans delete error", scansError);
    }

    // 3c) Rewards redemptions
    const { error: redemptionsError } = await supabaseAdmin
      .from("rewards_redemptions")
      .delete()
      .eq("user_id", userId);

    if (redemptionsError) {
      console.error(
        "[account delete] rewards_redemptions delete error",
        redemptionsError
      );
    }

    // 3d) VIP devices – match by phone if we have it
    if (phone) {
      const { error: vipDevicesError } = await supabaseAdmin
        .from("vip_devices")
        .delete()
        .eq("phone", phone);

      if (vipDevicesError) {
        console.error("[account delete] vip_devices delete error", vipDevicesError);
      }
    }

    // 3e) rewards_users row
    const { error: rewardsUsersDeleteError } = await supabaseAdmin
      .from("rewards_users")
      .delete()
      .eq("user_id", userId);

    if (rewardsUsersDeleteError) {
      console.error(
        "[account delete] rewards_users delete error",
        rewardsUsersDeleteError
      );
    }

    // 3f) Feedback – anonymize contact info that looks tied to this user
    const feedbackFilters: string[] = [];
    if (userEmail) {
      feedbackFilters.push(`contact_email.eq.${userEmail}`);
    }
    if (rewardsEmail && rewardsEmail !== userEmail) {
      feedbackFilters.push(`contact_email.eq.${rewardsEmail}`);
    }
    if (phone) {
      feedbackFilters.push(`contact_phone.eq.${phone}`);
    }

    if (feedbackFilters.length > 0) {
      const orFilter = feedbackFilters.join(",");
      const { error: feedbackError } = await supabaseAdmin
        .from("feedback")
        .update({
          contact_name: null,
          contact_email: null,
          contact_phone: null,
        })
        .or(orFilter);

      if (feedbackError) {
        console.error("[account delete] feedback anonymize error", feedbackError);
      }
    }

    // 4) Try to delete auth user – but don't fail the whole request if this part breaks
    try {
      const { error: deleteUserError } =
        await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteUserError) {
        console.error("[account delete] auth delete error", deleteUserError);
        // NOTE: We intentionally do NOT return an error here.
      }
    } catch (deleteUserException) {
      console.error(
        "[account delete] auth delete exception",
        deleteUserException
      );
      // Also non-fatal.
    }

    // 5) Audit log in activity_log (best-effort)
    try {
      await logDashboardEventServer({
        action: "delete",
        entity: "rewards_users",
        entityId: userId,
        details: {
          source: "mobile-account-delete",
          had_rewards_profile: !!rewardsProfile,
          email: userEmail,
          phone,
        },
      });
    } catch (logErr) {
      console.error("[account delete] logDashboardEventServer error", logErr);
      // Also non-fatal.
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[account delete] unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected error deleting account" },
      { status: 500 }
    );
  }
}
