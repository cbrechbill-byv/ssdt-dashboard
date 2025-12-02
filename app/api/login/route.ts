import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import bcrypt from "bcryptjs";
import { createDashboardSession } from "@/lib/dashboardAuth";

type DashboardUserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  role: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const rawEmail = body?.email?.toString().trim();
    const rawPassword = body?.password?.toString();

    if (!rawEmail || !rawPassword) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase();

    const supabase = supabaseServer;

    const { data, error } = await supabase
      .from("dashboard_users")
      .select("id, email, password_hash, role")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("[login] Supabase error:", error);
      return NextResponse.json(
        { ok: false, error: "Unexpected error. Please try again." },
        { status: 500 }
      );
    }

    const user = data as DashboardUserRow | null;

    if (!user || !user.password_hash) {
      // Do not reveal which part is wrong
      return NextResponse.json(
        { ok: false, error: "Incorrect email or password." },
        { status: 401 }
      );
    }

    const match = await bcrypt.compare(rawPassword, user.password_hash);
    if (!match) {
      return NextResponse.json(
        { ok: false, error: "Incorrect email or password." },
        { status: 401 }
      );
    }

    // At this point login is valid — set the session cookie
    const response = NextResponse.json(
      {
        ok: true,
        email: user.email,
        role: user.role,
      },
      { status: 200 }
    );

    createDashboardSession(
      { email: user.email, role: user.role || "admin" },
      response
    );

    return response;
  } catch (err: any) {
    console.error("[login] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
