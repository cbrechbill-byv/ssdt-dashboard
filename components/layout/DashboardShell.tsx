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
  title = "Sugarshack Downtown VIP Dashboard",
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
      {/* Top header */}
      <header className="bg-slate-950 text-white border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="relative w-44 h-12 sm:w-56 sm:h-14">
              <Image
                src="/ssdt-logo.png"
                alt="Sugarshack Downtown"
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* Title / subtitle */}
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold leading-tight">
                {title}
              </h1>
              <p className="text-[11px] text-slate-300">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="text-xs font-medium rounded-full border border-slate-600 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 shadow-sm"
          >
            Log out
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 pb-3">
          <div className="inline-flex rounded-full bg-slate-900/70 p-1 border border-slate-700 shadow-sm">
            <Link
              href="/dashboard"
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
                isVipTab
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              VIP Dashboard
            </Link>
            <Link
              href="/fan-wall"
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
                isFanWallTab
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Fan Wall
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
};
