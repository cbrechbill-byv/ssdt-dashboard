"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import DashboardShell from "@/components/layout/DashboardShell";

type FrameRow = {
  id: string;
  frame_key: string | null;
  label: string;
  description: string | null;
  season_tag: string | null;
  sponsor_id: string | null;
  overlay_opacity: number;
  sort_order: number;
  is_active: boolean;
  overlay_path: string | null;
  // we don't actually use "key" in the UI, but it's in the table
  // so it's fine if it exists there as well
};

type FrameFormState = {
  id?: string;
  frame_key: string;
  label: string;
  description: string;
  season_tag: string;
  sponsor_id: string;
  overlay_opacity: number;
  sort_order: number;
  is_active: boolean;
  overlay_path?: string | null;
  overlayFile?: File | null;
};

const EMPTY_FRAME: FrameFormState = {
  frame_key: "",
  label: "",
  description: "",
  season_tag: "",
  sponsor_id: "",
  overlay_opacity: 1,
  sort_order: 0,
  is_active: true,
  overlay_path: null,
  overlayFile: null,
};

const FRAME_BUCKET = "photo-booth-overlays";

function getOverlayPublicUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data } = supabase.storage.from(FRAME_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/**
 * Normalize a raw string into a safe frame key:
 * - lowercase
 * - whitespace -> hyphens
 * - strip emojis/symbols (keep only a–z, 0–9, and hyphens)
 * - collapse duplicate hyphens
 * - trim leading/trailing hyphens
 */
function sanitizeFrameKey(raw: string): string {
  if (!raw) return "";

  const lower = raw.toLowerCase();
  const withHyphens = lower.replace(/\s+/g, "-");
  const alnumHyphenOnly = withHyphens.replace(/[^a-z0-9-]/g, "");
  const collapsed = alnumHyphenOnly.replace(/-+/g, "-");
  const trimmed = collapsed.replace(/^-+|-+$/g, "");
  return trimmed;
}

export default function PhotoBoothFramesPage() {
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FrameFormState>(EMPTY_FRAME);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [frameKeyTouched, setFrameKeyTouched] = useState(false);
  const [frameKeyWarning, setFrameKeyWarning] = useState<string | null>(null);

  // Whether the key should be locked (readonly)
  const [isKeyLocked, setIsKeyLocked] = useState(false);

  useEffect(() => {
    void fetchFrames();
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

    setFrames((data || []) as FrameRow[]);
    setLoading(false);
  }

  function openCreateModal() {
    setForm(EMPTY_FRAME);
    setIsEditing(false);
    setError(null);
    setFrameKeyTouched(false);
    setFrameKeyWarning(null);
    setIsKeyLocked(false); // new frames: key is editable
    setModalOpen(true);
  }

  function openEditModal(frame: FrameRow) {
    setIsEditing(true);
    setError(null);
    setFrameKeyWarning(null);

    const hasKey = !!frame.frame_key;
    const effectiveKey = hasKey
      ? frame.frame_key || ""
      : sanitizeFrameKey(frame.label || "");

    setIsKeyLocked(hasKey);
    setFrameKeyTouched(hasKey);

    setForm({
      id: frame.id,
      frame_key: effectiveKey,
      label: frame.label,
      description: frame.description || "",
      season_tag: frame.season_tag || "",
      sponsor_id: frame.sponsor_id || "",
      overlay_opacity: frame.overlay_opacity,
      sort_order: frame.sort_order,
      is_active: frame.is_active,
      overlay_path: frame.overlay_path,
      overlayFile: null,
    });

    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSaving(false);
  }

  function onFieldChange<K extends keyof FrameFormState>(
    key: K,
    value: FrameFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * Check uniqueness only against the already loaded frames in state.
   */
  async function checkFrameKeyUniqueness(
    cleanKey: string,
    currentId?: string
  ): Promise<boolean> {
    setFrameKeyWarning(null);

    if (!cleanKey) return false;

    const conflict = frames.find(
      (f) =>
        f.frame_key === cleanKey &&
        (currentId ? f.id !== currentId : true)
    );

    if (!conflict) {
      return true;
    }

    const conflictLabel = conflict.label || "another frame";
    setFrameKeyWarning(
      `This frame key is already used by "${conflictLabel}". Please choose a different key.`
    );
    return false;
  }

  async function uploadOverlayIfNeeded(
    file?: File | null
  ): Promise<string | null | undefined> {
    if (!file) return form.overlay_path ?? null;

    const originalName = file.name || "overlay.png";
    const ext = originalName.includes(".")
      ? originalName.split(".").pop() || "png"
      : "png";
    const base = originalName
      .replace(/\.[^/.]+$/, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    const filename = `${base}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(FRAME_BUCKET)
      .upload(filename, file, { upsert: true });

    if (error) {
      console.error(error);
      throw new Error(error.message || "Failed to upload overlay image");
    }

    return filename;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!form.label.trim()) {
        throw new Error("Label is required.");
      }

      const cleanKey = sanitizeFrameKey(form.frame_key);
      if (!cleanKey) {
        throw new Error(
          "Frame key is required. After sanitizing, it cannot be empty."
        );
      }

      setForm((prev) => ({ ...prev, frame_key: cleanKey }));

      const isUnique = await checkFrameKeyUniqueness(cleanKey, form.id);
      if (!isUnique) {
        throw new Error("Frame key must be unique.");
      }

      const overlay_path = await uploadOverlayIfNeeded(form.overlayFile);

      const payload = {
        frame_key: cleanKey,
        // 🔑 keep legacy "key" column satisfied & in sync
        key: cleanKey,
        label: form.label.trim(),
        description: form.description || null,
        season_tag: form.season_tag || null,
        sponsor_id: form.sponsor_id || null,
        overlay_opacity: form.overlay_opacity,
        sort_order: form.sort_order,
        is_active: form.is_active,
        overlay_path: overlay_path ?? null,
      };

      if (form.id) {
        const { error } = await supabase
          .from("photo_booth_frames")
          .update(payload)
          .eq("id", form.id);

        if (error) {
          console.error(error);
          throw new Error(error.message || "Failed to save frame");
        }
      } else {
        const { error } = await supabase
          .from("photo_booth_frames")
          .insert(payload);

        if (error) {
          console.error(error);
          throw new Error(error.message || "Failed to create frame");
        }
      }

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

    try {
      const { error } = await supabase
        .from("photo_booth_frames")
        .delete()
        .eq("id", id);

      if (error) {
        console.error(error);
        throw new Error(error.message || "Failed to delete frame");
      }

      await fetchFrames();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error deleting frame");
    } finally {
      setDeletingId(null);
    }
  }

  function handleLabelChange(value: string) {
    onFieldChange("label", value);

    if (isKeyLocked) return;

    if (!frameKeyTouched) {
      const autoKey = sanitizeFrameKey(value);
      onFieldChange("frame_key", autoKey);
      setFrameKeyWarning(null);
    }
  }

  function handleFrameKeyChange(value: string) {
    setFrameKeyTouched(true);
    const cleaned = sanitizeFrameKey(value);
    onFieldChange("frame_key", cleaned);
    setFrameKeyWarning(null);
  }

  async function handleFrameKeyBlur() {
    const cleanKey = sanitizeFrameKey(form.frame_key);
    onFieldChange("frame_key", cleanKey);
    if (!cleanKey) return;
    await checkFrameKeyUniqueness(cleanKey, form.id);
  }

  const currentOverlayUrl = getOverlayPublicUrl(form.overlay_path ?? null);

  return (
    <DashboardShell
      title="Photo Booth — Frames"
      subtitle="Manage overlays used by the mobile Photo Booth."
      activeTab="photo-booth"
    >
      <div className="space-y-4">
        {/* Header card */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Photo booth overlays
            </p>
            <p className="text-xs text-slate-600">
              The app draws the guest photo first, then this PNG overlay, then
              LIVE TONIGHT / artist / @sugarshackdowntown text.
            </p>
            {frames.length > 0 && (
              <p className="text-[11px] text-slate-500">
                {frames.length} frame
                {frames.length === 1 ? "" : "s"} configured.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:bg-amber-300"
          >
            + Add frame
          </button>
        </div>

        {/* List card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                All frames
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Larger previews, click thumbnail to open full overlay in a new
                tab.
              </p>
            </div>
            {loading && (
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                Loading…
              </span>
            )}
          </div>

          {error && !modalOpen && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {frames.length === 0 && !loading ? (
            <p className="text-sm text-slate-500">
              No frames yet. Use <span className="font-semibold">Add frame</span>{" "}
              to create your first overlay.
            </p>
          ) : null}

          {frames.length > 0 && (
            <ul className="space-y-3">
              {frames.map((frame, index) => {
                const overlayUrl = getOverlayPublicUrl(frame.overlay_path);
                const rowBg =
                  index % 2 === 0 ? "bg-white" : "bg-slate-50/60";

                return (
                  <li
                    key={frame.id}
                    className={`flex flex-col gap-3 rounded-xl border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between ${rowBg} hover:bg-amber-50/60 transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        {overlayUrl ? (
                          <a
                            href={overlayUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block h-full w-full"
                            title="Open full overlay in new tab"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={overlayUrl}
                              alt={frame.label}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            No preview
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {frame.label}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                            {frame.frame_key || "no-key"}
                          </span>
                          {!frame.is_active && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              Inactive
                            </span>
                          )}
                        </div>

                        {frame.description && (
                          <p className="mt-1 text-xs text-slate-600">
                            {frame.description}
                          </p>
                        )}

                        <p className="mt-1 text-[11px] text-slate-500">
                          Order: {frame.sort_order} · Opacity:{" "}
                          {frame.overlay_opacity.toFixed(2)}
                          {frame.season_tag && ` · ${frame.season_tag}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(frame)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-amber-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(frame.id)}
                        disabled={deletingId === frame.id}
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {isEditing ? "Edit frame" : "Add frame"}
                </h2>
                <p className="text-xs text-slate-600">
                  Upload a 1080×1920 PNG with transparency. The app will always
                  draw the guest photo first, then this overlay.
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

            {isEditing && currentOverlayUrl && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Current overlay
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-24 w-40 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentOverlayUrl}
                      alt={form.label || "Current overlay"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <a
                    href={currentOverlayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-sky-600 hover:underline"
                  >
                    Open full overlay in new tab
                  </a>
                </div>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">
                  Frame key
                </label>
                <input
                  required
                  value={form.frame_key}
                  onChange={
                    isKeyLocked
                      ? undefined
                      : (e) => handleFrameKeyChange(e.target.value)
                  }
                  onBlur={isKeyLocked ? undefined : handleFrameKeyBlur}
                  placeholder="miami-vice, rock-n-roll…"
                  readOnly={isKeyLocked}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  For new frames, this auto-generates from the label. Lowercase,
                  hyphens only (a–z, 0–9, -). Must be unique. Existing keys are
                  locked to avoid breaking the app.
                </p>
                {frameKeyWarning && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    {frameKeyWarning}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">
                  Label
                </label>
                <input
                  required
                  value={form.label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="Miami Vice"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    onFieldChange("description", e.target.value)
                  }
                  placeholder="Bright neon pastel overlay"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    Season tag (optional)
                  </label>
                  <input
                    value={form.season_tag}
                    onChange={(e) =>
                      onFieldChange("season_tag", e.target.value)
                    }
                    placeholder="summer, holiday, VIP night…"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    Sort order
                  </label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) =>
                      onFieldChange("sort_order", Number(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    Overlay opacity (0–1)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={form.overlay_opacity}
                    onChange={(e) =>
                      onFieldChange(
                        "overlay_opacity",
                        Number(e.target.value) || 0
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    Active
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        onFieldChange("is_active", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-sky-500"
                    />
                    <span className="text-xs text-slate-600">
                      Show this frame in the app
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-3">
                <div className="space-y-1 text-left">
                  <p className="text-xs font-semibold text-slate-800">
                    Overlay PNG
                  </p>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                    Choose file…
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        onFieldChange(
                          "overlayFile",
                          e.target.files?.[0] ?? null
                        )
                      }
                    />
                  </label>
                  <p className="text-[11px] text-slate-500">
                    {form.overlayFile
                      ? `Selected: ${form.overlayFile.name}`
                      : form.overlay_path
                      ? `Current: ${form.overlay_path}`
                      : "No file selected yet"}
                  </p>
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
                  {saving
                    ? isEditing
                      ? "Saving…"
                      : "Creating…"
                    : isEditing
                    ? "Save changes"
                    : "Create frame"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
