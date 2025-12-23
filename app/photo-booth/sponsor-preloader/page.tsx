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

type SponsorPreloaderConfig = {
  enabled: boolean;
  title: string;
  body: string;
  duration_ms: number;
  starts_on: string | null; // YYYY-MM-DD
  ends_on: string | null; // YYYY-MM-DD
  max_sponsors: number;

  // VIP daily control
  vip_max_shows?: number; // 0 = never for VIP, N>0 = show up to N times per day (ET)
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
};

function clampConfig(raw: any): SponsorPreloaderConfig {
  const merged: SponsorPreloaderConfig = { ...DEFAULT_PRELOADER, ...(raw || {}) };

  merged.enabled = !!merged.enabled;

  merged.title = String(merged.title || DEFAULT_PRELOADER.title).slice(0, 120);
  merged.body = String(merged.body || DEFAULT_PRELOADER.body).slice(0, 400);

  const dur = Number(merged.duration_ms);
  merged.duration_ms = Number.isFinite(dur) ? Math.min(8000, Math.max(800, dur)) : DEFAULT_PRELOADER.duration_ms;

  const max = Number(merged.max_sponsors);
  merged.max_sponsors = Number.isFinite(max) ? Math.min(30, Math.max(1, max)) : DEFAULT_PRELOADER.max_sponsors;

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
      ? Math.min(50, Math.max(0, vip))
      : DEFAULT_PRELOADER.vip_max_shows;

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

  // Scalable selection UI (modal picker)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelectedIds, setPickerSelectedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void fetchConfig();
    void fetchSponsors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pool = useMemo(() => sponsors.filter((s) => !!s.is_preloader_enabled), [sponsors]);
  const poolCount = pool.length;

  const availableForPicker = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    const base = [...sponsors]
      .filter((s) => !s.is_preloader_enabled)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

    if (!q) return base;

    return base.filter((s) => (s.name || "").toLowerCase().includes(q) || (s.tier || "").toLowerCase().includes(q));
  }, [sponsors, pickerSearch]);

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

  return (
    <DashboardShell
      title="Sponsor Preloader"
      subtitle="Edit preloader messaging (no app update) and manage which sponsors appear in the preloader."
      activeTab="sponsors"
    >
      <div className="space-y-6">
        {/* Config card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Preloader messaging</h3>
              <p className="text-xs text-slate-600">These values are read by the app. Change copy here without shipping an app update.</p>
            </div>
            {loadingConfig && <span className="text-xs text-slate-500">Loading…</span>}
          </div>

          {configError && <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">{configError}</div>}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-800">Enabled</label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-500"
                  checked={!!config.enabled}
                  onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))}
                />
                Show sponsor preloader overlay in the app
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
                  <label className="text-xs font-semibold text-slate-800">Max sponsors shown</label>
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
                  <label className="text-xs font-semibold text-slate-800">VIP max shows per day (ET)</label>
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

        {/* Pool manager */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Preloader sponsor pool</h3>
              <p className="text-xs text-slate-600">
                This is the sponsor set the app can feature in the preloader. Scalable selector (no permanent checkbox list).
              </p>
            </div>

            <div className="flex items-center gap-2">
              {loadingSponsors && <span className="text-xs text-slate-500">Loading…</span>}
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{poolCount} in pool</span>

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

          {poolError && <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">{poolError}</div>}

          {pool.length === 0 && !loadingSponsors ? (
            <p className="text-sm text-slate-600">
              No sponsors in the preloader pool yet. Click <span className="font-semibold">“Add sponsors”</span> to select some.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pool
                .slice()
                .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
                .map((s) => {
                  const logoUrl = getLogoPublicUrl(s.logo_path);
                  return (
                    <li key={s.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-white">
                          {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt={s.name || "Sponsor"} className="h-full w-full object-contain p-2" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No logo</div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{s.name || "Unnamed sponsor"}</p>
                          {s.tier ? <p className="text-[11px] font-semibold text-sky-700">{s.tier}</p> : <p className="text-[11px] text-slate-500">—</p>}
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

      {/* Picker Modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add sponsors to preloader pool</h2>
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
                    <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-white">
                          {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt={s.name || "Sponsor"} className="h-full w-full object-contain p-2" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No logo</div>
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
    </DashboardShell>
  );
}
