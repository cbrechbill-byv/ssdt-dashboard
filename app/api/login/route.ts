import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { passcode } = await req.json();
  const adminPass = process.env.ADMIN_PASSCODE;

  if (!adminPass || passcode !== adminPass) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Set cookie
  return new NextResponse(
    JSON.stringify({ ok: true }),
    {
      status: 200,
      headers: {
        "Set-Cookie": `ssdt_admin=1; Path=/; HttpOnly; SameSite=Lax; Secure`,
      },
    }
  );
}
