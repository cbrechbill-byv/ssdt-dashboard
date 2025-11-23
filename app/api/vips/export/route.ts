import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("rewards_user_overview")
    .select(
      "user_id, phone, full_name, email, zip, is_vip, total_points, total_visits, first_scan_at, last_scan_at"
    )
    .eq("is_vip", true)
    .not("phone", "is", null);

  if (error) {
    console.error("[VIP CSV Export] Error:", error);
    return NextResponse.json(
      { error: "Failed to export VIP data" },
      { status: 500 }
    );
  }

  const rows = data ?? [];

  const header = [
    "user_id",
    "phone",
    "full_name",
    "email",
    "zip",
    "is_vip",
    "total_points",
    "total_visits",
    "first_scan_at",
    "last_scan_at",
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes('"') || str.includes(",") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    header.join(","),
    ...rows.map((row: any) =>
      [
        row.user_id,
        row.phone,
        row.full_name,
        row.email,
        row.zip,
        row.is_vip ? "true" : "false",
        row.total_points ?? 0,
        row.total_visits ?? 0,
        row.first_scan_at ?? "",
        row.last_scan_at ?? "",
      ]
        .map(escapeCsv)
        .join(",")
    ),
  ];

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vip_export.csv"',
    },
  });
}
