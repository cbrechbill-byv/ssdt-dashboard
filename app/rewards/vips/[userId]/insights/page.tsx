// app/rewards/vips/[userId]/insights/page.tsx
// VIP Insights dashboard for a single Sugarshack Downtown rewards user.

import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
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
  scanned_at: string;
  source: string;
  note: string | null;
};

type Redemption = {
  id: string;
  reward_name: string;
  points_spent: number;
  staff_label: string;
  staff_last4: string;
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
  if (!phone) return "Unknown";
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

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: ET_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: ET_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPoints(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  return value.toString();
}

function averageRating(row: FeedbackRow): number | null {
  const values = [row.music_rating, row.food_rating, row.fun_rating].filter(
    (v): v is number => typeof v === "number"
  );
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
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

// Next 16: params is a Promise; we must await it.
export default async function VipInsightsPage(props: {
  params: Promise<{ userId: string }>;
}) {
  const session = await getDashboardSession();
  if (!session) redirect("/login");

  const { userId } = await props.params;
  const supabase = supabaseServer;

  // 1) Load VIP overview row
  const { data: overviewRows, error: overviewError } = await supabase
    .from("rewards_user_overview")
    .select(
      "user_id, phone, full_name, email, zip, is_vip, total_points, total_visits, first_scan_at, last_scan_at"
    )
    .eq("user_id", userId)
    .limit(1);

  if (overviewError) {
    console.error("[vip insights] overview error", overviewError);
  }

  const overview: VipOverviewRow | null =
    overviewRows && overviewRows.length > 0
      ? (overviewRows[0] as VipOverviewRow)
      : null;

  const phone = overview?.phone ?? null;
  const email = overview?.email ?? null;

  // 2) Load scans for this user
  const { data: scansData, error: scansError } = await supabase
    .from("rewards_scans")
    .select("id, points, scanned_at, source, note")
    .eq("user_id", userId)
    .order("scanned_at", { ascending: false })
    .limit(100);

  if (scansError) {
    console.error("[vip insights] scans error", scansError);
  }

  const scans: RewardScan[] = (scansData ?? []) as RewardScan[];

  let totalEarned = 0;
  let totalSpent = 0;

  for (const scan of scans) {
    if (scan.points > 0) totalEarned += scan.points;
    else if (scan.points < 0) totalSpent += Math.abs(scan.points);
  }

  // 3) Load redemptions
  const { data: redemptionsData, error: redemptionsError } = await supabase
    .from("rewards_redemptions")
    .select("id, reward_name, points_spent, staff_label, staff_last4, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (redemptionsError) {
    console.error("[vip insights] redemptions error", redemptionsError);
  }

  const redemptions: Redemption[] = (redemptionsData ?? []) as Redemption[];

  // 4) Fan Wall posts for this user
  const { data: fanWallData, error: fanWallError } = await supabase
    .from("fan_wall_posts")
    .select("id, caption, created_at, is_approved, is_hidden")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (fanWallError) {
    console.error("[vip insights] fan wall error", fanWallError);
  }

  const fanPosts: FanWallPost[] = (fanWallData ?? []) as FanWallPost[];

  // 5) Feedback matched by phone/email (if we have either)
  let feedbackRows: FeedbackRow[] = [];

  if (phone || email) {
    const orFilters: string[] = [];
    if (phone) orFilters.push(`contact_phone.eq.${phone}`);
    if (email) orFilters.push(`contact_email.eq.${email}`);

    if (orFilters.length > 0) {
      const { data: fbData, error: fbError } = await supabase
        .from("feedback")
        .select(
          "id, music_rating, food_rating, fun_rating, comment, anonymous, contact_name, contact_email, contact_phone, submitted_at, created_at"
        )
        .or(orFilters.join(","))
        .order("submitted_at", { ascending: false })
        .limit(50);

      if (fbError) {
        console.error("[vip insights] feedback error", fbError);
      } else {
        feedbackRows = (fbData ?? []) as FeedbackRow[];
      }
    }
  }

  // 6) Build unified activity list
  const activities: ActivityItem[] = [];

  for (const scan of scans) {
    activities.push({
      kind: "scan",
      id: `scan-${scan.id}`,
      at: scan.scanned_at,
      label: scan.points > 0 ? "Check-in / points added" : "Points adjustment",
      points: scan.points,
      source: scan.source,
      note: scan.note,
    });
  }

  for (const red of redemptions) {
    activities.push({
      kind: "redemption",
      id: `red-${red.id}`,
      at: red.created_at,
      label: "Reward redeemed",
      reward_name: red.reward_name,
      points_spent: red.points_spent,
      staff_label: red.staff_label,
    });
  }

  for (const post of fanPosts) {
    activities.push({
      kind: "fan-wall",
      id: `fan-${post.id}`,
      at: post.created_at,
      label: "Fan Wall post",
      caption: post.caption,
    });
  }

  for (const fb of feedbackRows) {
    activities.push({
      kind: "feedback",
      id: `fb-${fb.id}`,
      at: fb.submitted_at ?? fb.created_at ?? "",
      label: "Feedback submitted",
      snippet: fb.comment,
      avg_rating: averageRating(fb),
    });
  }

  activities.sort((a, b) => {
    const aTime = new Date(a.at).getTime();
    const bTime = new Date(b.at).getTime();
    return bTime - aTime;
  });

  const vipName =
    overview?.full_name ||
    (overview?.phone ? formatPhone(overview.phone) : null) ||
    overview?.email ||
    "Unknown rewards user";

  const headerSubtitle = overview
    ? `${overview.phone ? formatPhone(overview.phone) : "No phone on file"}${
        overview.email ? ` · ${overview.email}` : ""
      } (Timezone: ${ET_TZ})`
    : `This rewards user has limited activity on file. (Timezone: ${ET_TZ})`;

  return (
    <DashboardShell title="VIP Insights" subtitle={headerSubtitle} activeTab="rewards">
      <div className="space-y-6">
        {/* Subnav */}
        <VipSubnav userId={userId} />

        {/* Top identity + core stats */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                VIP profile
              </p>
              <h1 className="text-base font-semibold text-slate-900 truncate">
                {vipName}
              </h1>
              <p className="text-xs text-slate-500">
                {overview?.is_vip ? "Active VIP" : "Registered guest"}
                {overview?.zip ? ` · ZIP ${overview.zip}` : ""}
              </p>
              <p className="text-[11px] text-slate-400">
                First visit: {formatShortDate(overview?.first_scan_at)} · Last visit:{" "}
                {formatShortDate(overview?.last_scan_at)}
              </p>
              <p className="text-[11px] font-mono text-slate-400">user_id: {userId}</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Current points
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatPoints(
                    overview?.total_points !== null && overview?.total_points !== undefined
                      ? Number(overview.total_points)
                      : 0
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Visits
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatPoints(
                    overview?.total_visits !== null && overview?.total_visits !== undefined
                      ? Number(overview.total_visits)
                      : 0
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Redemptions
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {redemptions.length}
                </p>
              </div>
            </div>
          </div>

          {/* Quick actions */}
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

        {/* Earned vs spent + totals */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Points earned
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatPoints(totalEarned)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Sum of all positive point entries from check-ins and manual adjustments.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Points spent
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatPoints(totalSpent)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Sum of all negative point entries recorded in the scans ledger.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Net lifetime points
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatPoints(totalEarned - totalSpent)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Earned minus spent. Should roughly align with current points balance.
            </p>
          </div>
        </section>

        {/* Main layout: timeline + right-hand panels */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
          {/* Activity timeline */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Recent activity
            </h2>

            {activities.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
                No activity yet for this user. Once they check in, redeem, post
                to the Fan Wall, or leave feedback, it will appear here.
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                {activities.slice(0, 25).map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="mt-1 h-2 w-2 rounded-full bg-slate-900 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900">
                          {item.label}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatDate(item.at)}
                        </p>
                      </div>

                      {item.kind === "scan" && (
                        <p className="mt-0.5 text-xs text-slate-600">
                          {item.points > 0 ? "+" : ""}
                          {item.points} pts · Source: {item.source}
                          {item.note ? ` · ${item.note}` : ""}
                        </p>
                      )}

                      {item.kind === "redemption" && (
                        <p className="mt-0.5 text-xs text-slate-600">
                          {item.reward_name} ·{" "}
                          <span className="font-semibold">
                            -{item.points_spent} pts
                          </span>{" "}
                          · Approved by {item.staff_label}
                        </p>
                      )}

                      {item.kind === "fan-wall" && (
                        <p className="mt-0.5 text-xs text-slate-600">
                          Fan Wall caption:{" "}
                          {item.caption || <span className="italic">None</span>}
                        </p>
                      )}

                      {item.kind === "feedback" && (
                        <p className="mt-0.5 text-xs text-slate-600">
                          {item.avg_rating !== null && (
                            <span className="mr-1.5">
                              Avg rating: {item.avg_rating.toFixed(1)} / 5 ·
                            </span>
                          )}
                          {item.snippet
                            ? item.snippet.length > 100
                              ? `${item.snippet.slice(0, 100)}…`
                              : item.snippet
                            : "No written comment"}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right-hand side panels */}
          <div className="space-y-4">
            {/* Recent redemptions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recent redemptions
              </h2>
              {redemptions.length === 0 ? (
                <p className="text-xs text-slate-500">No rewards redeemed yet.</p>
              ) : (
                <ul className="space-y-2 text-xs text-slate-700">
                  {redemptions.slice(0, 5).map((red) => (
                    <li
                      key={red.id}
                      className="flex items-start justify-between gap-2"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {red.reward_name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatDate(red.created_at)} · Approved by {red.staff_label}
                        </p>
                      </div>
                      <span className="ml-2 rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        -{red.points_spent} pts
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Fan Wall posts */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Fan Wall posts
              </h2>
              {fanPosts.length === 0 ? (
                <p className="text-xs text-slate-500">No Fan Wall activity yet.</p>
              ) : (
                <ul className="space-y-2 text-xs text-slate-700">
                  {fanPosts.slice(0, 5).map((post) => (
                    <li key={post.id}>
                      <p className="font-medium text-slate-900">
                        {post.caption || "Untitled post"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatDate(post.created_at)} ·{" "}
                        {post.is_hidden
                          ? "Hidden"
                          : post.is_approved
                          ? "Approved"
                          : "Pending / not approved"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Feedback */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Feedback from this guest
              </h2>
              {feedbackRows.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No feedback matched yet. Feedback is linked by phone or email when provided.
                </p>
              ) : (
                <ul className="space-y-2 text-xs text-slate-700">
                  {feedbackRows.slice(0, 5).map((fb) => {
                    const avg = averageRating(fb);
                    return (
                      <li key={fb.id}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-slate-900">
                            {avg !== null
                              ? `Avg rating: ${avg.toFixed(1)} / 5`
                              : "Feedback submitted"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {formatDate(fb.submitted_at ?? fb.created_at ?? null)}
                          </p>
                        </div>
                        {fb.comment && (
                          <p className="mt-0.5 text-xs text-slate-700">
                            {fb.comment.length > 120
                              ? `${fb.comment.slice(0, 120)}…`
                              : fb.comment}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
