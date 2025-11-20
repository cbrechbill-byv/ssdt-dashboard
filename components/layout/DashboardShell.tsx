"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface DashboardShellProps {
  title: string;`n  subtitle?: string;
  children: React.ReactNode;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  title,
  children,
}) => {
  const pathname = usePathname();
  const router = useRouter();

  const isVipTab = pathname === "/dashboard" || pathname === "/";
  const isFanWallTab = pathname.startsWith("/fan-wall");

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (err) {
      // ignore errors, we just want the cookie gone
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top header */}
      <header className="bg-gradient-to-r from-emerald-200 via-lime-200 to-amber-200 border-b border-amber-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center overflow-hidden shadow-md">
              <Image
                src="/ssdt-logo.png"
                alt="Sugarshack Downtown"
                width={64}
                height={64}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                Sugarshack Downtown VIP Dashboard
              </h1>
              <p className="text-[11px] text-slate-600">
                Check-ins, VIP activity, and fan content at a glance.
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="text-xs font-medium rounded-full border border-slate-700 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800"
          >
            Log out
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 pb-3">
          <div className="inline-flex rounded-full bg-white/70 p-1 shadow-sm">
            <Link
              href="/dashboard"
              className={`px-4 py-1.5 text-xs font-medium rounded-full ${
                isVipTab
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              VIP &amp; Rewards
            </Link>
            <Link
              href="/fan-wall"
              className={`px-4 py-1.5 text-xs font-medium rounded-full ${
                isFanWallTab
                  ? "bg-amber-400 text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Fan Wall
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">{title}</h2>
        {children}
      </main>
    </div>
  );
};
