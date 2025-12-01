"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useDashboardUser } from "@/lib/useDashboardUser";

type DashboardTab =
  | "dashboard"
  | "artists"
  | "events"
  | "fan-wall"
  | "photo-booth"
  | "sponsors"
  | "bar-bites"
  | "feedback"
  | "notifications"
  | "activity";

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  activeTab: DashboardTab;
  children: React.ReactNode;
}

const tabs: { key: DashboardTab; label: string; href: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "artists", label: "Artists", href: "/artists" },
  { key: "events", label: "Events", href: "/events" },
  { key: "fan-wall", label: "Fan wall", href: "/fan-wall" },
  { key: "photo-booth", label: "Photo booth", href: "/photo-booth/frames" },
  { key: "sponsors", label: "Sponsors", href: "/photo-booth/sponsors" },
  { key: "bar-bites", label: "Bar & Bites", href: "/menu/bar-bites" },
  { key: "feedback", label: "Feedback", href: "/feedback" },
  { key: "notifications", label: "Notifications", href: "/notifications" },
  { key: "activity", label: "Activity log", href: "/activity-log" },
];

export default function DashboardShell({
  title,
  subtitle,
  activeTab,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, role } = useDashboardUser();

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (error) {
      console.error("[DashboardShell] Logout error:", error);
    } finally {
      router.push("/login");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          {/* Top row: logo, title, user, logout */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/dashboard"
                className="flex items-center rounded-full bg-black px-3 py-1.5 shadow-sm hover:bg-slate-900"
              >
                <Image
                  src="/ssdt-logo.png"
                  alt="Sugarshack Downtown"
                  width={200}
                  height={64}
                  priority
                  className="h-10 w-auto sm:h-12 md:h-14"
                />
              </Link>
              <div className="flex flex-col">
                <h1 className="text-sm font-semibold text-slate-900 sm:text-base">
                  Sugarshack Downtown VIP Dashboard
                </h1>
                <p className="text-[11px] text-slate-500 sm:text-xs">
                  {title}
                  {subtitle ? ` · ${subtitle}` : null}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Current user info */}
              <div className="hidden text-right sm:block">
                {loading && (
                  <p className="text-[11px] text-slate-400">
                    Checking session…
                  </p>
                )}
                {!loading && user && (
                  <>
                    <p className="text-xs font-medium text-slate-800">
                      {user.email}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-emerald-600">
                      {role === "admin" ? "Admin" : role ?? ""}
                    </p>
                  </>
                )}
                {!loading && !user && (
                  <p className="text-[11px] text-red-500">Not signed in</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-amber-300 hover:bg-amber-50"
              >
                Log out
              </button>
            </div>
          </div>

          {/* Navigation pills */}
          <nav className="flex flex-wrap gap-1.5 text-xs">
            {tabs.map((tab) => {
              const isActive =
                activeTab === tab.key || pathname?.startsWith(tab.href);

              const baseClasses =
                "inline-flex items-center rounded-full border px-3 py-1 transition-colors";
              const activeClasses =
                "border-amber-400 bg-amber-400 text-slate-900 shadow-sm";
              const inactiveClasses =
                "border-slate-200 bg-white text-slate-600 hover:bg-amber-50 hover:border-amber-200";

              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={`${baseClasses} ${
                    isActive ? activeClasses : inactiveClasses
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
