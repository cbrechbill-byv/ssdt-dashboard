import { NextResponse } from "next/server";

// TEMPORARY: always report an "admin" user so the dashboard works
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      authenticated: true,
      user: {
        email: "test@sugarshackdowntown.com",
        role: "admin",
      },
    },
    { status: 200 }
  );
}
