// app/api/dashboard/me/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/dashboardAuth";

/**
 * GET /api/dashboard/me
 * Returns { user: { email, role } } if signed in, else { user: null }.
 */
export async function GET(_req: NextRequest) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.json(
      {
        user: null,
      },
      {
        status: 200,
      }
    );
  }

  return NextResponse.json(
    {
      user: {
        email: session.email,
        role: session.role,
      },
    },
    {
      status: 200,
    }
  );
}
