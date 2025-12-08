import { NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/dashboardAuth";

export async function GET() {
  try {
    const session = await getDashboardSession();

    if (!session) {
      return NextResponse.json({
        ok: true,
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      ok: true,
      authenticated: true,
      user: {
        email: session.email,
        role: session.role,
      },
    });
  } catch (err) {
    console.error("[dashboard/me] Error reading session:", err);
    return NextResponse.json(
      { ok: false, authenticated: false, user: null },
      { status: 500 }
    );
  }
}
