import { NextRequest, NextResponse } from "next/server";

const USERNAME = process.env.DASHBOARD_USERNAME || "admin";
const PASSWORD = process.env.DASHBOARD_PASSWORD || "changeme";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const username = (formData.get("username") ?? "").toString();
  const password = (formData.get("password") ?? "").toString();

  const isValid = username === USERNAME && password === PASSWORD;

  const redirectPath = isValid ? "/dashboard" : "/login?error=1";
  const res = NextResponse.redirect(new URL(redirectPath, req.url));

  if (isValid) {
    // Set auth cookie for 7 days
    res.cookies.set("ssdt_admin", "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  } else {
    // Clear cookie on failed login
    res.cookies.set("ssdt_admin", "", {
      path: "/",
      maxAge: 0,
    });
  }

  return res;
}

export function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
