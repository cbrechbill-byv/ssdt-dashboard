import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // TODO: real auth later – for now just send staff to the dashboard.
  const url = new URL("/dashboard", request.url);
  return NextResponse.redirect(url);
}
