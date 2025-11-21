import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Read body just so Next doesn't complain, but we ignore the value for now
  await req.json().catch(() => null);

  const res = NextResponse.json({ ok: true });

  // Set a simple admin cookie used by middleware/dashboard
  res.cookies.set("ssdt_admin", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  return res;
}
