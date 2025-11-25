"use client";

import Link from "next/link";
import Image from "next/image";
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

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export default function DashboardShell({
  title,
  subtitle,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Top bar with logo, title, and nav */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {/* Logo + title */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
              <Image
                src="/ssdt-logo.png"
                alt="Sugarshack Downtown"
                width={40}
                height={40}
                className="h-8 w-8 object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                Sugarshack Downtown
              </span>
              <span className="text-sm font-semibold text-slate-50">
                {title}
              </span>
              {subtitle && (
                <span className="mt-0.5 text-[11px] text-slate-400">
                  {subtitle}
                </span>
              )}
            </div>
          </Link>

          {/* Top nav */}
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
