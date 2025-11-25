import Link from "next/link";
import clsx from "clsx";

type DashboardTabId =
  | "dashboard"
  | "artists"
  | "events"
  | "fan-wall"
  | "notifications";

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  /** Which top-nav pill should be highlighted */
  activeTab?: DashboardTabId;
  children: React.ReactNode;
};

const NAV_TABS: { id: DashboardTabId; label: string; href: string }[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "artists", label: "Artists", href: "/artists" },
  { id: "events", label: "Events", href: "/events" },
  { id: "fan-wall", label: "Fan wall", href: "/fan-wall" },
  { id: "notifications", label: "Notifications", href: "/notifications" },
];

export default function DashboardShell({
  title,
  subtitle,
  activeTab = "dashboard",
  children,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo + brand */}
          <div className="flex items-center gap-3">
            {/* Bigger, cleaner logo */}
            <img
              src="/ssdt-logo.png"
              alt="Sugarshack Downtown logo"
              className="h-12 w-auto md:h-14 rounded-xl"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-[0.18em] uppercase text-amber-600">
                Sugarshack Downtown
              </span>
              <span className="text-sm md:text-base font-medium text-slate-800">
                VIP Dashboard
              </span>
            </div>
          </div>

          {/* Top nav pills */}
          <nav className="flex flex-wrap gap-1.5">
            {NAV_TABS.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-xs md:text-sm font-medium border transition-colors",
                  activeTab === tab.id
                    ? "bg-amber-500 text-slate-900 border-amber-500 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm md:text-base text-slate-600">
              {subtitle}
            </p>
          )}
        </header>

        {children}
      </main>
    </div>
  );
}
