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
  | "rewards"
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
  { key: "rewards", label: "Rewards menu", href: "/rewards" },
  { key: "feedback", label: "Feedback", href: "/feedback" },
  { key: "notifications", label: "Notifications", href: "/notifications" },
  { key: "activity", label: "Activity log", href: "/activity-log" },
];

type SubMenuItem = {
  label: string;
  href: string;
  description?: string;
};

const subMenus: Partial<Record<DashboardTab, SubMenuItem[]>> = {
  dashboard: [
    {
      label: "Tonight board",
      href: "/dashboard/tonight",
      description: "Tonight view for the in-venue screen.",
    },
  ],
  rewards: [
    {
      label: "VIP Users",
      href: "/rewards/vips",
      description: "See all VIPs, points, and visits.",
    },
    {
      label: "VIP Overview",
      href: "/rewards/overview",
      description: "High-level stats across all VIPs.",
    },
    {
      label: "Staff Codes",
      href: "/rewards/staff-codes",
      description: "Manage staff PINs for redemptions.",
    },
  ],
  notifications: [
    {
      label: "Analytics",
      href: "/notifications/analytics",
      description: "Delivery stats and platform breakdown.",
    },
  ],
};

export default function DashboardShell({
  title,
  subtitle,
  activeTab,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, role } = useDashboardUser();

  const [openMenu, setOpenMenu] = React.useState<DashboardTab | null>(null);

  function isTabActive(tab: (typeof tabs)[number]) {
    return activeTab === tab.key || (pathname ?? "").startsWith(tab.href);
  }

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (error) {
      console.error("[DashboardShell] Logout error:", error);
    } finally {
      router.push("/login");
    }
  }

  function handleMenuTabClick(tabKey: DashboardTab, href: string) {
    // Mobile + click behavior:
    // - First click: open submenu
    // - Second click (while open): navigate to main tab page
    if (openMenu === tabKey) {
      setOpenMenu(null);
      router.push(href);
    } else {
      setOpenMenu(tabKey);
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

          {/* Navigation pills with dropdown submenus */}
          <nav className="flex flex-wrap gap-1.5 text-xs">
            {tabs.map((tab) => {
              const isActive = isTabActive(tab);
              const menuItems = subMenus[tab.key];
              const hasMenu = !!menuItems && menuItems.length > 0;

              const baseClasses =
                "inline-flex items-center rounded-full border px-3 py-1 transition-colors";
              const activeClasses =
                "border-amber-400 bg-amber-400 text-slate-900 shadow-sm";
              const inactiveClasses =
                "border-slate-200 bg-white text-slate-600 hover:bg-amber-50 hover:border-amber-200";

              // Tabs without submenu: simple pill that links directly
              if (!hasMenu) {
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
              }

              // Tabs with submenu: traditional dropdown
              const isMenuOpen = openMenu === tab.key;

              return (
                <div
                  key={tab.key}
                  className="relative inline-block"
                >
                  <button
                    type="button"
                    onMouseEnter={() => setOpenMenu(tab.key)}
                    onClick={() => handleMenuTabClick(tab.key, tab.href)}
                    className={`${baseClasses} ${
                      isActive ? activeClasses : inactiveClasses
                    } flex items-center gap-1`}
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[9px] opacity-80">▾</span>
                  </button>

                  {isMenuOpen && (
                    <div
                      className="absolute left-0 top-full z-20 mt-1 min-w-[14rem] rounded-2xl border border-slate-200 bg-white py-1 shadow-lg"
                      onMouseEnter={() => setOpenMenu(tab.key)}
                      onMouseLeave={() => setOpenMenu(null)}
                    >
                      {menuItems!.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenMenu(null)}
                          className="block px-3 py-1.5 text-[11px] text-slate-700 hover:bg-amber-50"
                        >
                          <div className="font-medium">{item.label}</div>
                          {item.description && (
                            <div className="text-[10px] text-slate-500">
                              {item.description}
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
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
