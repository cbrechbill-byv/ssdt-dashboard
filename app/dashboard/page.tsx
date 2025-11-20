import React from "react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { FanWallModeration } from "../../components/fanwall/FanWallModeration";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <DashboardShell title="VIP & Rewards overview">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* Check-ins today */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">
            CHECK-INS TODAY
          </p>
          <p className="text-3xl font-semibold text-slate-900 mb-1">0</p>
          <p className="text-[11px] text-slate-500">
            VIPs who checked in with tonight&apos;s QR
          </p>
        </div>

        {/* Unique VIPs today */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">
            UNIQUE VIPS TODAY
          </p>
          <p className="text-3xl font-semibold text-slate-900 mb-1">0</p>
          <p className="text-[11px] text-slate-500">
            One per phone number per day (EST)
          </p>
        </div>

        {/* Points awarded today */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">
            POINTS AWARDED TODAY
          </p>
          <p className="text-3xl font-semibold text-slate-900 mb-1">0</p>
          <p className="text-[11px] text-slate-500">
            From today&apos;s check-ins and rewards
          </p>
        </div>
      </div>

      {/* VIP base + active */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500">VIP BASE</p>
          </div>
          <p className="text-3xl font-semibold text-slate-900 mb-1">0</p>
          <p className="text-[11px] text-slate-500">
            Total unique VIPs with a verified phone number
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500">ACTIVE VIPS</p>
          </div>
          <p className="text-3xl font-semibold text-slate-900 mb-1">0</p>
          <p className="text-[11px] text-slate-500">
            % active (recent check-ins)
          </p>
        </div>
      </div>

      {/* Fan Wall moderation card on the right */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr,1.4fr] gap-5 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <h3 className="text-xs font-semibold text-slate-500 mb-1">
            Fan Wall moderation
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Review and approve fan photos before they show in the app.
          </p>
          <div className="mt-3">
            <FanWallModeration />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <h3 className="text-xs font-semibold text-slate-500 mb-1">
              Quick actions
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Jump to common Sugarshack Downtown controls.
            </p>

            <div className="space-y-2">
              <Link
                href="/dashboard/tonight"
                className="flex items-start justify-between rounded-xl border border-slate-200 px-3 py-2.5 hover:border-amber-400 hover:bg-amber-50 transition"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    Tonight&apos;s show editor
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Update artist, start time, and notes for tonight.
                  </p>
                </div>
                <span className="text-xs text-slate-400">Coming soon</span>
              </Link>

              <Link
                href="/fan-wall"
                className="flex items-start justify-between rounded-xl border border-slate-200 px-3 py-2.5 hover:border-amber-400 hover:bg-amber-50 transition"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    Open full Fan Wall
                  </p>
                  <p className="text-[11px] text-slate-500">
                    See all pending Photo Booth shots in one place.
                  </p>
                </div>
                <span className="text-xs text-slate-400">Go</span>
              </Link>

              <Link
                href="/dashboard/exports"
                className="flex items-start justify-between rounded-xl border border-slate-200 px-3 py-2.5 hover:border-amber-400 hover:bg-amber-50 transition"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    VIP export &amp; reports
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Download VIP list and activity as CSV for campaigns.
                  </p>
                </div>
                <span className="text-xs text-slate-400">Coming soon</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
