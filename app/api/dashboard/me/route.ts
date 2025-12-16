// app/api/dashboard/me/route.ts
// Path: /api/dashboard/me
// Returns current dashboard session (cookie-based)

import { NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/dashboardAuth";

export async function GET() {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      email: session.email,
      role: session.role ?? "admin",
    },
  });
}
