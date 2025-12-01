// app/api/login/route.ts

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseServer } from "@/lib/supabaseServer";
import { SESSION_COOKIE_NAME } from "@/lib/dashboardAuth";

export const runtime = "nodejs"; // required for bcrypt + Buffer

type DashboardUserRow = {
  id: string;
  email: string;
  password_hash: string;
  role: "admin" | "viewer";
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body.email || "").toString().trim().toLowerCase();
    const password = (body.password || "").toString();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const supabase = supabaseServer;

    const { data, error } = await supabase
      .from<DashboardUserRow>("dashboard_users")
      .select("id, email, password_hash, role")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("[login] Supabase error:", error);
      return NextResponse.json(
        { error: "Login failed. Please try again." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, data.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 }
      );
    }

    // Build a lightweight session payload
    const sessionPayload = {
      id: data.id,
      email: data.email,
      role: data.role,
      iat: Date.now(),
    };

    const encoded = Buffer.from(
      JSON.stringify(sessionPayload),
      "utf8"
    ).toString("base64");

    const res = NextResponse.json(
      {
        ok: true,
        user: {
          id: data.id,
          email: data.email,
          role: data.role,
        },
      },
      { status: 200 }
    );

    res.cookies.set(SESSION_COOKIE_NAME, encoded, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return res;
  } catch (err: any) {
    console.error("[login] exception:", err);
    return NextResponse.json(
      {
        error:
          "Unexpected error during login: " +
          (err?.message || "Unknown error"),
      },
      { status: 500 }
    );
  }
}
