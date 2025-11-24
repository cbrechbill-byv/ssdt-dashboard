"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/fan-wall", label: "Fan Wall" },
  { href: "/notifications", label: "Notifications" },
  { href: "/artists", label: "Artists" },
  { href: "/events", label: "Events" },
];

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function DashboardShell({
  title,
  subtitle,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Top bar with title + nav */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
            )}
          </div>
          <nav className="flex items-center gap-1 text-xs">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");

              const baseClasses =
                "rounded-full px-3 py-1.5 border transition shadow-sm";
              const activeClasses =
                "bg-amber-400 text-slate-950 border-amber-300";
              const inactiveClasses =
                "border-slate-700 text-slate-200 hover:bg-slate-800/60";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    baseClasses +
                    " " +
                    (isActive ? activeClasses : inactiveClasses)
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
    </div>
  );
}
