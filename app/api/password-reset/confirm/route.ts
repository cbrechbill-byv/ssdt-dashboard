// app/api/password-reset/confirm/route.ts
// Path: /api/password-reset/confirm
// Validates token, checks expiry, sets dashboard_users.password_hash, marks token used.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { token?: string; password?: string }
      | null;

    const token = (body?.token ?? "").trim();
    const password = (body?.password ?? "").trim();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Find token row
    const { data: resetRow, error: resetErr } = await supabaseAdmin
      .from("dashboard_password_resets")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (resetErr) {
      console.error("[password-reset confirm] lookup error", resetErr);
      return NextResponse.json({ error: "Invalid token." }, { status: 400 });
    }

    if (!resetRow?.user_id) {
      return NextResponse.json({ error: "Invalid token." }, { status: 400 });
    }

    if (resetRow.used_at) {
      return NextResponse.json(
        { error: "This reset link has already been used." },
        { status: 400 }
      );
    }

    const expiresAt = resetRow.expires_at ? new Date(resetRow.expires_at) : null;
    if (
      !expiresAt ||
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() < Date.now()
    ) {
      return NextResponse.json(
        { error: "This reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Update user password
    const { error: userUpdateErr } = await supabaseAdmin
      .from("dashboard_users")
      .update({ password_hash })
      .eq("id", resetRow.user_id);

    if (userUpdateErr) {
      console.error("[password-reset confirm] update user error", userUpdateErr);
      return NextResponse.json(
        { error: "Failed to update password." },
        { status: 500 }
      );
    }

    // Mark token used
    const { error: markUsedErr } = await supabaseAdmin
      .from("dashboard_password_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetRow.id);

    if (markUsedErr) {
      console.error("[password-reset confirm] mark used error", markUsedErr);
      // Not fatal
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[password-reset confirm] unexpected error", err);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
