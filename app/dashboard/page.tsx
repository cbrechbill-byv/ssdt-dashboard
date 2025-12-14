// app/dashboard/page.tsx
// Path: /dashboard
// Purpose: Main Sugarshack Downtown overview (today KPIs, VIP health, content readiness, fan wall, quick actions, Top VIPs).
// Sprint 3: Add "Content readiness" -> Artists data quality card (missing images/bios/socials) with Edit links.
// Sprint 4 (Run 1): Add Sponsors data quality card (missing logo/website) with link to Sponsors manager.
// Sprint 5 (Run 1): Add Rewards menu readiness card (missing names/invalid point costs/inactive count) with link to /rewards.

import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/dashboardAuth";
import React from "react";
import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { TopVipsTableClient } from "./TopVipsTableClient";

/**
 * Force dynamic so the dashboard always shows fresh stats.
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getDashboardSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = supabaseServer;

  type RewardsUserOverview = {
    user_id: string | null;
    phone: string | null;
    full_name: string | null;
    is_vip: boolean | null;
    total_points: number | null;
    total_visits: number | null;
    last_scan_at: string | null;
  };

  type VipListRow = {
    userId: string;
    phoneLabel: string;
    nameLabel: string;
    points: number;
    visits: number;
    lastVisitLabel: string;
  };

  type ArtistRow = {
    id: string;
    name: string;
    bio: string | null;
    website_url: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    tiktok_url: string | null;
    spotify_url: string | null;
    image_path: string | null;
    is_active: boolean;
  };

  type SponsorRow = {
    id: string;
    name: string;
    logo_path: string | null;
    website_url: string | null;
    tier: string | null;
    is_active: boolean;
    sort_order: number | null;
    start_date: string | null;
    end_date: string | null;
    notes: string | null;
    created_at: string | null;
    updated_at: string | null;
  };

  type RewardMenuItemRow = {
    id: string;
    name: string;
    description: string | null;
    points_required: number;
    sort_order: number;
    is_active: boolean;
    created_at: string | null;
    updated_at: string | null;
  };

  function getTodayDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function formatPhone(phone?: string | null): string {
    if (!phone) return "Unknown";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
        6,
        10
      )}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      const d = digits.slice(1);
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
    }
    return digits;
  }

  function formatDateTimeLabel(iso: string | null): string {
    if (!iso) return "No visits yet";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "No visits yet";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const today = getTodayDateString();

  // -----------------------------
  // 1) Today’s rewards_scans stats
  // -----------------------------
  let checkinsToday = 0;
  let uniqueVipsToday = 0;
  let pointsAwardedToday = 0;
  let pointsRedeemedToday = 0;

  const { data: scanRows } = await supabase
    .from("rewards_scans")
    .select("user_id, points, scan_date, source")
    .eq("scan_date", today);

  if (scanRows?.length) {
    type ScanRow = {
      user_id: string | null;
      points: number | null;
      scan_date: string;
      source: string | null;
    };

    const rows = scanRows as ScanRow[];

    const checkinRows = rows.filter(
      (row) => (row.source ?? "").toLowerCase() === "qr-checkin"
    );

    checkinsToday = checkinRows.length;

    uniqueVipsToday = new Set(
      checkinRows.map((row) => row.user_id).filter(Boolean)
    ).size;

    for (const row of rows) {
      const pts = Number(row.points ?? 0);
      if (!Number.isFinite(pts) || pts === 0) continue;
      if (pts > 0) pointsAwardedToday += pts;
      else pointsRedeemedToday += Math.abs(pts);
    }
  }

  const netPointsToday = pointsAwardedToday - pointsRedeemedToday;

  // -----------------------------
  // 2) VIP overview via rewards_user_overview
  // -----------------------------
  const { data: vipOverviewRows } = await supabase
    .from("rewards_user_overview")
    .select(
      "user_id, phone, full_name, is_vip, total_points, total_visits, last_scan_at"
    );

  const allUsers = (vipOverviewRows ?? []) as RewardsUserOverview[];
  const vipUsers = allUsers.filter((u) => u.is_vip);

  const vipBaseCount = vipUsers.length;
  const totalVipCount = vipBaseCount;

  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  const activeVipsCount = vipUsers.filter((u) => {
    if (!u.last_scan_at) return false;
    const last = new Date(u.last_scan_at).getTime();
    return !Number.isNaN(last) && nowMs - last <= THIRTY_DAYS;
  }).length;

  const activePercentage =
    vipBaseCount > 0 ? (activeVipsCount / vipBaseCount) * 100 : 0;

  // -----------------------------
  // 3) Fan Wall stats
  // -----------------------------
  const [
    { count: pendingCount },
    { count: liveCount },
    { count: hiddenCount },
    { count: totalCount },
  ] = await Promise.all([
    supabase
      .from("fan_wall_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", false)
      .eq("is_hidden", false),
    supabase
      .from("fan_wall_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", true)
      .eq("is_hidden", false),
    supabase
      .from("fan_wall_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_hidden", true),
    supabase.from("fan_wall_posts").select("id", { count: "exact", head: true }),
  ]);

  const fanPending = pendingCount ?? 0;
  const fanLive = liveCount ?? 0;
  const fanHidden = hiddenCount ?? 0;
  const fanTotal = totalCount ?? 0;

  // -----------------------------
  // 4) Top VIPs list (Top 20 computed server-side)
  // -----------------------------
  const sortedVipRows = [...vipUsers].sort((a, b) => {
    const aTime = a.last_scan_at ? new Date(a.last_scan_at).getTime() : 0;
    const bTime = b.last_scan_at ? new Date(b.last_scan_at).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return (b.total_points ?? 0) - (a.total_points ?? 0);
  });

  const topTwentyRows = sortedVipRows.slice(0, 20);

  const vipList: VipListRow[] = topTwentyRows
    .filter((row) => Boolean(row.user_id))
    .map((row) => ({
      userId: row.user_id as string,
      phoneLabel: formatPhone(row.phone),
      nameLabel: row.full_name || "VIP Guest",
      points: row.total_points ?? 0,
      visits: row.total_visits ?? 0,
      lastVisitLabel: formatDateTimeLabel(row.last_scan_at),
    }));

  // -----------------------------
  // 5) Artists readiness summary (dashboard only)
  // -----------------------------
  const { data: artistRows, error: artistsError } = await supabase
    .from("artists")
    .select(
      "id, name, bio, website_url, instagram_url, facebook_url, tiktok_url, spotify_url, image_path, is_active"
    );

  if (artistsError) {
    console.error("[dashboard] artists readiness error:", artistsError);
  }

  const artists = (artistRows ?? []) as ArtistRow[];
  const artistsTotal = artists.length;
  const artistsActive = artists.filter((a) => a.is_active).length;

  const activeArtists = artists.filter((a) => a.is_active);

  const missingArtistImage = activeArtists.filter((a) => !a.image_path).length;
  const missingArtistBio = activeArtists.filter(
    (a) => !a.bio || a.bio.trim().length === 0
  ).length;

  const missingArtistAnySocial = activeArtists.filter((a) => {
    const hasAny =
      !!a.website_url ||
      !!a.instagram_url ||
      !!a.facebook_url ||
      !!a.tiktok_url ||
      !!a.spotify_url;
    return !hasAny;
  }).length;

  const artistsNeedingAttention = [...activeArtists]
    .map((a) => {
      const hasImage = !!a.image_path;
      const hasBio = !!(a.bio && a.bio.trim().length > 0);
      const hasAnySocial =
        !!a.website_url ||
        !!a.instagram_url ||
        !!a.facebook_url ||
        !!a.tiktok_url ||
        !!a.spotify_url;

      const score =
        (hasImage ? 0 : 4) + (hasBio ? 0 : 2) + (hasAnySocial ? 0 : 1);

      return {
        id: a.id,
        name: a.name || "Untitled artist",
        hasImage,
        hasBio,
        hasAnySocial,
        score,
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 5);

  // -----------------------------
  // 6) Sponsors readiness summary (dashboard only)
  // -----------------------------
  const { data: sponsorRows, error: sponsorsError } = await supabase
    .from("sponsors")
    .select(
      "id, name, logo_path, website_url, tier, is_active, sort_order, start_date, end_date, notes, created_at, updated_at"
    );

  if (sponsorsError) {
    console.error("[dashboard] sponsors readiness error:", sponsorsError);
  }

  const sponsors = (sponsorRows ?? []) as SponsorRow[];
  const sponsorsTotal = sponsors.length;
  const sponsorsActive = sponsors.filter((s) => s.is_active).length;
  const activeSponsors = sponsors.filter((s) => s.is_active);

  const missingSponsorLogo = activeSponsors.filter((s) => !s.logo_path).length;
  const missingSponsorWebsite = activeSponsors.filter(
    (s) => !s.website_url || s.website_url.trim().length === 0
  ).length;

  const sponsorsNeedingAttention = [...activeSponsors]
    .map((s) => {
      const hasLogo = !!s.logo_path;
      const hasWebsite = !!(s.website_url && s.website_url.trim().length > 0);
      const score = (hasLogo ? 0 : 2) + (hasWebsite ? 0 : 1);

      return {
        id: s.id,
        name: s.name || "Untitled sponsor",
        hasLogo,
        hasWebsite,
        score,
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 5);

  // -----------------------------
  // 7) Sprint 5: Rewards menu readiness (dashboard only)
  // -----------------------------
  const { data: rewardsMenuRows, error: rewardsMenuError } = await supabase
    .from("rewards_menu_items")
    .select("id, name, description, points_required, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (rewardsMenuError) {
    console.error("[dashboard] rewards menu readiness error:", rewardsMenuError);
  }

  const rewardsMenuItems = (rewardsMenuRows ?? []) as RewardMenuItemRow[];
  const rewardsMenuTotal = rewardsMenuItems.length;
  const rewardsMenuActive = rewardsMenuItems.filter((r) => r.is_active).length;
  const rewardsMenuInactive = rewardsMenuTotal - rewardsMenuActive;

  const activeRewards = rewardsMenuItems.filter((r) => r.is_active);

  const rewardsMissingName = activeRewards.filter(
    (r) => !r.name || r.name.trim().length === 0
  ).length;

  const rewardsInvalidPoints = activeRewards.filter((r) => {
    const pts = Number(r.points_required);
    return !Number.isFinite(pts) || pts <= 0;
  }).length;

  const rewardsNeedingAttention = [...activeRewards]
    .map((r) => {
      const hasName = !!(r.name && r.name.trim().length > 0);
      const pts = Number(r.points_required);
      const hasValidPoints = Number.isFinite(pts) && pts > 0;

      const score = (hasName ? 0 : 2) + (hasValidPoints ? 0 : 2);

      return {
        id: r.id,
        name: r.name && r.name.trim().length > 0 ? r.name : "Untitled reward",
        hasName,
        hasValidPoints,
        points_required: r.points_required,
        sort_order: r.sort_order,
        score,
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 5);

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <DashboardShell
      title="Sugarshack Downtown VIP Dashboard"
      subtitle="Check-ins, VIP activity, and fan content at a glance."
      activeTab="dashboard"
    >
      <div className="space-y-6">
        {/* Top stat row */}
        <div className="grid gap-4 md:grid-cols-5">
          <StatCard
            label="Check-ins today"
            helper="VIPs who checked in with tonight’s QR."
            value={checkinsToday}
          />
          <StatCard
            label="Unique VIPs today"
            helper="One per phone number per day."
            value={uniqueVipsToday}
          />
          <StatCard
            label="Points awarded today"
            helper="Points given from check-ins and boosts."
            value={pointsAwardedToday}
          />
          <StatCard
            label="Points redeemed today"
            helper="Points spent on rewards today."
            value={pointsRedeemedToday}
          />
          <StatCard
            label="Net points today"
            helper="Awarded minus redeemed (today only)."
            value={netPointsToday}
          />
        </div>

        {/* VIP base + active percentage */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <StatCard
            label="VIP base"
            helper="Total unique VIPs with a rewards profile."
            value={vipBaseCount}
          />
          <PercentCard
            label="Active VIPs"
            helper="% of VIPs with a recent check-in (last 30 days)."
            value={activePercentage}
          />
        </div>

        {/* Content readiness */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                Content readiness
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Launch-facing data checks to keep the mobile app high quality.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/artists"
                className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 shadow-sm"
              >
                Open Artists
              </Link>
              <Link
                href="/photo-booth/sponsors"
                className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 shadow-sm"
              >
                Open Sponsors
              </Link>
              <Link
                href="/rewards"
                className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 shadow-sm"
              >
                Open Rewards
              </Link>
            </div>
          </div>

          {/* Errors (non-blocking) */}
          {(artistsError || sponsorsError || rewardsMenuError) && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {artistsError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-xs text-rose-700">
                    Artists readiness failed:{" "}
                    <span className="font-mono">{artistsError.message}</span>
                  </p>
                </div>
              )}
              {sponsorsError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-xs text-rose-700">
                    Sponsors readiness failed:{" "}
                    <span className="font-mono">{sponsorsError.message}</span>
                  </p>
                </div>
              )}
              {rewardsMenuError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-xs text-rose-700">
                    Rewards readiness failed:{" "}
                    <span className="font-mono">{rewardsMenuError.message}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Artists + Sponsors grid */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Artists card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Artists data quality (active only)
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    Active artists
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {artistsActive}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {artistsTotal} total in directory
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    Missing image
                  </p>
                  <p className="mt-1 text-xl font-semibold text-amber-600">
                    {missingArtistImage}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Needed for Artist + Events pages
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    Missing bio
                  </p>
                  <p className="mt-1 text-xl font-semibold text-amber-600">
                    {missingArtistBio}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Improves app engagement
                  </p>
                </div>
              </div>

              <div className="mt-3 text-xs">
                <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  Missing any social link
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-semibold text-amber-600">
                    {missingArtistAnySocial}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Website / IG / FB / TikTok / Spotify all blank
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Needs attention
                  </p>
                  <Link
                    href="/artists"
                    className="text-[11px] font-semibold text-slate-700 hover:text-amber-600"
                  >
                    View all
                  </Link>
                </div>

                {artistsNeedingAttention.length === 0 ? (
                  <p className="mt-3 text-xs text-emerald-700">
                    ✅ All active artists have image, bio, and at least one link.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {artistsNeedingAttention.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {a.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {!a.hasImage ? "Missing image" : null}
                            {!a.hasImage && (!a.hasBio || !a.hasAnySocial)
                              ? " · "
                              : null}
                            {!a.hasBio ? "Missing bio" : null}
                            {!a.hasBio && !a.hasAnySocial ? " · " : null}
                            {!a.hasAnySocial ? "No links" : null}
                          </p>
                        </div>

                        <Link
                          href={`/artists/edit?id=${a.id}`}
                          className="inline-flex flex-shrink-0 items-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-amber-100"
                        >
                          Edit
                        </Link>
                      </div>
                    ))}
                    <p className="pt-1 text-[11px] text-slate-400">
                      Tip: prioritize adding the main image first (most visible
                      in the app).
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Sponsors card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Sponsors data quality (active only)
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    Active sponsors
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {sponsorsActive}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {sponsorsTotal} total in list
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    Missing logo
                  </p>
                  <p className="mt-1 text-xl font-semibold text-amber-600">
                    {missingSponsorLogo}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Needed for Sponsors + Photo Booth
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    Missing website
                  </p>
                  <p className="mt-1 text-xl font-semibold text-amber-600">
                    {missingSponsorWebsite}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Optional, but improves sponsor value
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Needs attention
                  </p>
                  <Link
                    href="/photo-booth/sponsors"
                    className="text-[11px] font-semibold text-slate-700 hover:text-amber-600"
                  >
                    Open manager
                  </Link>
                </div>

                {sponsorsNeedingAttention.length === 0 ? (
                  <p className="mt-3 text-xs text-emerald-700">
                    ✅ All active sponsors have a logo and a website link (or
                    intentionally blank).
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {sponsorsNeedingAttention.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {s.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {!s.hasLogo ? "Missing logo" : null}
                            {!s.hasLogo && !s.hasWebsite ? " · " : null}
                            {!s.hasWebsite ? "Missing website" : null}
                          </p>
                        </div>

                        <Link
                          href="/photo-booth/sponsors"
                          className="inline-flex flex-shrink-0 items-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-amber-100"
                        >
                          Fix
                        </Link>
                      </div>
                    ))}
                    <p className="pt-1 text-[11px] text-slate-400">
                      Tip: upload square-ish PNG/JPG logos for best results.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rewards readiness card (full-width under the grid) */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Rewards menu data quality (active only)
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  These items show in the mobile Rewards redeem screen.
                </p>
              </div>
              <Link
                href="/rewards"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-amber-50"
              >
                Open Rewards editor
              </Link>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-4 text-xs">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  Active rewards
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {rewardsMenuActive}
                </p>
                <p className="text-[11px] text-slate-500">
                  {rewardsMenuTotal} total · {rewardsMenuInactive} inactive
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  Missing name
                </p>
                <p className="mt-1 text-xl font-semibold text-amber-600">
                  {rewardsMissingName}
                </p>
                <p className="text-[11px] text-slate-500">
                  Items must be labeled
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  Invalid points
                </p>
                <p className="mt-1 text-xl font-semibold text-amber-600">
                  {rewardsInvalidPoints}
                </p>
                <p className="text-[11px] text-slate-500">
                  Points required must be &gt; 0
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  Status
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {rewardsNeedingAttention.length === 0 ? "✅" : "⚠️"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {rewardsNeedingAttention.length === 0
                    ? "No active issues detected"
                    : "Some items need fixes"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Needs attention
                </p>
                <Link
                  href="/rewards"
                  className="text-[11px] font-semibold text-slate-700 hover:text-amber-600"
                >
                  View / edit all
                </Link>
              </div>

              {rewardsNeedingAttention.length === 0 ? (
                <p className="mt-3 text-xs text-emerald-700">
                  ✅ All active rewards have names and valid point costs.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {rewardsNeedingAttention.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {r.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {!r.hasName ? "Missing name" : null}
                          {!r.hasName && !r.hasValidPoints ? " · " : null}
                          {!r.hasValidPoints ? "Invalid points" : null}
                          <span className="ml-2 text-slate-400">
                            (points: {r.points_required}, sort: {r.sort_order})
                          </span>
                        </p>
                      </div>

                      <Link
                        href="/rewards"
                        className="inline-flex flex-shrink-0 items-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-amber-100"
                      >
                        Fix
                      </Link>
                    </div>
                  ))}
                  <p className="pt-1 text-[11px] text-slate-400">
                    Tip: keep sort order clean so the mobile menu is consistent.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Fan wall + Quick actions */}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
                  Fan Wall moderation
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  High-level view of what’s waiting on the Fan Wall.
                </p>
              </div>

              <Link
                href="/fan-wall"
                className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-50 shadow-sm"
              >
                Open Fan Wall
              </Link>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-4 text-xs">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Pending
                </p>
                <p className="mt-1 text-xl font-semibold text-amber-600">
                  {fanPending}
                </p>
                <p className="text-[11px] text-slate-500">Awaiting approval</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Live
                </p>
                <p className="mt-1 text-xl font-semibold text-emerald-600">
                  {fanLive}
                </p>
                <p className="text-[11px] text-slate-500">Showing in the app</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Hidden
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-700">
                  {fanHidden}
                </p>
                <p className="text-[11px] text-slate-500">Removed/hidden</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Total submissions
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {fanTotal}
                </p>
                <p className="text-[11px] text-slate-500">All-time photos</p>
              </div>
            </div>
          </section>

          {/* Quick actions */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
              Quick actions
            </p>
            <p className="mt-1 mb-3 text-xs text-slate-500">
              Jump to common Sugarshack Downtown controls.
            </p>

            <div className="space-y-2 text-xs">
              <Link
                href="/dashboard/tonight"
                className="block w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 hover:bg-amber-100"
              >
                <p className="font-medium text-slate-900">
                  Tonight&apos;s live board
                </p>
                <p className="text-[11px] text-slate-600">
                  See today&apos;s check-ins, points, and redemptions in real
                  time.
                </p>
              </Link>

              <Link
                href="/events"
                className="block w-full rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <p className="font-medium text-slate-900">
                  Tonight’s show editor
                </p>
                <p className="text-[11px] text-slate-500">
                  Edit tonight’s performers & times.
                </p>
              </Link>

              <Link
                href="/fan-wall"
                className="block w-full rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <p className="font-medium text-slate-900">
                  Open full Fan Wall
                </p>
                <p className="text-[11px] text-slate-500">
                  Moderate & approve Photo Booth shots.
                </p>
              </Link>

              <Link
                href="/notifications"
                className="block w-full rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <p className="font-medium text-slate-900">
                  Send push notification
                </p>
                <p className="text-[11px] text-slate-500">
                  Reach VIPs and guests instantly.
                </p>
              </Link>
            </div>
          </section>
        </div>

        {/* Top VIPs (client expand; no CSV export) */}
        <TopVipsTableClient vipList={vipList} totalVipCount={totalVipCount} />
      </div>
    </DashboardShell>
  );
}

// -----------------------------
// Presentational components
// -----------------------------

type StatCardProps = {
  label: string;
  helper: string;
  value: string | number;
};

function StatCard({ label, helper, value }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
      <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function PercentCard({
  label,
  helper,
  value,
}: {
  label: string;
  helper: string;
  value: number;
}) {
  const clamped = Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
      <p className="text-[11px] font-semibold text-slate-500 tracking-[0.12em] uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">
        {clamped.toFixed(0)}%
      </p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full bg-emerald-500 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
