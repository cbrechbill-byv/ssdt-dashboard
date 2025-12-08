import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createDashboardSession } from "@/lib/dashboardAuth";
import bcrypt from "bcryptjs";

type DashboardUserRow = {
  id: string;
  email: string;
  role: string | null;
  password_hash: string;
};

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const supabase = supabaseServer;

    // Look up dashboard user
    const { data: userRow, error: userErr } = await supabase
      .from("dashboard_users")
      .select("id, email, role, password_hash")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (userErr) {
      console.error("[Dashboard login] error loading user", userErr);
    }

    const user = userRow as DashboardUserRow | null;

    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Create the response we’ll send back
    const response = NextResponse.json({ ok: true });

    // Create dashboard cookie session
    createDashboardSession(
      {
        email: user.email,
        role: (user.role as any) || "admin",
      },
      response
    );

    // Log login in dashboard_audit_log (fire-and-forget)
    try {
      await supabase.from("dashboard_audit_log").insert({
        actor_email: user.email,
        actor_role: user.role || "admin",
        action: "login",
        entity: "dashboard_session",
        entity_id: user.id,
        details: {
          source: "dashboard-login-route",
        },
      });
    } catch (logErr) {
      console.error("[Dashboard login] error writing audit log", logErr);
    }

    return response;
  } catch (err) {
    console.error("[Dashboard login] unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected error during login." },
      { status: 500 }
    );
  }
}
