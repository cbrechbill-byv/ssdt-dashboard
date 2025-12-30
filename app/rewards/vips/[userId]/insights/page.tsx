// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\rewards\vips\[userId]\insights\page.tsx
// app/rewards/vips/[userId]/insights/page.tsx
// VIP Insights dashboard for a single Sugarshack Downtown rewards user.
//
// ✅ Aligned to Tonight/Overview sources:
// - Balance + visits + last_scan_at come from rewards_user_overview (source of truth)
// - Points Spent comes from rewards_redemptions.points_spent (NOT negative scans)
// - Points Earned comes from positive rewards_scans.points (check-ins + manual adjustments)
// - Timeline shows scans + redemptions + fan wall + feedback (only if timestamp present)
// - All timestamps rendered in America/New_York
//
// Notes:
// - Scans are limited to last 100 rows for UI responsiveness; totals based on those 100 will be labeled.

import React from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";

export const revalidate = 0;

const ET_TZ = "America/New_York";

type VipOverviewRow = {
  user_id: string;
  phone: string | null;
  full_name: string | null;
  email: string | null;
  zip: string | null;
  is_vip: boolean | null;
  total_points: number | null;
  total_visits: number | null;
  first_scan_at: string | null;
  last_scan_at: string | null;
};

type RewardScan = {
  id: string;
  points: number;
  scanned_at: string | null;
  source: string | null;
  note: string | null;
};

type Redemption = {
  id: string;
  reward_name: string | null;
  points_spent: number | null;
  staff_label: string | null;
  staff_last4: string | null;
  created_at: string;
};

type FanWallPost = {
  id: string;
  caption: string | null;
  created_at: string;
  is_approved: boolean;
  is_hidden: boolean;
};

type FeedbackRow = {
  id: string;
  music_rating: number | null;
  food_rating: number | null;
  fun_rating: number | null;
  comment: string | null;
  anonymous: boolean;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  submitted_at: string | null;
  created_at: string | null;
};

function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return phone;
}

function phoneDigits10(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits.length ? digits : null;
}

function isValidIso(iso: string | null | undefined): iso is string {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t);
}

function formatDateTimeEt(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: ET_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDateEt(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: ET_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function averageRating(row: FeedbackRow): number | null {
  const values = [row.music_rating, row.food_rating, row.fun_rating].filter(
    (v): v is number => typeof v === "number"
  );
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode;
  helper: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

type ActivityItem =
  | {
      kind: "scan";
      id: string;
      at: string;
      label: string;
      points: number;
      source: string;
      note: string | null;
    }
  | {
      kind: "redemption";
      id: string;
      at: string;
      label: string;
      reward_name: string;
      points_spent: number;
      staff_label: string;
    }
  | {
      kind: "fan-wall";
      id: string;
      at: string;
      label: string;
      caption: string | null;
      status: string;
    }
  | {
      kind: "feedback";
      id: string;
      at: string;
      label: string;
      snippet: string | null;
      avg_rating: number | null;
    };

function VipSubnav({ userId }: { userId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/rewards/vips"
        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
      >
        ← Back to VIP users
      </Link>

      <span className="inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
        Insights
      </span>

      <Link
        href={`/rewards/vips/${userId}`}
        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
      >
        Edit profile
      </Link>
    </div>
  );
}

export default async function VipInsightsPage(props: { params: Promise<{ userId: string }> }) {
  const session = await getDashboardSession();
  if (!session) redirect("/login");

  const { userId } = await props.params;
  if (!userId) notFound();

  const supabase = supabaseServer;

  // 1) Source of truth: rewards_user_overview
  const { data: overviewRows, error: overviewError } = await supabase
    .from("rewards_user_overview")
    .select("user_id, phone, full_name, email, zip, is_vip, total_points, total_visits, first_scan_at, last_scan_at")
    .eq("user_id", userId)
    .limit(1);

  if (overviewError) console.error("[vip insights] overview error", overviewError);

  const overview: VipOverviewRow | null =
    overviewRows && overviewRows.length > 0 ? (overviewRows[0] as VipOverviewRow) : null;

  const phoneRaw = overview?.phone ?? null;
  const phone10 = phoneDigits10(phoneRaw);
  const email = overview?.email ?? null;

  // 2) Scans ledger (last 100 for UI)
  const { data: scansData, error: scansError } = await supabase
    .from("rewards_scans")
    .select("id, points, scanned_at, source, note")
    .eq("user_id", userId)
    .order("scanned_at", { ascending: false })
    .limit(100);

  if (scansError) console.error("[vip insights] scans error", scansError);

  const scans: RewardScan[] = (scansData ?? []) as RewardScan[];

  // Earned = sum of positive scans (includes dashboard_adjust positives)
  const earnedFromScans = scans.reduce((sum, s) => {
    const pts = Number(s.points ?? 0);
    return pts > 0 ? sum + pts : sum;
  }, 0);

  // 3) Redemptions (source of truth for spent)
  const { data: redemptionsData, error: redemptionsError } = await supabase
    .from("rewards_redemptions")
    .select("id, reward_name, points_spent, staff_label, staff_last4, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (redemptionsError) console.error("[vip insights] redemptions error", redemptionsError);

  const redemptions: Redemption[] = (redemptionsData ?? []) as Redemption[];

  const spentFromRedemptions = redemptions.reduce((sum, r) => {
    const spent = Number(r.points_spent ?? 0);
    return spent > 0 ? sum + spent : sum;
  }, 0);

  const ledgerNet = earnedFromScans - spentFromRedemptions;
  const currentBalance = Number(overview?.total_points ?? 0) || 0;
  const reconciliationDelta = currentBalance - ledgerNet; // non-zero => drift (often due to limits or missing history)

  const lastRedeem = redemptions.length > 0 ? redemptions[0] : null;

  // 4) Fan Wall posts
  const { data: fanWallData, error: fanWallError } = await supabase
    .from("fan_wall_posts")
    .select("id, caption, created_at, is_approved, is_hidden")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (fanWallError) console.error("[vip insights] fan wall error", fanWallError);

  const fanPosts: FanWallPost[] = (fanWallData ?? []) as FanWallPost[];

  // 5) Feedback matched by phone/email (best-effort without schema changes)
  let feedbackRows: FeedbackRow[] = [];

  const orFilters: string[] = [];
  if (email) orFilters.push(`contact_email.eq.${email}`);

  // Try multiple phone encodings (because feedback storage can vary)
  if (phoneRaw) orFilters.push(`contact_phone.eq.${phoneRaw}`);
  if (phone10) {
    orFilters.push(`contact_phone.eq.${phone10}`);
    orFilters.push(`contact_phone.eq.1${phone10}`);
    orFilters.push(`contact_phone.eq.+1${phone10}`);
  }

  if (orFilters.length > 0) {
    const { data: fbData, error: fbError } = await supabase
      .from("feedback")
      .select(
        "id, music_rating, food_rating, fun_rating, comment, anonymous, contact_name, contact_email, contact_phone, submitted_at, created_at"
      )
      .or(orFilters.join(","))
      .order("submitted_at", { ascending: false })
      .limit(50);

    if (fbError) console.error("[vip insights] feedback error", fbError);
    else feedbackRows = (fbData ?? []) as FeedbackRow[];
  }

  // 6) Unified activity list (only items with valid timestamps)
  const activities: ActivityItem[] = [];

  for (const scan of scans) {
    if (!isValidIso(scan.scanned_at)) continue;
    const pts = Number(scan.points ?? 0);
    const src = (scan.source ?? "Unknown").trim() || "Unknown";
    activities.push({
      kind: "scan",
      id: `scan-${scan.id}`,
      at: scan.scanned_at as string,
      label: pts >= 0 ? "Points added (scan/adjust)" : "Points adjustment (negative)",
      points: pts,
      source: src,
      note: scan.note ?? null,
    });
  }

  for (const red of redemptions) {
    if (!isValidIso(red.created_at)) continue;
    activities.push({
      kind: "redemption",
      id: `red-${red.id}`,
      at: red.created_at,
      label: "Reward redeemed",
      reward_name: (red.reward_name ?? "Reward").trim() || "Reward",
      points_spent: Number(red.points_spent ?? 0) || 0,
      staff_label: (red.staff_label ?? "Staff").trim() || "Staff",
    });
  }

  for (const post of fanPosts) {
    if (!isValidIso(post.created_at)) continue;
    const status = post.is_hidden ? "Hidden" : post.is_approved ? "Approved" : "Pending";
    activities.push({
      kind: "fan-wall",
      id: `fan-${post.id}`,
      at: post.created_at,
      label: "Fan Wall post",
      caption: post.caption ?? null,
      status,
    });
  }

  for (const fb of feedbackRows) {
    const at = fb.submitted_at ?? fb.created_at ?? null;
    if (!isValidIso(at)) continue;
    activities.push({
      kind: "feedback",
      id: `fb-${fb.id}`,
      at,
      label: "Feedback submitted",
      snippet: fb.comment ?? null,
      avg_rating: averageRating(fb),
    });
  }

  activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const vipName =
    overview?.full_name ||
    (overview?.phone ? formatPhone(overview.phone) : null) ||
    overview?.email ||
    "Unknown rewards user";

  const headerSubtitle = overview
    ? `${overview.phone ? formatPhone(overview.phone) : "No phone on file"}${overview.email ? ` · ${overview.email}` : ""} (Timezone: ${ET_TZ})`
    : `This rewards user has limited activity on file. (Timezone: ${ET_TZ})`;

  const visits = Number(overview?.total_visits ?? 0) || 0;
  const isVip = !!overview?.is_vip;

  const deltaTone =
    Math.abs(reconciliationDelta) <= 0 ? "text-slate-900" : Math.abs(reconciliationDelta) <= 25 ? "text-amber-700" : "text-rose-700";

  return (
    <DashboardShell title="VIP Insights" subtitle={headerSubtitle} activeTab="rewards">
      <div className="space-y-6">
        <VipSubnav userId={userId} />

        {/* Identity + core status */}
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">VIP profile</p>
              <h1 className="mt-1 truncate text-base font-semibold text-slate-900">{vipName}</h1>
              <p className="mt-1 text-xs text-slate-500">
                {isVip ? "Active VIP" : "Registered guest"}
                {overview?.zip ? ` · ZIP ${overview.zip}` : ""}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                First visit: {formatShortDateEt(overview?.first_scan_at)} · Last visit: {formatShortDateEt(overview?.last_scan_at)}
              </p>
              <p className="mt-1 text-[11px] font-mono text-slate-400">user_id: {userId}</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Current points</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{currentBalance}</p>
                <p className="text-[11px] text-slate-500">From overview</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Visits</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{visits}</p>
                <p className="text-[11px] text-slate-500">Lifetime</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Redemptions</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{redemptions.length}</p>
                <p className="text-[11px] text-slate-500">{lastRedeem ? `Last: ${(lastRedeem.reward_name ?? "Reward").trim() || "Reward"}` : "None yet"}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/rewards/vips/${userId}`}
              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit profile
            </Link>
            <Link
              href="/rewards/vips"
              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to list
            </Link>
          </div>
        </section>

        {/* Insights-only KPIs (not redundant with Tonight) */}
        <section className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Points earned (last 100 scans)"
            value={earnedFromScans}
            helper="Sum of positive rewards_scans points (includes dashboard_adjust)."
          />
          <StatCard
            label="Points spent (last 50 redeems)"
            value={spentFromRedemptions}
            helper="Sum of rewards_redemptions.points_spent (source of truth)."
          />
          <StatCard
            label="Ledger net"
            value={ledgerNet > 0 ? `+${ledgerNet}` : ledgerNet}
            helper="Earned minus spent (bounded by loaded rows)."
          />
          <StatCard
            label="Reconciliation delta"
            value={<span className={deltaTone}>{reconciliationDelta > 0 ? `+${reconciliationDelta}` : reconciliationDelta}</span>}
            helper="Current balance (overview) minus ledger net. Non-zero may indicate limited history or missing writes."
          />
        </section>

        {/* Activity + side panels */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
          {/* Activity timeline */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent activity</h2>
              <p className="text-[11px] text-slate-400">Times shown in {ET_TZ}</p>
            </div>

            {activities.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
                No activity yet for this user. Once they check in, redeem, post to the Fan Wall, or leave feedback, it will appear here.
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                {activities.slice(0, 30).map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="mt-1 h-2 w-2 rounded-full bg-slate-900 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                        <p className="text-[11px] text-slate-400">{formatDateTimeEt(item.at)}</p>
                      </div>

                      {item.kind === "scan" && (
                        <p className="mt-0.5 text-xs text-slate-600">
                          <span className="font-semibold">{item.points > 0 ? `+${item.points}` : item.points} pts</span>
                          {" · "}Source: {item.source}
                          {item.note ? ` · ${item.note}` : ""}
                        </p>
                      )}

                      {item.kind === "redemption" && (
                        <p className="mt-0.5 text-xs text-slate-600">
                          {item.reward_name} ·{" "}
                          <span className="font-semibold">-{clamp(item.points_spent, 0, 999999)} pts</span>
                          {" · "}Approved by {item.staff_label}
                        </p>
                      )}

                      {item.kind === "fan-wall" && (
                        <p className="mt-0.5 text-xs text-slate-600">
                          Status: <span className="font-semibold">{item.status}</span>
                          {item.caption ? ` · "${item.caption}"` : " · (no caption)"}
                        </p>
                      )}

                      {item.kind === "feedback" && (
                        <p className="mt-0.5 text-xs text-slate-600">
                          {item.avg_rating !== null ? (
                            <span className="mr-1.5">Avg rating: {item.avg_rating.toFixed(1)} / 5 ·</span>
                          ) : null}
                          {item.snippet
                            ? item.snippet.length > 120
                              ? `${item.snippet.slice(0, 120)}…`
                              : item.snippet
                            : "No written comment"}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Note: scans are capped at last 100; redemptions capped at last 50 for speed.
            </p>
          </div>

          {/* Right panels */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent redemptions</h2>
              {redemptions.length === 0 ? (
                <p className="text-xs text-slate-500">No rewards redeemed yet.</p>
              ) : (
                <ul className="space-y-2 text-xs text-slate-700">
                  {redemptions.slice(0, 6).map((red) => {
                    const name = (red.reward_name ?? "Reward").trim() || "Reward";
                    const spent = Number(red.points_spent ?? 0) || 0;
                    const staff = (red.staff_label ?? "Staff").trim() || "Staff";
                    return (
                      <li key={red.id} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{name}</p>
                          <p className="text-[11px] text-slate-500">{formatDateTimeEt(red.created_at)} · {staff}</p>
                        </div>
                        <span className="ml-2 rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          -{spent}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fan Wall posts</h2>
              {fanPosts.length === 0 ? (
                <p className="text-xs text-slate-500">No Fan Wall activity yet.</p>
              ) : (
                <ul className="space-y-2 text-xs text-slate-700">
                  {fanPosts.slice(0, 6).map((post) => {
                    const status = post.is_hidden ? "Hidden" : post.is_approved ? "Approved" : "Pending";
                    return (
                      <li key={post.id}>
                        <p className="font-medium text-slate-900">{post.caption || "Untitled post"}</p>
                        <p className="text-[11px] text-slate-500">{formatDateTimeEt(post.created_at)} · {status}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Feedback</h2>
              {feedbackRows.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No feedback matched yet. Matching is best-effort using email and common phone formats.
                </p>
              ) : (
                <ul className="space-y-2 text-xs text-slate-700">
                  {feedbackRows.slice(0, 6).map((fb) => {
                    const avg = averageRating(fb);
                    const at = fb.submitted_at ?? fb.created_at ?? null;
                    return (
                      <li key={fb.id}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-slate-900">
                            {avg !== null ? `Avg rating: ${avg.toFixed(1)} / 5` : "Feedback submitted"}
                          </p>
                          <p className="text-[11px] text-slate-500">{formatDateTimeEt(at)}</p>
                        </div>
                        {fb.comment ? (
                          <p className="mt-0.5 text-xs text-slate-700">
                            {fb.comment.length > 140 ? `${fb.comment.slice(0, 140)}…` : fb.comment}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-slate-500">No written comment.</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-700">
              <p className="font-semibold text-slate-900">Data sources</p>
              <p className="mt-1 text-slate-600">
                Balance/visits/status from <span className="font-mono">rewards_user_overview</span>. Spent from{" "}
                <span className="font-mono">rewards_redemptions</span>. Earned from positive{" "}
                <span className="font-mono">rewards_scans</span>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
