import React from "react";
import Link from "next/link";
import DashboardShell from "../../components/layout/DashboardShell";
import { FanWallModeration } from "../../components/fanwall/FanWallModeration";

// Placeholder values for now; can be wired to Supabase views later.
const DashboardPage = async () => {
  const todayCheckins = 0;
  const todayPoints = 0;
  const todayUniqueVips = 0;
  const totalVips = 0;
  const activeVips = 0;
  const activeRate = 0;

  return (
    <DashboardShell
      title="Sugarshack Downtown VIP Dashboard"
      subtitle="Check-ins, VIP activity, and fan content at a glance."
      activeNav="dashboard"
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: VIP / rewards overview */}
        <section className="space-y-6 lg:col-span-2">
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Check-ins today
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {todayCheckins}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                VIPs who checked in with tonight&apos;s QR
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Unique VIPs today
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {todayUniqueVips}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                One per phone number per day (EST)
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Points awarded today
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {todayPoints}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                From today&apos;s check-ins and rewards
              </p>
            </div>
          </div>

          {/* VIP base card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  VIP base
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {totalVips}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Total unique VIPs with a verified phone number
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Active VIPs
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {activeVips}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {activeRate}% active (recent check-ins)
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Fan wall moderation panel with gold accent */}
        <section className="space-y-4">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-amber-900">
                  Fan Wall moderation
                </h2>
                <p className="mt-1 text-xs text-amber-700">
                  Review and approve fan photos before they show in the app.
                </p>
              </div>
              <Link
                href="/fan-wall"
                className="rounded-full border border-amber-400 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                Open full Fan Wall →
              </Link>
            </div>
            <div className="mt-3 border-t border-amber-200 pt-3">
              <FanWallModeration />
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
};

export default DashboardPage;
