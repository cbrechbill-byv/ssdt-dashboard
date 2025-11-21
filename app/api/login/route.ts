import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const ADMIN_PASSWORD = process.env.SSDT_ADMIN_PASSWORD || "ssdt-admin";

export async function POST(request: NextRequest) {
  const { password }: { password?: string } = await request
    .json()
    .catch(() => ({}));

  if (!password || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const cookieStore = cookies();

  cookieStore.set("ssdt_admin", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return NextResponse.json({ ok: true });
}
