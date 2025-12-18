// app/notifications/analytics/page.tsx
// Path: /notifications/analytics
// Sugarshack Downtown - Push Notification & Device Analytics
// Uses vip_devices to show device counts, platform breakdown, and recent activity.
//
// Update (minimal UI change):
// - VIP name is pulled from rewards_users by phone match (vip_devices.phone -> rewards_users.phone)
// - VIP name is clickable -> /rewards/vips/{user_id}/insights
// - Phone displays as 10 digits (no +1)
// - Phone is also clickable -> /rewards/vips/{user_id}/insights

import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type VipUserMini = {
  user_id: string;
  phone: string | null;
  full_name?: string | null;
  display_name?: string | null;
} | null;

type DeviceRow = {
  id: string;
  phone: string | null;
  expo_push_token: string;
  platform: string | null;
  last_seen_at: string;
  created_at: string | null;
};

function digitsOnly(input: string) {
  return (input || "").replace(/\D/g, "");
}

function phone10(input: string | null): string | null {
  if (!input) return null;
  const d = digitsOnly(input);
  // +1########## or 1##########
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  if (d.length === 10) return d;
  // best-effort (last 10 digits)
  if (d.length > 10) return d.slice(-10);
  return null;
}

function expandPhoneVariants(raw: string): string[] {
  const v = new Set<string>();
  v.add(raw);

  const d10 = phone10(raw);
  if (d10) {
    v.add(d10); // ##########
    v.add("1" + d10); // 1##########
    v.add("+1" + d10); // +1##########
  }

  return Array.from(v);
}

function formatRelativeTime(iso: string | null): string {
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

function formatVipName(vip: VipUserMini): string {
  if (!vip) return "Unknown";
  const full =
    (vip.full_name ?? "").trim() || (vip.display_name ?? "").trim();
  return full || "Unknown";
}

export default async function NotificationAnalyticsPage() {
  const session = await getDashboardSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = supabaseServer;

  // --- 1) Load all devices (for totals + platform breakdown) -------------
  const { data: allDevicesRaw, error: allDevicesError } = await supabase
    .from("vip_devices")
    .select(
      `
      id,
      platform,
      phone,
      expo_push_token,
      last_seen_at,
      created_at
    `
    );

  if (allDevicesError) {
    console.error(
      "[notifications analytics] allDevices error",
      allDevicesError
    );
  }

  const allDevices: DeviceRow[] = (allDevicesRaw ?? []) as DeviceRow[];
  const total = allDevices.length;

  // --- 1b) Build VIP lookup by phone (rewards_users) ---------------------
  const phoneVariantsSet = new Set<string>();
  for (const d of allDevices) {
    if (d.phone) {
      expandPhoneVariants(d.phone).forEach((p) => phoneVariantsSet.add(p));
    }
  }

  const phoneVariants = Array.from(phoneVariantsSet);

  const { data: usersRaw, error: usersErr } = phoneVariants.length
    ? await supabase
        .from("rewards_users")
        .select("user_id, phone, full_name, display_name")
        .in("phone", phoneVariants)
    : { data: [], error: null as any };

  if (usersErr) {
    console.error("[notifications analytics] rewards_users lookup error", usersErr);
  }

  // Map by normalized 10-digit phone
  const usersByPhone10 = new Map<string, Exclude<VipUserMini, null>>();
  for (const u of (usersRaw ?? []) as any[]) {
    const p10 = phone10(u.phone ?? null);
    if (!p10) continue;
    if (!usersByPhone10.has(p10)) {
      usersByPhone10.set(p10, {
        user_id: u.user_id,
        phone: u.phone ?? null,
        full_name: u.full_name ?? null,
        display_name: u.display_name ?? null,
      });
    }
  }

  // Platform counts (JS aggregation instead of SQL GROUP BY)
  let iosCount = 0;
  let androidCount = 0;
  let otherCount = 0;

  for (const d of allDevices) {
    const p = (d.platform ?? "").toLowerCase();
    if (p.includes("ios")) iosCount++;
    else if (p.includes("android")) androidCount++;
    else otherCount++;
  }

  // --- 2) Recent activity (7 days) --------------------------------------
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

  // --- 3) Recent devices list (reuse allDevices, just sort & slice) ------
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
            helper="VIP devices that can receive push notifications."
            value={total}
          />
          <SummaryCard
            label="Active (last 7 days)"
            helper="Devices seen in the last week."
            value={activeLast7Days}
          />
          <SummaryCard
            label="New this week"
            helper="New VIP devices created in the last 7 days."
            value={newDevicesLast7Days}
          />
          <SummaryCard
            label="iOS vs Android"
            helper="Based on vip_devices.platform."
            value={`${iosCount} iOS / ${androidCount} Android`}
          />
        </section>

        {/* Platform breakdown */}
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Platform breakdown
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Helps you understand where your push notifications are landing.
          </p>

          {total === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No devices registered yet. As guests opt into notifications in the
              app, they will appear here.
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
                Last 50 devices by last seen time. Use this to spot stale
                devices or confirm that VIP devices are checking in regularly.
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
              No devices have registered yet. Once guests accept push
              notifications from the app, you&apos;ll see them here.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3 text-left font-semibold">
                      VIP name
                    </th>

                    <th className="py-2 pr-3 text-left font-semibold">
                      Phone
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Platform
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Last seen
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Registered
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Token
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentDevices.map((d) => {
                    const platformLabel = formatPlatform(d.platform);

                    const p10 = phone10(d.phone);
                    const vip = p10 ? usersByPhone10.get(p10) ?? null : null;

                    const vipName = formatVipName(vip);
                    const phoneLabel = p10 || "Unknown";

                    const insightsHref = vip?.user_id
                      ? `/rewards/vips/${vip.user_id}/insights`
                      : null;

                    return (
                      <tr
                        key={d.id}
                        className="border-b border-slate-50 last:border-0 align-top"
                      >
                        {/* VIP NAME (clickable if matched) */}
                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {insightsHref ? (
                            <Link
                              href={insightsHref}
                              className="hover:underline"
                              title="Open VIP user details"
                            >
                              {vipName}
                            </Link>
                          ) : (
                            vipName
                          )}
                        </td>

                        {/* PHONE (10 digits only, clickable if matched) */}
                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {insightsHref && p10 ? (
                            <Link
                              href={insightsHref}
                              className="hover:underline"
                              title="Open VIP user details"
                            >
                              {phoneLabel}
                            </Link>
                          ) : (
                            phoneLabel
                          )}
                        </td>

                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {platformLabel}
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-700 whitespace-nowrap">
                          {formatRelativeTime(d.last_seen_at)}
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-600 whitespace-nowrap">
                          {d.created_at
                            ? formatRelativeTime(d.created_at)
                            : "Unknown"}
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-500 max-w-xs truncate">
                          <span title={d.expo_push_token}>
                            {d.expo_push_token}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
  const clamped =
    Number.isFinite(percent) && percent > 0 ? Math.min(100, percent) : 0;

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
