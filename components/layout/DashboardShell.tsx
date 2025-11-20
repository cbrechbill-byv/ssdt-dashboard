"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  children,
  title = "VIP & Rewards overview",
  subtitle = "Check-ins, VIP activity, and fan content at a glance.",
}) => {
  const pathname = usePathname();
  const router = useRouter();

  const isVipTab = pathname === "/dashboard" || pathname === "/";
  const isFanWallTab = pathname.startsWith("/fan-wall");

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (_err) {
      // ignore errors, we just want the cookie gone
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo + title */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="relative w-40 h-10 sm:w-52 sm:h-12">
              <Image
                src="/ssdt-logo.png"
                alt="Sugarshack Downtown"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Staff dashboard
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {title}
              </span>
              <span className="text-[11px] text-slate-500">
                {subtitle}
              </span>
            </div>
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-slate-900 text-white shadow-sm hover:bg-slate-800"
          >
            Log out
          </button>
        </div>

        {/* Tabs */}
        <div className="border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-4 py-2">
            <div className="inline-flex rounded-full bg-slate-100 p-1 border border-slate-200">
              <Link
                href="/dashboard"
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  isVipTab
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                VIP Dashboard
              </Link>
              <Link
                href="/fan-wall"
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  isFanWallTab
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Fan Wall
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
};
