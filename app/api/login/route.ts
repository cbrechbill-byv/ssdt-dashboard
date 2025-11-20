import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const USERNAME = process.env.DASHBOARD_USERNAME || "admin";
const PASSWORD = process.env.DASHBOARD_PASSWORD || "changeme";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const isValid = username === USERNAME && password === PASSWORD;

  if (!isValid) {
    const res = NextResponse.redirect(new URL("/login?error=1", req.url));
    res.cookies.set("ssdt_admin", "", { maxAge: 0, path: "/" });
    return res;
  }

  cookies().set("ssdt_admin", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return NextResponse.redirect(new URL("/dashboard", req.url));
}

export function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
