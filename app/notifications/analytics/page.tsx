// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\notifications\analytics\page.tsx
// app/notifications/analytics/page.tsx
// Path: /notifications/analytics
// Sugarshack Downtown - Push Notification & Device Analytics
//
// ✅ Improvements (safe + minimal UI change):
// - Uses generated phone10 columns on BOTH tables (vip_devices.phone10 and rewards_users.phone10)
// - Avoids huge `.in(phoneVariants)` query
// - KPI cards: matched VIP devices + guest devices (incl missing phone10)
// - ET-aware relative time formatting
// - Small table badges for scannability (VIP/Guest + platform)

import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

type VipUserMini = {
  user_id: string;
  phone: string | null;
  phone10: string | null;
  full_name?: string | null;
  display_name?: string | null;
};

type DeviceRow = {
  id: string;
  phone: string | null;
  phone10: string | null;
  expo_push_token: string;
  platform: string | null;
  last_seen_at: string;
  created_at: string | null;
};

function digitsOnly(input: string) {
  return (input || "").replace(/\D/g, "");
}

// Fallback for older rows where phone10 might be null (or if the column isn't populated yet)
function phone10Fallback(input: string | null): string | null {
  if (!input) return null;
  const d = digitsOnly(input);
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  if (d.length === 10) return d;
  if (d.length > 10) return d.slice(-10);
  return null;
}

function formatRelativeTimeEt(iso: string | null): string {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";

  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffDays > 30) {
    return d.toLocaleDateString("en-US", {
      timeZone: ET_TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (diffDays >= 1) return `${diffDays}d ago`;
  if (diffHrs >= 1) return `${diffHrs}h ago`;
  if (diffMin >= 1) return `${diffMin}m ago`;
  return "Just now";
}

function formatPlatform(raw: string | null): string {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("ios")) return "iOS";
  if (value.includes("android")) return "Android";
  if (value.trim() === "") return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatVipName(vip: VipUserMini | null): string {
  if (!vip) return "Guest device";
  const full = (vip.full_name ?? "").trim() || (vip.display_name ?? "").trim();
  return full || "VIP (no name)";
}

function displayPhone10OrDash(p10: string | null): string {
  return p10 && p10.trim().length ? p10 : "—";
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "emerald" | "amber" | "rose";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : tone === "rose"
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-200 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

export default async function NotificationAnalyticsPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/login");

  const supabase = supabaseServer;

  // --- 1) Load all devices (totals + platform breakdown + recent list) ----
  const { data: allDevicesRaw, error: allDevicesError } = await supabase
    .from("vip_devices")
    .select("id, platform, phone, phone10, expo_push_token, last_seen_at, created_at");

  if (allDevicesError) {
    console.error("[notifications analytics] allDevices error", allDevicesError);
  }

  const allDevices: DeviceRow[] = (allDevicesRaw ?? []) as DeviceRow[];
  const total = allDevices.length;

  // --- 2) Load rewards_users once; match locally by phone10 (generated) ---
  const { data: usersRaw, error: usersErr } = await supabase
    .from("rewards_users")
    .select("user_id, phone, phone10, full_name, display_name");

  if (usersErr) {
    console.error("[notifications analytics] rewards_users load error", usersErr);
  }

  const usersByPhone10 = new Map<string, VipUserMini>();
  for (const u of (usersRaw ?? []) as any[]) {
    const p10 = (u.phone10 as string | null) ?? phone10Fallback(u.phone ?? null);
    if (!p10) continue;
    if (!usersByPhone10.has(p10)) {
      usersByPhone10.set(p10, {
        user_id: u.user_id,
        phone: u.phone ?? null,
        phone10: p10,
        full_name: u.full_name ?? null,
        display_name: u.display_name ?? null,
      });
    }
  }

  // --- 3) Platform counts + VIP/Guest counts (JS aggregation) ------------
  let iosCount = 0;
  let androidCount = 0;
  let otherCount = 0;

  let vipMatchedDevices = 0;
  let guestDevices = 0;

  let missingPhone10 = 0;
  let hasPhone10 = 0;

  for (const d of allDevices) {
    const p = (d.platform ?? "").toLowerCase();
    if (p.includes("ios")) iosCount++;
    else if (p.includes("android")) androidCount++;
    else otherCount++;

    const p10 = d.phone10 ?? phone10Fallback(d.phone);
    if (p10) hasPhone10++;
    else missingPhone10++;

    const vip = p10 ? usersByPhone10.get(p10) ?? null : null;
    if (vip) vipMatchedDevices++;
    else guestDevices++;
  }

  // --- 4) Recent activity window (7 days, ET-consistent) -----------------
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const activeLast7Days = allDevices.filter((d) => {
    if (!d.last_seen_at) return false;
    const last = new Date(d.last_seen_at).getTime();
    return !Number.isNaN(last) && last >= sevenDaysAgo.getTime();
  }).length;

  const newDevicesLast7Days = allDevices.filter((d) => {
    if (!d.created_at) return false;
    const created = new Date(d.created_at).getTime();
    return !Number.isNaN(created) && created >= sevenDaysAgo.getTime();
  }).length;

  // --- 5) Recent devices list (sort & slice) -----------------------------
  const recentDevices = [...allDevices]
    .sort((a, b) => {
      const aTime = new Date(a.last_seen_at).getTime();
      const bTime = new Date(b.last_seen_at).getTime();
      return bTime - aTime;
    })
    .slice(0, 50);

  const iosPercent = total > 0 ? (iosCount / total) * 100 : 0;
  const androidPercent = total > 0 ? (androidCount / total) * 100 : 0;
  const otherPercent = total > 0 ? (otherCount / total) * 100 : 0;

  return (
    <DashboardShell
      activeTab="notifications"
      title="Notification analytics"
      subtitle="Understand how many devices you can reach, which platforms they’re on, and how recently guests have opened the app."
    >
      <div className="space-y-6">
        {/* Top summary cards */}
        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Registered devices"
            helper="Devices that can receive push notifications."
            value={total}
          />
          <SummaryCard
            label="Active (last 7 days)"
            helper="Devices seen in the last week."
            value={activeLast7Days}
          />
          <SummaryCard
            label="VIP matched devices"
            helper="Devices linked to a rewards user by phone10."
            value={vipMatchedDevices}
          />
          <SummaryCard
            label="Guest devices"
            helper="Not linked to a rewards user yet (including missing phone10)."
            value={guestDevices}
          />
        </section>

        {/* Small helper row (keeps UI minimal, adds clarity) */}
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-3 text-xs text-slate-600 shadow-sm">
          Phone coverage:{" "}
          <span className="font-semibold text-slate-800">{hasPhone10}</span> with phone10 ·{" "}
          <span className="font-semibold text-slate-800">{missingPhone10}</span> missing phone10 ·{" "}
          New this week:{" "}
          <span className="font-semibold text-slate-800">{newDevicesLast7Days}</span>
        </div>

        {/* Platform breakdown */}
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Platform breakdown
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Helps you understand where your push notifications are landing.
              </p>
            </div>
            <div className="text-[11px] text-slate-500">
              New this week:{" "}
              <span className="font-semibold text-slate-700">{newDevicesLast7Days}</span>
            </div>
          </div>

          {total === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No devices registered yet. As guests opt into notifications from the app, they will appear here.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3 text-xs">
              <PlatformCard
                label="iOS devices"
                count={iosCount}
                percent={iosPercent}
                helper="iPhone / iPad devices that accepted notifications."
              />
              <PlatformCard
                label="Android devices"
                count={androidCount}
                percent={androidPercent}
                helper="Android devices that accepted notifications."
              />
              <PlatformCard
                label="Other / unknown"
                count={otherCount}
                percent={otherPercent}
                helper="Unspecified platform or legacy values."
              />
            </div>
          )}
        </section>

        {/* Recent devices list */}
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Recent device activity
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Last 50 devices by last seen time. Guest devices are normal when users haven’t provided a phone number yet.
              </p>
            </div>
            {recentDevices.length > 0 && (
              <p className="text-[11px] text-slate-500">
                Showing {recentDevices.length} most recent devices
              </p>
            )}
          </div>

          {recentDevices.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No devices have registered yet. Once guests accept push notifications from the app, you&apos;ll see them here.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3 text-left font-semibold">Status</th>
                    <th className="py-2 pr-3 text-left font-semibold">VIP name</th>
                    <th className="py-2 pr-3 text-left font-semibold">Phone</th>
                    <th className="py-2 pr-3 text-left font-semibold">Platform</th>
                    <th className="py-2 pr-3 text-left font-semibold">Last seen</th>
                    <th className="py-2 pr-3 text-left font-semibold">Registered</th>
                    <th className="py-2 pr-3 text-left font-semibold">Token</th>
                  </tr>
                </thead>

                <tbody>
                  {recentDevices.map((d) => {
                    const platformLabel = formatPlatform(d.platform);

                    const p10 = d.phone10 ?? phone10Fallback(d.phone);
                    const vip = p10 ? usersByPhone10.get(p10) ?? null : null;

                    const vipName = formatVipName(vip);
                    const phoneLabel = displayPhone10OrDash(p10);

                    const insightsHref = vip?.user_id ? `/rewards/vips/${vip.user_id}/insights` : null;

                    return (
                      <tr key={d.id} className="border-b border-slate-50 last:border-0 align-top">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {vip ? (
                            <Badge tone="emerald">VIP</Badge>
                          ) : (
                            <Badge tone="amber">GUEST</Badge>
                          )}
                        </td>

                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {insightsHref ? (
                            <Link href={insightsHref} className="hover:underline" title="Open VIP insights">
                              {vipName}
                            </Link>
                          ) : (
                            vipName
                          )}
                        </td>

                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {insightsHref && p10 ? (
                            <Link href={insightsHref} className="hover:underline" title="Open VIP insights">
                              {phoneLabel}
                            </Link>
                          ) : (
                            phoneLabel
                          )}
                        </td>

                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          <Badge
                            tone={
                              platformLabel === "iOS"
                                ? "amber"
                                : platformLabel === "Android"
                                ? "slate"
                                : "rose"
                            }
                          >
                            {platformLabel}
                          </Badge>
                        </td>

                        <td className="py-2 pr-3 text-[11px] text-slate-700 whitespace-nowrap">
                          {formatRelativeTimeEt(d.last_seen_at)}
                        </td>

                        <td className="py-2 pr-3 text-[11px] text-slate-600 whitespace-nowrap">
                          {d.created_at ? formatRelativeTimeEt(d.created_at) : "Unknown"}
                        </td>

                        <td className="py-2 pr-3 text-[11px] text-slate-500 max-w-xs truncate">
                          <span title={d.expo_push_token}>{d.expo_push_token}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p className="mt-3 text-[11px] text-slate-400">
                Tip: Guest devices are normal (no phone yet). Once a guest logs in / becomes VIP, their device will start matching by phone10.
              </p>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

// --- Presentational helpers --------------------------------------------------

type SummaryCardProps = {
  label: string;
  helper: string;
  value: string | number;
};

function SummaryCard({ label, helper, value }: SummaryCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function PlatformCard({
  label,
  count,
  percent,
  helper,
}: {
  label: string;
  count: number;
  percent: number;
  helper: string;
}) {
  const clamped = Number.isFinite(percent) && percent > 0 ? Math.min(100, percent) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-slate-900">
        {count}{" "}
        <span className="ml-1 text-[11px] font-normal text-slate-500">
          ({clamped.toFixed(0)}%)
        </span>
      </p>
      <p className="mt-1 text-[11px] text-slate-600">{helper}</p>
      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full bg-amber-400 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
