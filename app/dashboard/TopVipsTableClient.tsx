// app/dashboard/TopVipsTableClient.tsx
// Path: /dashboard
// Purpose: Renders Top VIPs table with a toggle to show Top 10 or Top 20 VIPs.
// Behavior:
// - Toggle button is always visible
// - Disabled when there are not more than 10 VIPs
// - Helper text explains when only limited VIPs exist
// - VIP names link to VIP Insights

"use client";

import React from "react";
import Link from "next/link";

type VipListRow = {
  userId: string;
  phoneLabel: string;
  nameLabel: string;
  points: number;
  visits: number;
  lastVisitLabel: string;
};

export function TopVipsTableClient({
  vipList,
  totalVipCount,
}: {
  vipList: VipListRow[];
  totalVipCount: number;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const hasMoreThanTen = vipList.length > 10;
  const visible = expanded ? vipList.slice(0, 20) : vipList.slice(0, 10);

  function handleToggle() {
    if (!hasMoreThanTen) return;
    setExpanded((v) => !v);
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
            Top VIPs
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Uses{" "}
            <code className="font-mono text-[10px]">rewards_user_overview</code>{" "}
            (same points as the mobile app). Total VIPs:{" "}
            <span className="font-semibold text-slate-900">
              {totalVipCount}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={!hasMoreThanTen}
          className={`text-xs font-medium rounded-full border px-3 py-1.5 shadow-sm transition
            ${
              hasMoreThanTen
                ? "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
            }`}
        >
          {expanded ? "Show top 10" : "Show top 20"}
        </button>
      </div>

      {!hasMoreThanTen && (
        <p className="mb-2 text-[11px] text-slate-500">
          Only {vipList.length} VIP{vipList.length === 1 ? "" : "s"} available —
          showing all.
        </p>
      )}

      {visible.length === 0 ? (
        <p className="text-xs text-slate-400">No VIP activity yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.12em] text-slate-500 border-b border-slate-100">
                <th className="py-2 pr-3 text-left font-semibold">VIP</th>
                <th className="py-2 pr-3 text-left font-semibold">Phone</th>
                <th className="py-2 pr-3 text-right font-semibold">Points</th>
                <th className="py-2 pr-3 text-right font-semibold">Visits</th>
                <th className="py-2 text-right font-semibold">Last visit</th>
              </tr>
            </thead>

            <tbody>
              {visible.map((row, idx) => (
                <tr
                  key={`${row.userId}-${idx}`}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="py-2 pr-3 text-[13px] text-slate-900">
                    <Link
                      href={`/rewards/vips/${row.userId}/insights`}
                      className="font-semibold text-slate-900 hover:text-amber-600"
                    >
                      {row.nameLabel}
                    </Link>
                  </td>

                  <td className="py-2 pr-3 text-[13px] text-slate-700">
                    {row.phoneLabel}
                  </td>

                  <td className="py-2 pr-3 text-right text-[13px] text-slate-900">
                    {row.points}
                  </td>

                  <td className="py-2 pr-3 text-right text-[13px] text-slate-900">
                    {row.visits}
                  </td>

                  <td className="py-2 text-right text-[13px] text-slate-600">
                    {row.lastVisitLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {vipList.length > visible.length && (
            <p className="mt-2 text-[11px] text-slate-500">
              Showing {visible.length} of {Math.min(20, vipList.length)} top
              VIPs.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
