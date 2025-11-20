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
      // ignore – we just want to leave the dashboard
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="relative h-10 sm:h-12 md:h-14 w-auto">
              <Image
                src="/ssdt-logo.png"
                alt="Sugarshack Downtown"
                width={220}
                height={64}
                className="h-full w-auto object-contain"
                priority
              />
            </div>

            {/* Title / subtitle */}
            <div className="hidden sm:flex flex-col">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                Staff dashboard
              </span>
              <span className="text-sm font-semibold text-slate-900 leading-tight">
                {title}
              </span>
              <span className="text-[11px] text-slate-500">
                {subtitle}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Log out
          </button>
        </div>

        <div className="max-w-6xl mx-auto px-4 pb-3">
          <nav className="inline-flex rounded-full bg-slate-100 p-1 border border-slate-200 shadow-sm text-xs font-medium">
            <Link
              href="/dashboard"
              className={`px-4 py-1.5 rounded-full transition-colors ${
                isVipTab
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              VIP Dashboard
            </Link>
            <Link
              href="/fan-wall"
              className={`px-4 py-1.5 rounded-full transition-colors ${
                isFanWallTab
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Fan Wall
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
};
