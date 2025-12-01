import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import bcrypt from "bcryptjs";
import { createDashboardSession } from "@/lib/dashboardAuth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body.email?.toLowerCase().trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer;

    // ------------------------------------------
    // FIXED: Removed broken generic <DashboardUserRow>
    // ------------------------------------------
    const { data: user, error } = await supabase
      .from("dashboard_users")
      .select("id, email, password_hash, role")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("[login] Supabase error:", error);
    }

    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: "Incorrect email or password" },
        { status: 401 }
      );
    }

    // Validate password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Incorrect email or password" },
        { status: 401 }
      );
    }

    // Create dashboard session cookie
    const res = NextResponse.json({ ok: true });

    await createDashboardSession({
      email: user.email,
      role: user.role,
      response: res,
    });

    return res;
  } catch (err) {
    console.error("[login] Unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
