"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

// Simple className joiner so we don't depend on '@/lib/utils'
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type DashboardTabKey =
  | "overview"
  | "artists"
  | "fanwall"
  | "photo-booth"
  | "sponsors"
  | "feedback"
  | "bar-bites";

type DashboardTab = {
  key: DashboardTabKey;
  label: string;
  href: string;
};

const TABS: DashboardTab[] = [
  {
    key: "overview",
    label: "Overview",
    href: "/",
  },
  {
    key: "artists",
    label: "Artists",
    href: "/artists",
  },
  {
    key: "fanwall",
    label: "Fan Wall",
    href: "/fanwall",
  },
  {
    key: "photo-booth",
    label: "Photo Booth",
    href: "/photo-booth/frames",
  },
  {
    key: "sponsors",
    label: "Sponsors",
    href: "/photo-booth/sponsors",
  },
  {
    key: "feedback",
    label: "Feedback",
    href: "/feedback",
  },
  {
    key: "bar-bites",
    label: "Bar & Bites",
    href: "/bar-bites",
  },
];

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  activeTab?: DashboardTabKey;
  children: React.ReactNode;
}

export default function DashboardShell({
  title,
  subtitle,
  activeTab,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();

  const currentTab =
    activeTab ||
    (TABS.find((tab) => pathname === tab.href || pathname?.startsWith(tab.href))?.key ??
      "overview");

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-600">
                {subtitle}
              </p>
            )}
          </div>

          <nav className="flex flex-wrap gap-1 rounded-full bg-slate-100 p-1 text-sm">
            {TABS.map((tab) => {
              const isActive = currentTab === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 transition-colors",
                    "text-xs sm:text-sm",
                    isActive
                      ? "bg-slate-900 text-slate-50 shadow-sm"
                      : "text-slate-600 hover:bg-white"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-1 flex-col px-4 py-6">
        {children}
      </main>
    </div>
  );
}
