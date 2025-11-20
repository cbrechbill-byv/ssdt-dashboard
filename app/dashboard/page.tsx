import React from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";

function StatCard(props: {
  label: string;
  helper: string;
}) {
  const { label, helper } = props;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
      <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">0</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Top row: 3 key stats */}
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Check-ins today"
            helper="VIPs who checked in with tonight&apos;s QR."
          />
          <StatCard
            label="Unique VIPs today"
            helper="One per phone number per day (EST)."
          />
          <StatCard
            label="Points awarded today"
            helper="From today&apos;s check-ins and rewards."
          />
        </section>

        {/* Second row: 2 wider stats */}
        <section className="grid gap-4 md:grid-cols-2">
          <StatCard
            label="VIP base"
            helper="Total unique VIPs with a verified phone number."
          />
          <StatCard
            label="Active VIPs"
            helper="% of VIPs with a recent check-in."
          />
        </section>

        {/* Third row: fan wall + quick actions side by side */}
        <section className="grid gap-4 lg:grid-cols-3">
          {/* Fan wall moderation (main) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                  Fan Wall moderation
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Review and approve fan photos before they show in the app.
                </p>
              </div>
              <button className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 shadow-sm">
                Refresh
              </button>
            </div>
            <div className="px-5 py-8 text-center text-xs text-slate-400">
              No fan photos yet. Once guests start posting from the Photo Booth,
              they&apos;ll appear here for approval.
            </div>
          </div>

          {/* Quick actions (side card) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col">
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              Quick actions
            </p>
            <p className="mt-1 mb-3 text-xs text-slate-500">
              Jump to common Sugarshack Downtown controls.
            </p>

            <div className="space-y-2 text-xs text-slate-700">
              <button
                type="button"
                className="w-full text-left rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <span className="block font-medium text-slate-900">
                  Tonight&apos;s show editor
                </span>
                <span className="block text-[11px] text-slate-500">
                  Update artist, start time, and notes for tonight.
                </span>
              </button>

              <button
                type="button"
                className="w-full text-left rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <span className="block font-medium text-slate-900">
                  Open full Fan Wall
                </span>
                <span className="block text-[11px] text-slate-500">
                  See all pending Photo Booth shots in one place.
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Bottom: exports / reports */}
        <section>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              VIP export &amp; reports
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Download VIP list and activity as CSV for campaigns.
            </p>
            <p className="mt-3 text-xs font-medium text-amber-500">
              Coming soon.
            </p>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
