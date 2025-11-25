"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

type PrimaryAction = {
  label: string;
  href: string;
};

type DashboardShellProps = {
  title?: string;
  subtitle?: string;
  activeTab?: "dashboard" | "fan-wall" | "notifications" | "artists" | "events";
  primaryAction?: PrimaryAction;
  children: React.ReactNode;
};

const navItems: {
  key: DashboardShellProps["activeTab"];
  label: string;
  href: string;
}[] = [
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
  const pathname = usePathname();

  const resolvedActive =
    activeTab ||
    (navItems.find((item) =>
      pathname?.startsWith(item.href.replace("/dashboard", "/"))
    )?.key ?? "dashboard");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Logo + title */}
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0">
              {/* Bigger logo, no extra green title text */}
              <Image
                src="/ssdt-logo.png"
                alt="Sugarshack Downtown"
                fill
                className="rounded-lg object-contain"
                priority
              />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                Sugarshack Downtown
              </div>
              <div className="text-sm font-semibold text-slate-50">
                VIP Dashboard
              </div>
              <div className="text-[11px] text-slate-400">
                Check-ins, VIP activity, and fan content at a glance.
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex gap-2">
            {navItems.map((item) => {
              const isActive = item.key === resolvedActive;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "rounded-full px-4 py-1.5 text-xs font-semibold",
                    "border transition-colors",
                    isActive
                      ? "bg-amber-400 text-slate-950 border-amber-300 shadow-sm"
                      : "bg-slate-900 text-slate-100 border-slate-700 hover:bg-slate-800",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Page header */}
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
        {(title || subtitle || primaryAction) && (
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <div>
              {title && (
                <h1 className="text-lg font-semibold text-slate-50">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
              )}
            </div>
            {primaryAction && (
              <Link
                href={primaryAction.href}
                className="inline-flex items-center rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-sm hover:bg-amber-500"
              >
                {primaryAction.label}
              </Link>
            )}
          </div>
        )}

        {/* Content */}
        <div className="pb-8">{children}</div>
      </main>
    </div>
  );
}
