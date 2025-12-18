// app/photo-booth/frames/page.tsx
// Path: /photo-booth/frames
// Dashboard: Photo Booth — Frames (manage overlays used in the mobile app)
//
// Update:
// - Normalize uploads to 1080x1920 PNG (9:16) and apply rounded-corner transparency mask.
// - Add "Reprocess existing overlays" to fix already-uploaded overlays (overwrites same overlay_path).
//
// Notes:
// - photo_booth_frames.overlay_path is NOT NULL -> "Create" requires an overlay upload.
// - We do NOT change UI by adding new fields for description/season_tag/sponsor_id/frame_key;
//   we simply write null for those columns on create/update.

"use client";

import React, { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabase } from "@/lib/supabase-browser";
import { logDashboardEvent } from "@/lib/logDashboardEvent";

type FrameRow = {
  id: string;
  key: string;
  label: string;

  description: string | null;
  overlay_path: string;
  overlay_opacity: number;
  is_active: boolean;
  sort_order: number;

  season_tag: string | null;
  sponsor_id: string | null;
  frame_key: string | null;

  created_at: string;
  updated_at: string;
};

type FormState = {
  id?: string;
  key: string;
  label: string;
  overlayFile?: File | null;
  overlay_path?: string | null;
  overlay_opacity: number;
  is_active: boolean;
  sort_order: number;
};

const EMPTY_FORM: FormState = {
  key: "",
  label: "",
  overlayFile: undefined,
  overlay_path: undefined,
  overlay_opacity: 1.0,
  is_active: true,
  sort_order: 0,
};

const FRAME_BUCKET = "photo-booth-overlays";

// Normalize overlays to a consistent, crisp output for the app.
const TARGET_W = 1080;
const TARGET_H = 1920;

// IMPORTANT: The app uses borderRadius: 24 (RN layout pixels) on the preview container.
// The captured output is higher-res; the equivalent pixel radius is larger than 24 at 1080px wide.
// In practice, using ~6.25% of width matches a 24px radius on a ~384px-wide preview.
// That yields ~68px at 1080px, which reliably removes corner artifacts.
const RADIUS_RATIO = 1 / 16; // 6.25%
const TARGET_RADIUS_PX = Math.round(TARGET_W * RADIUS_RATIO); // ~68px

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function sanitizeKey(raw: string) {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getOverlayPublicUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data } = supabase.storage.from(FRAME_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return loadImageFromBlob(file);
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function computeCoverCrop(srcW: number, srcH: number, dstW: number, dstH: number) {
  // Like CSS object-fit: cover
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;

  let sWidth = srcW;
  let sHeight = srcH;
  let sx = 0;
  let sy = 0;

  if (srcAspect > dstAspect) {
    // wider -> crop sides
    sHeight = srcH;
    sWidth = Math.round(srcH * dstAspect);
    sx = Math.round((srcW - sWidth) / 2);
    sy = 0;
  } else {
    // taller -> crop top/bottom
    sWidth = srcW;
    sHeight = Math.round(srcW / dstAspect);
    sx = 0;
    sy = Math.round((srcH - sHeight) / 2);
  }

  return { sx, sy, sWidth, sHeight };
}

async function processOverlayToTargetPng(input: File | Blob): Promise<Blob> {
  const img = input instanceof File ? await loadImageFromFile(input) : await loadImageFromBlob(input);

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_W;
  canvas.height = TARGET_H;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // transparent background
  ctx.clearRect(0, 0, TARGET_W, TARGET_H);

  // Clip to rounded rect so corners are guaranteed transparent
  roundedRectPath(ctx, 0, 0, TARGET_W, TARGET_H, TARGET_RADIUS_PX);
  ctx.save();
  ctx.clip();

  // Draw cover-cropped into 9:16
  const crop = computeCoverCrop(img.naturalWidth, img.naturalHeight, TARGET_W, TARGET_H);
  ctx.imageSmoothingEnabled = true;
  // @ts-ignore
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    crop.sx,
    crop.sy,
    crop.sWidth,
    crop.sHeight,
    0,
    0,
    TARGET_W,
    TARGET_H
  );

  ctx.restore();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode PNG"))),
      "image/png",
      1.0
    );
  });

  return blob;
}

async function uploadOverlayPng(filePath: string, png: Blob): Promise<void> {
  const { error } = await supabase.storage.from(FRAME_BUCKET).upload(filePath, png, {
    upsert: true,
    contentType: "image/png",
    cacheControl: "3600",
  });

  if (error) throw new Error(error.message || "Overlay upload failed");
}

function normalizeFrames(list: FrameRow[]): FrameRow[] {
  const sorted = [...list].sort((a, b) => {
    const ao = Number(a.sort_order ?? 0);
    const bo = Number(b.sort_order ?? 0);
    if (ao !== bo) return ao - bo;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
  return sorted.map((f, idx) => ({ ...f, sort_order: idx }));
}

export const dynamic = "force-dynamic";

export default function PhotoBoothFramesPage() {
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [processingAll, setProcessingAll] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [overlayPreviewUrl, setOverlayPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    void fetchFrames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (overlayPreviewUrl) URL.revokeObjectURL(overlayPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchFrames() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("photo_booth_frames")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setError("Failed to load photo booth frames.");
      setLoading(false);
      return;
    }

    const normalized = normalizeFrames((data || []) as FrameRow[]);
    setFrames(normalized);
    setLoading(false);

    // Best-effort: persist normalization
    void (async () => {
      try {
        await Promise.all(
          normalized.map((f) =>
            supabase.from("photo_booth_frames").update({ sort_order: f.sort_order }).eq("id", f.id)
          )
        );
      } catch {
        // ignore
      }
    })();
  }

  const nextSuggestedSortOrder = useMemo(() => {
    const max = frames.reduce((m, f) => Math.max(m, Number(f.sort_order ?? 0)), 0);
    return Number.isFinite(max) ? max + 1 : 1;
  }, [frames]);

  function resetPreviewState() {
    if (overlayPreviewUrl) URL.revokeObjectURL(overlayPreviewUrl);
    setOverlayPreviewUrl(null);
  }

  function openCreateModal() {
    resetPreviewState();
    setForm({ ...EMPTY_FORM, sort_order: nextSuggestedSortOrder });
    setIsEditing(false);
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(frame: FrameRow) {
    resetPreviewState();
    setIsEditing(true);
    setError(null);

    setForm({
      id: frame.id,
      key: frame.key,
      label: frame.label,
      overlayFile: undefined,
      overlay_path: frame.overlay_path,
      overlay_opacity: typeof frame.overlay_opacity === "number" ? frame.overlay_opacity : 1.0,
      is_active: frame.is_active,
      sort_order: frame.sort_order ?? 0,
    });

    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSaving(false);
    setError(null);
    resetPreviewState();
  }

  function handleInputChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onPickOverlay(file?: File | null) {
    handleInputChange("overlayFile", file ?? undefined);

    resetPreviewState();
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setOverlayPreviewUrl(preview);
  }

  async function uploadOverlayIfNeeded(file?: File | null): Promise<string | null | undefined> {
    if (!file) return form.overlay_path ?? null;

    const processedPng = await processOverlayToTargetPng(file);

    const baseKey = sanitizeKey(form.key || "overlay");
    const fileName = `${baseKey}-${Date.now()}.png`;

    await uploadOverlayPng(fileName, processedPng);
    return fileName;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const keySanitized = sanitizeKey(form.key);
      if (!keySanitized) throw new Error("Frame key is required.");
      if (!form.label.trim()) throw new Error("Frame label is required.");

      const sortOrderNum = Number(form.sort_order);
      if (!Number.isFinite(sortOrderNum)) throw new Error("Sort order must be a number.");

      const opacityNum = Number(form.overlay_opacity);
      if (!Number.isFinite(opacityNum) || opacityNum <= 0 || opacityNum > 1.0) {
        throw new Error("Overlay opacity must be a number between 0.01 and 1.0.");
      }

      // overlay_path is NOT NULL: enforce upload for create
      if (!form.id && !form.overlayFile) {
        throw new Error("Overlay image is required when creating a new frame.");
      }

      const overlay_path = await uploadOverlayIfNeeded(form.overlayFile);
      if (!overlay_path) {
        // Should never happen due to checks above, but keep it safe:
        throw new Error("Overlay image is required.");
      }

      // Keep extra schema fields as-is (no UI changes): write null unless you add fields later
      const payload = {
        key: keySanitized,
        label: form.label,
        overlay_path, // NOT NULL
        overlay_opacity: opacityNum,
        is_active: form.is_active,
        sort_order: sortOrderNum,

        description: null,
        season_tag: null,
        sponsor_id: null,
        frame_key: null,
      };

      let frameId: string | undefined;
      const action: "create" | "update" = form.id ? "update" : "create";

      if (form.id) {
        const { error } = await supabase.from("photo_booth_frames").update(payload).eq("id", form.id);
        if (error) throw new Error(error.message || "Failed to save frame");
        frameId = form.id;
      } else {
        const { data, error } = await supabase
          .from("photo_booth_frames")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw new Error(error.message || "Failed to create frame");
        frameId = data?.id;
      }

      void logDashboardEvent({
        action,
        entity: "photo_booth_frames",
        entityId: frameId,
        details: {
          key: keySanitized,
          label: form.label,
          overlay_path,
          overlay_opacity: opacityNum,
          is_active: form.is_active,
          sort_order: sortOrderNum,
          processing: {
            target: `${TARGET_W}x${TARGET_H}`,
            roundedCornersPx: TARGET_RADIUS_PX,
          },
        },
      });

      await fetchFrames();
      closeModal();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error saving frame");
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this frame?")) return;
    setDeletingId(id);
    setError(null);

    const frame = frames.find((f) => f.id === id);

    try {
      const { error } = await supabase.from("photo_booth_frames").delete().eq("id", id);
      if (error) throw new Error(error.message || "Failed to delete frame");

      void logDashboardEvent({
        action: "delete",
        entity: "photo_booth_frames",
        entityId: id,
        details: frame ? { key: frame.key, label: frame.label, overlay_path: frame.overlay_path } : { id },
      });

      await fetchFrames();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error deleting frame");
    } finally {
      setDeletingId(null);
    }
  }

  async function bumpSortOrder(id: string, delta: number) {
    setError(null);
    if (reordering) return;

    const normalized = normalizeFrames(frames);
    const idx = normalized.findIndex((f) => f.id === id);
    if (idx === -1) return;

    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= normalized.length) return;

    const reordered = [...normalized];
    const temp = reordered[idx];
    reordered[idx] = reordered[swapIdx];
    reordered[swapIdx] = temp;

    const finalList = reordered.map((f, i) => ({ ...f, sort_order: i }));

    setFrames(finalList);
    setReordering(true);

    try {
      await Promise.all(
        finalList.map((f) =>
          supabase.from("photo_booth_frames").update({ sort_order: f.sort_order }).eq("id", f.id)
        )
      );

      void logDashboardEvent({
        action: "update",
        entity: "photo_booth_frames",
        entityId: id,
        details: { reorder: true, direction: delta < 0 ? "up" : "down" },
      });
    } catch (e) {
      console.error(e);
      setError("Failed to update frame order. Refresh and try again.");
      await fetchFrames();
    } finally {
      setReordering(false);
    }
  }

  async function reprocessExistingOverlays() {
    if (processingAll) return;

    const ok = confirm(
      "Reprocess ALL existing overlays now?\n\nThis will download each overlay_path, re-encode it to 1080x1920 PNG with transparent rounded corners, and overwrite the SAME file in Storage."
    );
    if (!ok) return;

    setProcessingAll(true);
    setError(null);

    try {
      const withPaths = frames.filter((f) => !!f.overlay_path);

      for (const frame of withPaths) {
        const path = frame.overlay_path;

        const { data, error } = await supabase.storage.from(FRAME_BUCKET).download(path);
        if (error || !data) {
          console.warn("[reprocess] download failed", path, error);
          continue;
        }

        const processed = await processOverlayToTargetPng(data);
        await uploadOverlayPng(path, processed);

        // touch updated_at so it reflects change (no UI change required)
        await supabase
          .from("photo_booth_frames")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", frame.id);
      }

      void logDashboardEvent({
        action: "update",
        entity: "photo_booth_frames",
        entityId: null,
        details: {
          bulkReprocess: true,
          count: withPaths.length,
          target: `${TARGET_W}x${TARGET_H}`,
          roundedCornersPx: TARGET_RADIUS_PX,
        },
      });

      await fetchFrames();
      alert("Done. Existing overlays were reprocessed (best-effort).");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Reprocess failed.");
    } finally {
      setProcessingAll(false);
    }
  }

  return (
    <DashboardShell
      title="Photo booth"
      subtitle="Manage overlays used by the mobile Photo Booth (9:16)."
      activeTab="photo-booth"
    >
      <div className="space-y-4">
        <header className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Overlays / Frames</h2>
            <p className="text-xs text-slate-600">
              Upload overlays as PNG/JPG. We automatically normalize to{" "}
              <span className="font-semibold">{TARGET_W}×{TARGET_H} PNG</span>{" "}
              and apply rounded transparent corners (prevents white corner artifacts in the app).
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Corner mask radius: ~{TARGET_RADIUS_PX}px (scaled from app preview borderRadius: 24).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void reprocessExistingOverlays()}
              disabled={processingAll || loading}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              title="Re-encode all existing overlays to remove corner artifacts"
            >
              {processingAll ? "Reprocessing…" : "Reprocess existing overlays"}
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/40 hover:bg-sky-400"
            >
              + Add overlay
            </button>
          </div>
        </header>

        {error && !modalOpen && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-slate-900">All overlays</h3>
            {loading && (
              <span className="text-xs uppercase tracking-wide text-slate-500">Loading…</span>
            )}
          </div>

          {frames.length === 0 && !loading ? (
            <p className="text-sm text-slate-600">
              No overlays yet. Use “Add overlay” to create your first one.
            </p>
          ) : (
            <ul className="space-y-3">
              {frames.map((frame, i) => {
                const overlayUrl = getOverlayPublicUrl(frame.overlay_path);
                return (
                  <li
                    key={frame.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {overlayUrl ? (
                        <div
                          className="flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white"
                          style={{ width: 64, height: 96 }}
                          title="Preview (9:16)"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={overlayUrl}
                            alt={frame.label}
                            className="h-full w-full object-cover"
                            style={{ opacity: frame.overlay_opacity ?? 1.0 }}
                          />
                        </div>
                      ) : (
                        <div
                          className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-[10px] text-slate-400"
                          style={{ width: 64, height: 96 }}
                        >
                          No overlay
                        </div>
                      )}

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">{frame.label}</span>
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                            {frame.key}
                          </span>
                          {!frame.is_active && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                              Inactive
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600">
                          Order: {frame.sort_order} · Opacity:{" "}
                          {typeof frame.overlay_opacity === "number"
                            ? Number(frame.overlay_opacity).toFixed(2)
                            : "1.00"}
                        </p>

                        <p className="mt-0.5 text-[11px] text-slate-500">{frame.overlay_path}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => void bumpSortOrder(frame.id, -1)}
                        disabled={i === 0 || reordering}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => void bumpSortOrder(frame.id, +1)}
                        disabled={i === frames.length - 1 || reordering}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                        title="Move down"
                      >
                        ↓
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(frame)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDelete(frame.id)}
                        disabled={deletingId === frame.id}
                        className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        {deletingId === frame.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {isEditing ? "Edit overlay" : "Add overlay"}
                </h2>
                <p className="text-xs text-slate-600">
                  Upload any image — we auto-normalize to{" "}
                  <span className="font-semibold">{TARGET_W}×{TARGET_H} PNG</span>{" "}
                  and apply rounded transparent corners.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Key</label>
                  <input
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.key}
                    onChange={(e) => handleInputChange("key", e.target.value)}
                    placeholder="live-mic"
                  />
                  <p className="text-[11px] text-slate-500">
                    Saved as: <span className="font-medium">{sanitizeKey(form.key) || "—"}</span>
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Label</label>
                  <input
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.label}
                    onChange={(e) => handleInputChange("label", e.target.value)}
                    placeholder="Live Mic"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Sort order</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.sort_order}
                    onChange={(e) => handleInputChange("sort_order", Number(e.target.value))}
                    placeholder="0"
                  />
                  <p className="text-[11px] text-slate-500">Lower numbers show first in the app.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Opacity</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    max="1"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.overlay_opacity}
                    onChange={(e) => handleInputChange("overlay_opacity", Number(e.target.value))}
                  />
                  <p className="text-[11px] text-slate-500">0.05–1.00 (app uses this value).</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Status</label>
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-500"
                      checked={form.is_active}
                      onChange={(e) => handleInputChange("is_active", e.target.checked)}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-[220px]">
                    <p className="text-xs font-semibold text-slate-800">Overlay image (PNG/JPG)</p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Auto-normalized to {TARGET_W}×{TARGET_H} PNG with rounded transparent corners.
                    </p>

                    <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                      Choose file…
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void onPickOverlay(e.target.files?.[0] ?? null)}
                      />
                    </label>

                    <p className="mt-2 text-[11px] text-slate-500">
                      {form.overlayFile
                        ? `Selected: ${form.overlayFile.name}`
                        : form.overlay_path
                        ? `Current: ${form.overlay_path}`
                        : "No file selected yet"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-2xl border border-slate-200 bg-white"
                      style={{ width: 112, height: 200, borderRadius: 16, overflow: "hidden" }}
                      title="Preview (9:16)"
                    >
                      {(() => {
                        const src = overlayPreviewUrl ?? getOverlayPublicUrl(form.overlay_path);
                        if (!src) {
                          return (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                              No overlay
                            </div>
                          );
                        }
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt="Overlay preview"
                            className="h-full w-full object-cover"
                            style={{ opacity: form.overlay_opacity }}
                          />
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-sky-500/40 hover:bg-sky-400 disabled:opacity-60"
                >
                  {saving ? (isEditing ? "Saving…" : "Creating…") : isEditing ? "Save changes" : "Create overlay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
