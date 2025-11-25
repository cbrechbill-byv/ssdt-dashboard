import Link from "next/link";
import clsx from "clsx";

type DashboardTabId =
  | "dashboard"
  | "artists"
  | "events"
  | "fan-wall"
  | "notifications";

export type DashboardShellProps = {
  title: string;
  subtitle?: string;
  activeTab: DashboardTabId;
  children: React.ReactNode;
};

const TABS: { id: DashboardTabId; label: string; href: string }[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "artists", label: "Artists", href: "/artists" },
  { id: "events", label: "Events", href: "/events" },
  { id: "fan-wall", label: "Fan Wall", href: "/fan-wall" },
  { id: "notifications", label: "Notifications", href: "/notifications" },
];

export default function DashboardShell({
  title,
  subtitle,
  activeTab,
  children,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Top header bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Logo – keep square, no skew */}
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-slate-900">
              <img
                src="/ssdt-logo.png"
                alt="Sugarshack Downtown"
                className="h-9 w-9 object-contain"
              />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500">
                Sugarshack Downtown
              </p>
              <p className="text-sm font-semibold text-slate-900">
                VIP Dashboard
              </p>
            </div>
          </div>

          {/* Top nav pills */}
          <nav className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
            {TABS.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={clsx(
                  "px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors",
                  activeTab === tab.id
                    ? "bg-amber-400 border-amber-400 text-slate-900 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-amber-50"
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Page header + content */}
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}
        </div>

        {children}
      </main>
    </div>
  );
}
