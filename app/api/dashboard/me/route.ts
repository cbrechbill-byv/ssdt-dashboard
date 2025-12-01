// app/api/dashboard/me/route.ts

import { NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/dashboardAuth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getDashboardSession(); // <- await now

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        id: session.id,
        email: session.email,
        role: session.role,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[dashboard/me] exception:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
