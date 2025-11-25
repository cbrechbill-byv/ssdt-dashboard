import React from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type VipDetailPageProps = {
  params: {
    userId: string;
  };
};

export const dynamic = "force-dynamic";

export default async function VipDetailPage({ params }: VipDetailPageProps) {
  const { userId } = params;
  // NOTE: supabaseServer is already a client instance, no ()
  const supabase = supabaseServer;

  // Basic VIP info from rewards_users
  const { data: vip, error } = await supabase
    .from("rewards_users")
    .select("user_id, phone, display_name, is_vip, total_points")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[VIP Detail] load error:", error);
  }

  if (!vip) {
    return (
      <DashboardShell
        title="VIP Details"
        subtitle="Individual VIP profile and activity"
        activeTab="dashboard"
      >
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-6 text-sm text-slate-300">
          <p className="mb-4">VIP not found.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-full bg-[#ffc800] px-4 py-2 text-xs font-semibold text-black shadow hover:bg-[#e6b400]"
          >
            Back to dashboard
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="VIP Details"
      subtitle="Individual VIP profile and activity"
      activeTab="dashboard"
    >
      <div className="space-y-6">
        {/* Top VIP card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                VIP Profile
              </div>
              <div className="mt-1 text-xl font-semibold text-slate-50">
                {vip.display_name || "Unnamed VIP"}
              </div>
              <div className="mt-1 text-sm text-slate-300">
                Phone:{" "}
                <span className="font-mono">
                  {vip.phone || "Not captured"}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <span
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                  vip.is_vip
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-slate-600/30 text-slate-200",
                ].join(" ")}
              >
                {vip.is_vip ? "VIP Member" : "Guest"}
              </span>
              <div className="text-sm text-slate-300">
                Total points:{" "}
                <span className="font-semibold">
                  {vip.total_points ?? 0}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Placeholder for future activity */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-50">
              Activity (coming soon)
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            In a future phase, this page will show check-ins, rewards history,
            and fan wall posts for this VIP.
          </p>
        </section>

        {/* Back link */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900"
          >
            ← Back to VIP dashboard
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
