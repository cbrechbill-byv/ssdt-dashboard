import { NextRequest, NextResponse } from "next/server";

const USERNAME = process.env.DASHBOARD_USERNAME || "admin";
const PASSWORD = process.env.DASHBOARD_PASSWORD || "changeme";

function buildAuthResponse(
  username: string,
  password: string,
  req: NextRequest
) {
  const isValid = username === USERNAME && password === PASSWORD;
  const redirectPath = isValid ? "/dashboard" : "/login?error=1";
  const res = NextResponse.redirect(new URL(redirectPath, req.url));

  if (isValid) {
    res.cookies.set("ssdt_admin", "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  } else {
    res.cookies.set("ssdt_admin", "", {
      path: "/",
      maxAge: 0,
    });
  }

  return res;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const username = (formData.get("username") ?? "").toString();
  const password = (formData.get("password") ?? "").toString();

  return buildAuthResponse(username, password, req);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const username = url.searchParams.get("username") ?? "";
  const password = url.searchParams.get("password") ?? "";

  // If someone hits /api/login directly, just send them back to /login
  if (!username && !password) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return buildAuthResponse(username, password, req);
}
