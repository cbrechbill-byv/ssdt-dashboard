import React from "react";
import Link from "next/link";
import Image from "next/image";

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  activeNav?: "dashboard" | "fan-wall";
  children: React.ReactNode;
};

const navItems: { key: "dashboard" | "fan-wall"; href: string; label: string }[] = [
  { key: "dashboard", href: "/dashboard", label: "VIP & Rewards" },
  { key: "fan-wall", href: "/fan-wall", label: "Fan Wall" },
];

export const DashboardShell: React.FC<DashboardShellProps> = ({
  title,
  subtitle,
  activeNav = "dashboard",
  children,
}) => {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Top header - clean, solid color */}
      <header className="border-b border-slate-300 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          {/* Logo - no circle, larger */}
          <div className="flex-shrink-0">
            <Image
              src="/ssdt-logo.png"
              alt="Sugarshack Downtown"
              width={180}
              height={80}
              className="object-contain"
              priority
            />
          </div>

          <div className="flex flex-col">
            <h1 className="text-xl font-semibold tracking-tight text-slate-800">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-slate-500">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="mx-auto max-w-6xl px-4 pb-3">
          <nav className="flex gap-2 text-sm">
            {navItems.map((item) => {
              const isActive = item.key === activeNav;
              const isFanWall = item.key === "fan-wall";

              const activeClasses = isFanWall
                ? "bg-amber-100 text-amber-900 border-amber-300"
                : "bg-slate-800 text-white border-slate-800";

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={[
                    "inline-flex items-center rounded-full px-4 py-1.5 border transition",
                    isActive
                      ? activeClasses
                      : "border-slate-300 text-slate-700 hover:bg-slate-200",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-3xl bg-white shadow-lg border border-slate-200 px-5 py-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardShell;
