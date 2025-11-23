import React from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type VipDetailPageProps = {
  params: {
    userId: string;
  };
};

export default async function VipDetailPage({ params }: VipDetailPageProps) {
  const supabase = supabaseServer;
  const { userId } = params;

  // Load VIP overview row
  const { data: overviewRows, error: overviewError } = await supabase
    .from("rewards_user_overview")
    .select(
      "user_id, phone, full_name, email, zip, is_vip, total_points, total_visits, first_scan_at, last_scan_at"
    )
    .eq("user_id", userId)
    .limit(1);

  if (overviewError) {
    console.error("[VIP Detail] Error loading overview:", overviewError);
  }

  const vip = overviewRows?.[0];

  // Load visit history
  const { data: scans, error: scansError } = await supabase
    .from("rewards_scans")
    .select("id, qr_code, points, scanned_at, source, note, metadata")
    .eq("user_id", userId)
    .order("scanned_at", { ascending: false })
    .limit(200);

  if (scansError) {
    console.error("[VIP Detail] Error loading scans:", scansError);
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              VIP detail
            </p>
            <h1 className="text-xl font-semibold text-slate-900 mt-1">
              {vip?.full_name || "VIP Guest"}
            </h1>
            {vip?.phone && (
              <p className="text-xs text-slate-500 mt-0.5">{vip.phone}</p>
            )}
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 shadow-sm"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* VIP summary card */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          {vip ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                  VIP info
                </p>
                <p className="mt-1 text-slate-900 font-medium">
                  {vip.full_name || "VIP Guest"}
                </p>
                <p className="text-xs text-slate-500">
                  {vip.phone || "No phone on file"}
                </p>
                <p className="text-xs text-slate-500">
                  {vip.email || "No email on file"}
                  {vip.zip ? ` · ${vip.zip}` : ""}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                  Points & visits
                </p>
                <p className="mt-1 text-slate-900 font-semibold">
                  {vip.total_points ?? 0} points
                </p>
                <p className="text-xs text-slate-500">
                  {vip.total_visits ?? 0} total visits
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                  First visit
                </p>
                <p className="mt-1 text-slate-900 text-sm">
                  {vip.first_scan_at
                    ? new Date(vip.first_scan_at).toLocaleString()
                    : "-"}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                  Last visit
                </p>
                <p className="mt-1 text-slate-900 text-sm">
                  {vip.last_scan_at
                    ? new Date(vip.last_scan_at).toLocaleString()
                    : "-"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              VIP not found. They may have been deleted or never checked in.
            </p>
          )}
        </section>

        {/* Visit history */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                Visit history
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Most recent check-ins for this VIP (up to 200 visits).
              </p>
            </div>
          </div>

          {!scans || scans.length === 0 ? (
            <div className="py-6 text-xs text-slate-400 text-center">
              No visits recorded yet for this VIP.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Points</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">QR Code</th>
                    <th className="py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan: any) => (
                    <tr
                      key={scan.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 pr-3 text-slate-900">
                        {new Date(scan.scanned_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">
                        {scan.points ?? 0}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-600">
                        {scan.source || "app"}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-600">
                        {scan.qr_code || "-"}
                      </td>
                      <td className="py-2 text-xs text-slate-600">
                        {scan.note || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
