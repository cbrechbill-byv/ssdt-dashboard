import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { passcode } = await request.json();

  const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE;

  if (!ADMIN_PASSCODE) {
    console.error("ADMIN_PASSCODE not set in environment variables.");
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  if (passcode !== ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  }

  // Build response and attach auth cookie
  const res = NextResponse.json({ success: true });

  res.cookies.set("ssdt_admin", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });

  return res;
}
