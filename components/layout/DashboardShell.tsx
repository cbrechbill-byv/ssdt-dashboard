import Link from "next/link";
import Image from "next/image";
import React from "react";

type NavKey = "dashboard" | "fan-wall" | "notifications" | "artists" | "events";

type PrimaryAction = {
  label: string;
  href: string;
};

export type DashboardShellProps = {
  /** Big page title, e.g. "VIP Dashboard", "Artists", "Events" */
  title: string;
  /** Smaller subtitle under the title */
  subtitle?: string;
  /** Which nav pill should be highlighted */
  activeTab: NavKey;
  /** Optional button in the top-right of the page header */
  primaryAction?: PrimaryAction;
  children: React.ReactNode;
};

const navItems: { key: NavKey; label: string; href: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "fan-wall", label: "Fan Wall", href: "/fan-wall" },
  { key: "notifications", label: "Notifications", href: "/notifications" },
  { key: "artists", label: "Artists", href: "/artists" },
  { key: "events", label: "Events", href: "/events" },
];

export default function DashboardShell({
  title,
  subtitle,
  activeTab,
  primaryAction,
  children,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[#050816] text-slate-50">
      {/* Top header bar */}
      <header className="border-b border-slate-800 bg-[#050816]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Logo + title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <Image
                src="/ssdt-logo.png"
                alt="Sugarshack Downtown"
                width={48}
                height={48}
                className="h-12 w-12 rounded-full shadow-lg"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-300">
                  Sugarshack Downtown
                </span>
                <span className="text-xs text-slate-400">
                  Check-ins, VIP activity, and fan content at a glance.
                </span>
              </div>
            </div>
          </div>

          {/* Nav pills */}
          <nav className="flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = item.key === activeTab;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={[
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors border",
                    isActive
                      ? "bg-[#ffc800] text-black border-[#ffc800]"
                      : "bg-transparent text-slate-200 border-slate-700 hover:bg-slate-800",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            )}
          </div>

          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="rounded-full bg-[#ffc800] px-4 py-2 text-sm font-semibold text-black shadow-md hover:bg-[#e6b400] transition-colors"
            >
              {primaryAction.label}
            </Link>
          )}
        </div>

        {children}
      </main>
    </div>
  );
}
