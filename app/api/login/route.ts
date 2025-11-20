import { NextRequest, NextResponse } from "next/server";

// Hard-coded dashboard credentials
const USER = "admin";
const PASS = "MrBanks143!!!";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (username === USER && password === PASS) {
    const res = NextResponse.json({ ok: true });

    res.cookies.set("dashboard-auth", "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });

    return res;
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
