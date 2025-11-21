import { NextRequest, NextResponse } from "next/server";

// IMPORTANT:
// This is the only password to control login
const ADMIN_PASSWORD = process.env.SSDT_ADMIN_PASSWORD || "ssdt-admin";

export async function POST(req: NextRequest) {
  // Expect JSON: { password: "..." }
  const { password } = await req.json().catch(() => ({}));

  if (!password || password !== ADMIN_PASSWORD) {
    // On invalid login, just tell the frontend
    return NextResponse.json(
      { ok: false, error: "Invalid password" },
      { status: 401 }
    );
  }

  // SUCCESS — set the cookie on the response object
  const res = NextResponse.json({ ok: true });

  res.cookies.set({
    name: "ssdt_admin",
    value: "1",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return res;
}

// If someone tries a GET on /api/login, we return a JSON instead of 405
export function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST only" },
    { status: 400 }
  );
}
