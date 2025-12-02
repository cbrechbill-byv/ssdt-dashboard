import { NextResponse } from "next/server";
import { clearDashboardSession } from "@/lib/dashboardAuth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearDashboardSession(response);
  return response;
}
