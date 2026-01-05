"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import DashboardShell from "@/components/layout/DashboardShell";
import { logDashboardEvent } from "@/lib/logDashboardEvent";

type Sponsor = {
  id: string;
  name: string | null;
  logo_path: string | null;
  tier: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  is_preloader_enabled: boolean | null;
  created_at: string | null;
};

type SponsorPreloaderContextConfig = {
  enabled?: boolean;
  vip_max_shows?: number; // override (optional)
  max_sponsors?: number; // override (optional)

  // V2 pointer (what your route.ts normalizes to)
  pool?: string | null; // null/undefined/"global" => use global pool; any other string => pools[pool] allowlist

  // Back-compat (some older values / UI state)
  sponsor_ids?: string[] | null; // legacy allowlist
  allowlist_ids?: string[] | null; // legacy allowlist
};

type SponsorPreloaderConfig = {
  enabled: boolean;
  title: string;
  body: string;
  duration_ms: number;
  starts_on: string | null; // YYYY-MM-DD
  ends_on: string | null; // YYYY-MM-DD
  max_sponsors: number;

  // VIP daily cap (ET) – used by the app as default
  vip_max_shows?: number;

  // V2 pools (route.ts may store allowlists here)
  pools?: Record<string, string[]>; // must include global

  // per-context controls
  contexts?: Record<string, SponsorPreloaderContextConfig>;
};

const PRELOADER_SETTINGS_KEY = "sponsor_preloader";

const DEFAULT_PRELOADER: SponsorPreloaderConfig = {
  enabled: true,
  title: "Live music stays free because of our sponsors",
  body: "Thanks to these sponsors, the music is free — please support the businesses that support live music.",
  duration_ms: 2200,
  starts_on: null,
  ends_on: null,
  max_sponsors: 8,
  vip_max_shows: 3,

  // V2 defaults
  pools: { global: [] },
  contexts: {},
};

// ✅ Your app contexts (keys should match what the app uses)
const CONTEXTS: Array<{ key: string; label: string; hint: string }> = [
  { key: "check-in", label: "Check-in", hint: "Shown when entering Check-in page" },
  { key: "tonight", label: "Tonight", hint: "Shown on Tonight page load" },
  { key: "calendar", label: "Calendar", hint: "Shown on Calendar page load" },
  { key: "artists", label: "Artists", hint: "Shown on Artists page load" },
  { key: "photo-booth", label: "Photo Booth", hint: "Shown on Photo Booth page load" },
  { key: "fan-wall", label: "Fan Wall", hint: "Shown on Fan Wall page load" },
  { key: "rewards", label: "Rewards", hint: "Shown on Rewards home load" },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeIdArray(v: any) {
  if (v === null) return null;
  if (!Array.isArray(v)) return undefined;
  return v.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 500);
}

function normalizePools(raw: any): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const key = String(k || "").trim();
      if (!key) continue;
      out[key] = Array.isArray(v) ? (v as any[]).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 500) : [];
    }
  }
  if (!out.global) out.global = [];
  return out;
}

function clampConfig(raw: any): SponsorPreloaderConfig {
  const merged: SponsorPreloaderConfig = { ...DEFAULT_PRELOADER, ...(raw || {}) };

  merged.enabled = !!merged.enabled;

  merged.title = String(merged.title || DEFAULT_PRELOADER.title).slice(0, 120);
  merged.body = String(merged.body || DEFAULT_PRELOADER.body).slice(0, 400);

  const dur = Number(merged.duration_ms);
  merged.duration_ms = Number.isFinite(dur) ? clamp(dur, 800, 8000) : DEFAULT_PRELOADER.duration_ms;

  const max = Number(merged.max_sponsors);
  merged.max_sponsors = Number.isFinite(max) ? clamp(max, 1, 30) : DEFAULT_PRELOADER.max_sponsors;

  const s = merged.starts_on ? String(merged.starts_on).slice(0, 10) : null;
  const e = merged.ends_on ? String(merged.ends_on).slice(0, 10) : null;

  merged.starts_on = s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  merged.ends_on = e && /^\d{4}-\d{2}-\d{2}$/.test(e) ? e : null;

  // VIP max shows: allow 0..50 (0 = never for VIP)
  const vipRaw = merged.vip_max_shows;
  const vip = Number(vipRaw);
  merged.vip_max_shows =
    vipRaw === 0
      ? 0
      : Number.isFinite(vip)
      ? clamp(vip, 0, 50)
      : DEFAULT_PRELOADER.vip_max_shows;

  // ✅ Pools (V2)
  merged.pools = normalizePools((raw || {})?.pools);

  // ✅ Contexts (support V2 pool pointer AND legacy sponsor_ids/allowlist_ids)
  const ctx = (raw || {})?.contexts;
  const outCtx: Record<string, SponsorPreloaderContextConfig> = {};

  if (ctx && typeof ctx === "object" && !Array.isArray(ctx)) {
    for (const [k, v] of Object.entries(ctx)) {
      const key = String(k || "").trim();
      if (!key) continue;

      const vv: any = v && typeof v === "object" ? v : {};

      const enabled =
        typeof vv.enabled === "boolean"
          ? vv.enabled
          : vv.enabled != null
          ? !!vv.enabled
          : undefined;

      const vipN = vv.vip_max_shows;
      const vipNum = vipN === 0 ? 0 : Number(vipN);
      const vipClamped =
        vipN == null
          ? undefined
          : Number.isFinite(vipNum)
          ? clamp(vipNum, 0, 50)
          : undefined;

      const maxN = vv.max_sponsors;
      const maxNum = Number(maxN);
      const maxClamped =
        maxN == null
          ? undefined
          : Number.isFinite(maxNum)
          ? clamp(maxNum, 1, 30)
          : undefined;

      // V2 pool pointer
      const pool =
        typeof vv.pool === "string"
          ? vv.pool.trim()
          : vv.pool === null
          ? null
          : undefined;

      // legacy arrays
      const sponsorIds = normalizeIdArray(vv.sponsor_ids);
      const allowlistIds = normalizeIdArray(vv.allowlist_ids);

      // If legacy allowlist exists but no pool pointer (or pool is global), convert to ctx:<key> pool
      let finalPool: string | null | undefined = pool;
      const legacyIds = Array.isArray(sponsorIds) ? sponsorIds : Array.isArray(allowlistIds) ? allowlistIds : null;

      if ((finalPool === undefined || finalPool === null || finalPool === "" || finalPool === "global") && Array.isArray(legacyIds)) {
        const generated = `ctx:${key}`;
        merged.pools![generated] = legacyIds.slice(0, 500);
        finalPool = generated;
      }

      outCtx[key] = {
        ...(enabled === undefined ? {} : { enabled }),
        ...(vipClamped === undefined ? {} : { vip_max_shows: vipClamped }),
        ...(maxClamped === undefined ? {} : { max_sponsors: maxClamped }),
        ...(finalPool === undefined ? {} : { pool: finalPool }),
      };
    }
  }

  merged.contexts = outCtx;
  if (!merged.pools!.global) merged.pools!.global = [];

  return merged;
}

function getLogoPublicUrl(logo_path: string | null | undefined) {
  if (!logo_path) return null;
  const { data } = supabase.storage.from("sponsor-logos").getPublicUrl(logo_path);
  return data?.publicUrl ?? null;
}

export default function SponsorPreloaderPage() {
  const [config, setConfig] = useState<SponsorPreloaderConfig>(DEFAULT_PRELOADER);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loadingSponsors, setLoadingSponsors] = useState(false);
  const [poolSaving, setPoolSaving] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);

  // Global pool modal picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelectedIds, setPickerSelectedIds] = useState<Record<string, boolean>>({});

  // per-context allowlist picker
  const [ctxPickerOpen, setCtxPickerOpen] = useState(false);
  const [ctxPickerKey, setCtxPickerKey] = useState<string>("");
  const [ctxPickerSearch, setCtxPickerSearch] = useState("");
  const [ctxPickerSelectedIds, setCtxPickerSelectedIds] = useState<Record<string, boolean>>({});

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    void fetchConfig();
    void fetchSponsors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pool = useMemo(() => sponsors.filter((s) => !!s.is_preloader_enabled), [sponsors]);
  const poolSorted = useMemo(() => {
    return pool
      .slice()
      .sort(
        (a, b) =>
          Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) ||
          String(a.created_at || "").localeCompare(String(b.created_at || ""))
      );
  }, [pool]);

  const poolCount = poolSorted.length;

  const availableForPicker = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    const base = [...sponsors]
      .filter((s) => !s.is_preloader_enabled)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

    if (!q) return base;
    return base.filter((s) => (s.name || "").toLowerCase().includes(q) || (s.tier || "").toLowerCase().includes(q));
  }, [sponsors, pickerSearch]);

  const previewSponsor = useMemo(() => {
    if (poolSorted.length === 0) return null;
    const idx = Math.max(0, Math.min(poolSorted.length - 1, previewIndex));
    return poolSorted[idx] || null;
  }, [poolSorted, previewIndex]);

  const previewLogoUrl = useMemo(() => getLogoPublicUrl(previewSponsor?.logo_path || null), [previewSponsor]);

  // ✅ Quick lookup for showing which sponsors are selected per context
  const sponsorById = useMemo(() => {
    const m = new Map<string, Sponsor>();
    for (const s of sponsors) m.set(s.id, s);
    return m;
  }, [sponsors]);

  async function fetchConfig() {
    setLoadingConfig(true);
    setConfigError(null);
    try {
      const res = await fetch("/api/app-settings/sponsor-preloader", { method: "GET" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load preloader settings.");

      const raw = json?.data?.value ?? null;
      setConfig(clampConfig(raw));
    } catch (e: any) {
      console.error(e);
      setConfigError(e?.message || "Failed to load preloader settings.");
    } finally {
      setLoadingConfig(false);
    }
  }

  async function saveConfig(next: SponsorPreloaderConfig) {
    setSavingConfig(true);
    setConfigError(null);
    try {
      const res = await fetch("/api/app-settings/sponsor-preloader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to save preloader settings.");

      setConfig(clampConfig(json.value));

      void logDashboardEvent({
        action: "update",
        entity: "app_settings",
        entityId: PRELOADER_SETTINGS_KEY,
        details: { sponsor_preloader: json.value },
      });
    } catch (e: any) {
      console.error(e);
      setConfigError(e?.message || "Failed to save preloader settings.");
    } finally {
      setSavingConfig(false);
    }
  }

  async function fetchSponsors() {
    setLoadingSponsors(true);
    setPoolError(null);
    try {
      const { data, error } = await supabase
        .from("sponsors")
        .select("id,name,logo_path,tier,sort_order,is_active,is_preloader_enabled,created_at")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;

      setSponsors((data || []) as Sponsor[]);
    } catch (e: any) {
      console.error(e);
      setPoolError(e?.message || "Failed to load sponsors.");
      setSponsors([]);
    } finally {
      setLoadingSponsors(false);
    }
  }

  async function removeFromPool(id: string) {
    if (poolSaving) return;
    setPoolSaving(true);
    setPoolError(null);

    try {
      const { error } = await supabase.from("sponsors").update({ is_preloader_enabled: false }).eq("id", id);
      if (error) throw error;

      void logDashboardEvent({
        action: "update",
        entity: "sponsors",
        entityId: id,
        details: { is_preloader_enabled: false },
      });

      await fetchSponsors();
    } catch (e: any) {
      console.error(e);
      setPoolError(e?.message || "Failed to update sponsor pool.");
    } finally {
      setPoolSaving(false);
    }
  }

  function openPicker() {
    setPickerSelectedIds({});
    setPickerSearch("");
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerSelectedIds({});
    setPickerSearch("");
  }

  function togglePickerId(id: string) {
    setPickerSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const pickerSelectedCount = useMemo(() => Object.values(pickerSelectedIds).filter(Boolean).length, [pickerSelectedIds]);

  async function addSelectedToPool() {
    if (poolSaving) return;

    const ids = Object.entries(pickerSelectedIds)
      .filter(([, v]) => !!v)
      .map(([k]) => k);

    if (ids.length === 0) return;

    setPoolSaving(true);
    setPoolError(null);

    try {
      const updates = ids.map((id) => supabase.from("sponsors").update({ is_preloader_enabled: true }).eq("id", id));
      const results = await Promise.all(updates);

      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;

      void logDashboardEvent({
        action: "update",
        entity: "sponsors",
        details: { is_preloader_enabled: true, added_ids: ids },
      });

      await fetchSponsors();
      closePicker();
    } catch (e: any) {
      console.error(e);
      setPoolError(e?.message || "Failed to update sponsor pool.");
    } finally {
      setPoolSaving(false);
    }
  }

  function openPreview() {
    setPreviewIndex(0);
    setPreviewOpen(true);
  }

  function closePreview() {
    setPreviewOpen(false);
  }

  function nextPreview() {
    if (poolSorted.length === 0) return;
    setPreviewIndex((i) => (i + 1) % poolSorted.length);
  }

  function prevPreview() {
    if (poolSorted.length === 0) return;
    setPreviewIndex((i) => (i - 1 + poolSorted.length) % poolSorted.length);
  }

  // -------------------------------
  // Context Controls (V2 pools + pool pointer)
  // -------------------------------

  function getCtx(key: string): SponsorPreloaderContextConfig {
    return (config.contexts && config.contexts[key]) || {};
  }

  function getCtxPoolName(key: string) {
    const c = getCtx(key);
    const p = typeof c.pool === "string" ? c.pool.trim() : c.pool;
    if (!p || p === "global") return "global";
    return p;
  }

  function getCtxAllowlistIds(key: string) {
    const poolName = getCtxPoolName(key);
    if (poolName === "global") return null;
    const pools = config.pools || { global: [] };
    const ids = pools[poolName];
    return Array.isArray(ids) ? ids : [];
  }

  function setCtx(key: string, patch: Partial<SponsorPreloaderContextConfig>) {
    setConfig((prev) => {
      const next = clampConfig({
        ...prev,
        contexts: {
          ...(prev.contexts || {}),
          [key]: { ...(prev.contexts?.[key] || {}), ...patch },
        },
      });
      return next;
    });
  }

  function setPools(patch: Record<string, string[] | undefined>) {
    setConfig((prev) => {
      const pools = { ...(prev.pools || { global: [] }) } as Record<string, string[]>;
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) {
          delete pools[k];
        } else {
          pools[k] = v;
        }
      }
      if (!pools.global) pools.global = [];
      return clampConfig({ ...prev, pools });
    });
  }

  function isCtxEnabled(key: string) {
    const c = getCtx(key);
    if (typeof c.enabled === "boolean") return c.enabled;
    return true;
  }

  function ctxUsesAllowlist(key: string) {
    // allowlist mode when pool points to a non-global pool
    const poolName = getCtxPoolName(key);
    return poolName !== "global";
  }

  function openCtxPicker(key: string) {
    setCtxPickerKey(key);
    setCtxPickerSearch("");

    const currentIds = getCtxAllowlistIds(key);
    const map: Record<string, boolean> = {};
    if (Array.isArray(currentIds)) {
      for (const id of currentIds) map[id] = true;
    }
    setCtxPickerSelectedIds(map);

    setCtxPickerOpen(true);
  }

  function closeCtxPicker() {
    setCtxPickerOpen(false);
    setCtxPickerKey("");
    setCtxPickerSearch("");
    setCtxPickerSelectedIds({});
  }

  function toggleCtxPickerId(id: string) {
    setCtxPickerSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const ctxPickerSelectedCount = useMemo(
    () => Object.values(ctxPickerSelectedIds).filter(Boolean).length,
    [ctxPickerSelectedIds]
  );

  const ctxPickerEligibleSponsors = useMemo(() => {
    const q = ctxPickerSearch.trim().toLowerCase();
    const base = [...sponsors].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

    if (!q) return base;
    return base.filter((s) => (s.name || "").toLowerCase().includes(q) || (s.tier || "").toLowerCase().includes(q));
  }, [sponsors, ctxPickerSearch]);

  function saveCtxPickerSelection() {
    const ids = Object.entries(ctxPickerSelectedIds)
      .filter(([, v]) => !!v)
      .map(([k]) => k);

    // ✅ Persist using V2 pools + pointer
    const poolName = `ctx:${ctxPickerKey}`;
    setPools({ [poolName]: ids });
    setCtx(ctxPickerKey, { pool: poolName });

    closeCtxPicker();
  }

  function clearCtxAllowlist(key: string) {
    const poolName = `ctx:${key}`;
    // revert to global pool and remove the ctx pool (keeps db clean)
    setCtx(key, { pool: null });
    setPools({ [poolName]: undefined });
  }

  return (
    <DashboardShell
      title="Sponsor Preloader"
      subtitle="Edit preloader messaging (no app update), control VIP daily frequency, control per-page enablement, and manage which sponsors appear."
      activeTab="sponsors"
    >
      <div className="space-y-6">
        {/* Config card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Preloader messaging</h3>
              <p className="text-xs text-slate-600">
                These values are read by the app. Change copy here without shipping an app update.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {loadingConfig && <span className="text-xs text-slate-500">Loading…</span>}

              <button
                type="button"
                onClick={openPreview}
                disabled={poolSorted.length === 0}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                title={poolSorted.length === 0 ? "Add sponsors to the pool to enable preview" : "Preview the exact preloader look"}
              >
                Preview preloader
              </button>
            </div>
          </div>

          {configError && (
            <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
              {configError}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-800">Enabled (global master)</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-500"
                  checked={!!config.enabled}
                  onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))}
                />
                Allow sponsor preloader overlay in the app (master switch)
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Starts on (ET)</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={config.starts_on ?? ""}
                    onChange={(e) => setConfig((p) => ({ ...p, starts_on: e.target.value || null }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Ends on (ET)</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={config.ends_on ?? ""}
                    onChange={(e) => setConfig((p) => ({ ...p, ends_on: e.target.value || null }))}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Duration (ms)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={config.duration_ms}
                    onChange={(e) => setConfig((p) => ({ ...p, duration_ms: Number(e.target.value) }))}
                  />
                  <p className="text-[11px] text-slate-500">Clamp: 800–8000ms.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Max sponsors shown (global)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={config.max_sponsors}
                    onChange={(e) => setConfig((p) => ({ ...p, max_sponsors: Number(e.target.value) }))}
                  />
                  <p className="text-[11px] text-slate-500">Clamp: 1–30.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">VIP max shows per day (ET) (global)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={typeof config.vip_max_shows === "number" ? config.vip_max_shows : 3}
                    onChange={(e) => setConfig((p) => ({ ...p, vip_max_shows: Number(e.target.value) }))}
                  />
                  <p className="text-[11px] text-slate-500">
                    VIP users see the preloader up to this many times per day. Set to <span className="font-semibold">0</span> to never show VIP.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Title</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  value={config.title}
                  onChange={(e) => setConfig((p) => ({ ...p, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Body</label>
                <textarea
                  rows={5}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  value={config.body}
                  onChange={(e) => setConfig((p) => ({ ...p, body: e.target.value }))}
                />
                <p className="text-[11px] text-slate-500">Tip: keep it short + premium. This copy appears in the app overlay.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={() => void saveConfig(clampConfig(config))}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/40 hover:bg-sky-400 disabled:opacity-60"
                >
                  {savingConfig ? "Saving…" : "Save preloader settings"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Context controls */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-slate-900">Context controls</h3>
            <p className="text-xs text-slate-600">
              Control where the overlay appears, per-context VIP caps, and optionally select a sponsor allowlist for that page.
              If you do <span className="font-semibold">not</span> set an allowlist, the app uses the global pool.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {CONTEXTS.map((ctx) => {
              const c = getCtx(ctx.key);
              const enabled = isCtxEnabled(ctx.key);

              const usesAllow = ctxUsesAllowlist(ctx.key);

              const selectedIds = usesAllow ? (getCtxAllowlistIds(ctx.key) || []) : [];
              const selectedCount = selectedIds.length;

              const vipOverride = typeof c.vip_max_shows === "number" ? c.vip_max_shows : "";
              const maxOverride = typeof c.max_sponsors === "number" ? c.max_sponsors : "";

              // ✅ Build a human-friendly list of selected sponsors (for display only)
              const selectedSponsors = usesAllow
                ? (selectedIds.map((id) => sponsorById.get(id)).filter(Boolean) as Sponsor[])
                : [];

              const unknownCount = usesAllow ? selectedIds.filter((id) => !sponsorById.has(id)).length : 0;

              const maxBadges = 3;
              const badgeSponsors = selectedSponsors.slice(0, maxBadges);
              const remaining = Math.max(0, selectedSponsors.length - badgeSponsors.length);

              return (
                <div key={ctx.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{ctx.label}</div>
                      <div className="mt-0.5 text-xs text-slate-600">{ctx.hint}</div>
                      <div className="mt-2 text-[11px] text-slate-600">
                        Context key: <span className="font-mono font-semibold">{ctx.key}</span>
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-sky-500"
                        checked={enabled}
                        onChange={(e) => setCtx(ctx.key, { enabled: e.target.checked })}
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-800">VIP max/day (override)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                        placeholder={`Default: ${typeof config.vip_max_shows === "number" ? config.vip_max_shows : 3}`}
                        value={vipOverride}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCtx(ctx.key, { vip_max_shows: v === "" ? undefined : Number(v) });
                        }}
                      />
                      <p className="text-[11px] text-slate-500">Blank = use global VIP max/day.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-800">Max sponsors (override)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                        placeholder={`Default: ${config.max_sponsors}`}
                        value={maxOverride}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCtx(ctx.key, { max_sponsors: v === "" ? undefined : Number(v) });
                        }}
                      />
                      <p className="text-[11px] text-slate-500">Blank = use global max sponsors.</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-900">Sponsor selection</div>

                      <div className="flex items-center gap-2">
                        {usesAllow ? (
                          <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800">
                            Allowlist: {selectedCount}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                            Using global pool
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ✅ show which sponsor(s) are selected */}
                    {usesAllow ? (
                      <div className="mt-2">
                        <div className="flex flex-wrap gap-2">
                          {badgeSponsors.map((s) => {
                            const label = `${s.name || "Unnamed sponsor"}${s.tier ? ` • ${s.tier}` : ""}`;
                            return (
                              <span
                                key={s.id}
                                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700"
                                title={label}
                              >
                                {label}
                              </span>
                            );
                          })}

                          {remaining > 0 ? (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                              +{remaining} more
                            </span>
                          ) : null}

                          {unknownCount > 0 ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                              {unknownCount} unknown
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 text-[11px] text-slate-600">
                          The app will rotate through this allowlist for <span className="font-mono font-semibold">{ctx.key}</span>.
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {!usesAllow ? (
                        <button
                          type="button"
                          onClick={() => {
                            // Switch into allowlist mode (start empty in ctx:<key>)
                            const poolName = `ctx:${ctx.key}`;
                            setPools({ [poolName]: [] });
                            setCtx(ctx.key, { pool: poolName });
                            openCtxPicker(ctx.key);
                          }}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Set allowlist…
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openCtxPicker(ctx.key)}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            Edit allowlist…
                          </button>
                          <button
                            type="button"
                            onClick={() => clearCtxAllowlist(ctx.key)}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            title="Revert to global pool"
                          >
                            Use global pool
                          </button>
                        </>
                      )}
                    </div>

                    <div className="mt-2 text-[11px] text-slate-600">
                      Allowlist means this page only shows sponsors you select (even if they are not in the global pool).
                      Global pool means this page uses sponsors with <span className="font-mono">is_preloader_enabled=true</span>.
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              disabled={savingConfig}
              onClick={() => void saveConfig(clampConfig(config))}
              className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/40 hover:bg-sky-400 disabled:opacity-60"
            >
              {savingConfig ? "Saving…" : "Save context settings"}
            </button>
          </div>
        </section>

        {/* Pool manager */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Global preloader sponsor pool</h3>
              <p className="text-xs text-slate-600">
                This is the default sponsor set the app can feature when a context does not have an allowlist.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {loadingSponsors && <span className="text-xs text-slate-500">Loading…</span>}
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                {poolCount} in pool
              </span>

              <button
                type="button"
                onClick={openPicker}
                disabled={poolSaving || loadingSponsors}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                + Add sponsors
              </button>
            </div>
          </div>

          {poolError && (
            <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
              {poolError}
            </div>
          )}

          {poolSorted.length === 0 && !loadingSponsors ? (
            <p className="text-sm text-slate-600">
              No sponsors in the global pool yet. Click <span className="font-semibold">“Add sponsors”</span> to select some.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {poolSorted.map((s) => {
                const logoUrl = getLogoPublicUrl(s.logo_path);
                return (
                  <li key={s.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logoUrl} alt={s.name || "Sponsor"} className="h-full w-full object-contain p-2" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                            No logo
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{s.name || "Unnamed sponsor"}</p>
                        {s.tier ? (
                          <p className="text-[11px] font-semibold text-sky-700">{s.tier}</p>
                        ) : (
                          <p className="text-[11px] text-slate-500">—</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => void removeFromPool(s.id)}
                        disabled={poolSaving}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Global Pool Picker Modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add sponsors to global pool</h2>
                <p className="text-xs text-slate-600">
                  Search and select sponsors to add. This avoids a permanent checkbox next to every sponsor forever.
                </p>
              </div>
              <button
                type="button"
                onClick={closePicker}
                className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                placeholder="Search sponsors by name or tier…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />

              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-slate-600">{pickerSelectedCount} selected</span>
                <button
                  type="button"
                  onClick={() => void addSelectedToPool()}
                  disabled={poolSaving || pickerSelectedCount === 0}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/40 hover:bg-sky-400 disabled:opacity-60"
                >
                  {poolSaving ? "Saving…" : "Add selected"}
                </button>
              </div>
            </div>

            {availableForPicker.length === 0 ? (
              <p className="text-sm text-slate-600">No available sponsors to add (or search returned no matches).</p>
            ) : (
              <ul className="space-y-2">
                {availableForPicker.map((s) => {
                  const checked = !!pickerSelectedIds[s.id];
                  const logoUrl = getLogoPublicUrl(s.logo_path);

                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-white">
                          {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt={s.name || "Sponsor"} className="h-full w-full object-contain p-2" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                              No logo
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{s.name || "Unnamed sponsor"}</p>
                          <p className="text-[11px] text-slate-600">{s.tier || "—"}</p>
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-sky-500"
                          checked={checked}
                          onChange={() => togglePickerId(s.id)}
                        />
                        Select
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Context Allowlist Picker Modal */}
      {ctxPickerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Context allowlist</h2>
                <p className="text-xs text-slate-600">
                  Choose exactly which sponsors can appear for{" "}
                  <span className="font-mono font-semibold">{ctxPickerKey}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCtxPicker}
                className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                placeholder="Search sponsors by name or tier…"
                value={ctxPickerSearch}
                onChange={(e) => setCtxPickerSearch(e.target.value)}
              />

              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-slate-600">{ctxPickerSelectedCount} selected</span>
                <button
                  type="button"
                  onClick={saveCtxPickerSelection}
                  className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/40 hover:bg-sky-400"
                >
                  Save allowlist
                </button>
              </div>
            </div>

            {ctxPickerEligibleSponsors.length === 0 ? (
              <p className="text-sm text-slate-600">No sponsors found.</p>
            ) : (
              <ul className="space-y-2">
                {ctxPickerEligibleSponsors.map((s) => {
                  const checked = !!ctxPickerSelectedIds[s.id];
                  const logoUrl = getLogoPublicUrl(s.logo_path);

                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-white">
                          {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt={s.name || "Sponsor"} className="h-full w-full object-contain p-2" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                              No logo
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{s.name || "Unnamed sponsor"}</p>
                          <p className="text-[11px] text-slate-600">{s.tier || "—"}</p>
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-sky-500"
                          checked={checked}
                          onChange={() => toggleCtxPickerId(s.id)}
                        />
                        Select
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal (unchanged) */}
      {previewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-3 py-4 sm:px-6 sm:py-6">
          <div className="w-full max-w-5xl max-h-[88vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">Preloader Preview</h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  This preview uses the same visual order as the app: <span className="font-semibold">Title → Logo → Body → Tap</span>.
                  Extra top padding is included so the title won’t ride the status bar.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={prevPreview}
                  disabled={poolSorted.length <= 1}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={nextPreview}
                  disabled={poolSorted.length <= 1}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="max-h-[calc(88vh-72px)] overflow-auto">
              <div className="grid gap-4 p-4 sm:gap-6 sm:p-5 lg:grid-cols-[1fr_340px]">
                <div className="flex items-center justify-center">
                  <div className="w-full max-w-[420px]">
                    <div className="rounded-[34px] border border-slate-200 bg-slate-950 p-3 shadow-xl">
                      <div className="relative overflow-hidden rounded-[28px] bg-[#020617]">
                        <div className="max-h-[68vh] overflow-auto px-6 pt-14 pb-10">
                          <div className="text-center">
                            <div className="mx-auto max-w-[320px] text-[26px] font-black leading-[30px] tracking-tight text-white">
                              {config.title || DEFAULT_PRELOADER.title}
                            </div>
                          </div>

                          <div className="mt-7 flex justify-center">
                            <div className="rounded-full border border-sky-500/30 bg-sky-500/10 px-6 py-2.5">
                              <span className="text-[12px] font-extrabold uppercase tracking-wide text-white">
                                {previewSponsor?.tier ? String(previewSponsor.tier) : "Sponsor"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-6 flex justify-center">
                            <div className="h-[230px] w-[230px] overflow-hidden rounded-[38px] border border-white/10 bg-white/[0.06] shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
                              <div className="flex h-full w-full items-center justify-center p-7">
                                {previewLogoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={previewLogoUrl}
                                    alt={previewSponsor?.name || "Sponsor"}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <div className="text-center text-xs font-semibold text-slate-300">No logo</div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 text-center">
                            <div className="mx-auto max-w-[320px] text-[44px] font-black leading-[46px] tracking-tight text-white">
                              {previewSponsor?.name ? String(previewSponsor.name) : "Sponsor"}
                            </div>
                          </div>

                          <div className="mt-7 text-center">
                            <div className="mx-auto max-w-[340px] text-[14px] font-semibold leading-[20px] text-slate-300">
                              {config.body || DEFAULT_PRELOADER.body}
                            </div>
                          </div>

                          <div className="mt-8 text-center">
                            <div className="text-[12px] font-semibold text-slate-400">Tap anywhere to continue</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-center text-[11px] text-slate-500">
                      Showing sponsor {poolSorted.length === 0 ? 0 : previewIndex + 1} of {poolSorted.length}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Preview details</h3>

                  <ul className="mt-2 space-y-2 text-xs text-slate-700">
                    <li>
                      <span className="font-semibold">Safe top padding:</span> the title starts lower to avoid iOS status bar crowding.
                    </li>
                    <li>
                      <span className="font-semibold">App order:</span> Title → Logo → Body → Tap.
                    </li>
                    <li>
                      <span className="font-semibold">Logo treatment:</span> larger container, more padding, always contain.
                    </li>
                    <li>
                      <span className="font-semibold">Fit:</span> the phone frame scrolls internally on very small screens.
                    </li>
                  </ul>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-[11px] font-semibold text-slate-900">Current settings (from this page)</div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-700">
                      <div>
                        <span className="font-semibold">Enabled:</span> {config.enabled ? "Yes" : "No"}
                      </div>
                      <div>
                        <span className="font-semibold">Duration:</span> {config.duration_ms} ms
                      </div>
                      <div>
                        <span className="font-semibold">Max sponsors:</span> {config.max_sponsors}
                      </div>
                      <div>
                        <span className="font-semibold">VIP max/day (ET):</span>{" "}
                        {typeof config.vip_max_shows === "number" ? config.vip_max_shows : DEFAULT_PRELOADER.vip_max_shows}
                      </div>
                      <div className="pt-1">
                        <div className="font-semibold">Title</div>
                        <div className="text-slate-600">{config.title}</div>
                      </div>
                      <div className="pt-1">
                        <div className="font-semibold">Body</div>
                        <div className="text-slate-600">{config.body}</div>
                      </div>
                    </div>
                  </div>

                  {poolSorted.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                      Add sponsors to the pool to enable preview.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
