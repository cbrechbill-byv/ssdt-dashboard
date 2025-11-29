"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type Sponsor = {
  id: string;
  name: string;
};

type Frame = {
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
  created_at: string;
  updated_at: string;
};

type FormState = {
  id?: string;
  key: string;
  label: string;
  description: string;
  overlayFile?: File | null;
  overlay_path?: string;
  overlay_opacity: number;
  is_active: boolean;
  sort_order: number;
  season_tag: string;
  sponsor_id: string;
};

const EMPTY_FORM: FormState = {
  key: "",
  label: "",
  description: "",
  overlayFile: undefined,
  overlay_path: undefined,
  overlay_opacity: 1.0,
  is_active: true,
  sort_order: 0,
  season_tag: "",
  sponsor_id: "",
};

const FRAME_BUCKET = "photo-booth-overlays";

function getOverlayPublicUrl(overlay_path: string | undefined) {
  if (!overlay_path) return null;
  const { data } = supabase.storage.from(FRAME_BUCKET).getPublicUrl(overlay_path);
  return data?.publicUrl ?? null;
}

export default function FramesPage() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    void Promise.all([fetchFrames(), fetchSponsors()]);
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
      setError("Failed to load frames.");
      setLoading(false);
      return;
    }

    setFrames(data || []);
    setLoading(false);
  }

  async function fetchSponsors() {
    const { data, error } = await supabase
      .from("sponsors")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setSponsors(data || []);
  }

  function openCreateModal() {
    setForm(EMPTY_FORM);
    setIsEditing(false);
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(frame: Frame) {
    setIsEditing(true);
    setError(null);
    setForm({
      id: frame.id,
      key: frame.key,
      label: frame.label,
      description: frame.description ?? "",
      overlayFile: undefined,
      overlay_path: frame.overlay_path,
      overlay_opacity: frame.overlay_opacity ?? 1.0,
      is_active: frame.is_active,
      sort_order: frame.sort_order ?? 0,
      season_tag: frame.season_tag ?? "",
      sponsor_id: frame.sponsor_id ?? "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSaving(false);
  }

  function handleInputChange<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function uploadOverlayIfNeeded(
    frameId: string,
    file?: File | null
  ): Promise<string | undefined> {
    if (!file) return form.overlay_path;

    const ext = file.name.split(".").pop() || "png";
    const fileName = `${frameId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(FRAME_BUCKET)
      .upload(fileName, file, {
        upsert: true,
      });

    if (uploadError) {
      console.error(uploadError);
      throw new Error("Failed to upload overlay");
    }

    return fileName;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!form.key.trim()) throw new Error("Frame key is required");
      if (!form.label.trim()) throw new Error("Frame label is required");

      let frameId = form.id;

      // If new frame, insert first to get ID
      if (!frameId) {
        const { data, error } = await supabase
          .from("photo_booth_frames")
          .insert({
            key: form.key,
            label: form.label,
            description: form.description || null,
            overlay_path: form.overlay_path || "placeholder",
            overlay_opacity: form.overlay_opacity,
            is_active: form.is_active,
            sort_order: form.sort_order,
            season_tag: form.season_tag || null,
            sponsor_id: form.sponsor_id || null,
          })
          .select("*")
          .single();

        if (error || !data) {
          console.error(error);
          throw new Error("Failed to create frame");
        }

        frameId = data.id;
      }

      // Upload overlay file if a new one was chosen
      const overlay_path = await uploadOverlayIfNeeded(
        frameId,
        form.overlayFile
      );

      // Final update
      const { error: updateError } = await supabase
        .from("photo_booth_frames")
        .update({
          key: form.key,
          label: form.label,
          description: form.description || null,
          overlay_path: overlay_path || form.overlay_path || "placeholder",
          overlay_opacity: form.overlay_opacity,
          is_active: form.is_active,
          sort_order: form.sort_order,
          season_tag: form.season_tag || null,
          sponsor_id: form.sponsor_id || null,
        })
        .eq("id", frameId);

      if (updateError) {
        console.error(updateError);
        throw new Error("Failed to save frame");
      }

      await fetchFrames();
      closeModal();
    } catch (err: any) {
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
        throw new Error("Failed to delete frame");
      }

      await fetchFrames();
    } catch (err: any) {
      setError(err.message || "Error deleting frame");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Photo Booth — Frames
            </h1>
            <p className="text-sm text-slate-400">
              Manage overlays used by the mobile Photo Booth. The app always
              draws the user photo first, then the overlay PNG, then{" "}
              <span className="font-semibold">LIVE TONIGHT / Artist</span> and{" "}
              <span className="font-semibold">@sugarshackdowntown</span> on
              top.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/40 hover:bg-sky-400"
          >
            + Add Frame
          </button>
        </header>

        {error && !modalOpen && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm shadow-black/30">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-100">
              All Frames
            </h2>
            {loading && (
              <span className="text-xs uppercase tracking-wide text-slate-400">
                Loading…
              </span>
            )}
          </div>

          {frames.length === 0 && !loading ? (
            <p className="text-sm text-slate-400">
              No frames yet. Use “Add Frame” to create your first overlay.
            </p>
          ) : (
            <ul className="space-y-3">
              {frames.map((frame) => {
                const overlayUrl = getOverlayPublicUrl(frame.overlay_path);
                const sponsorName =
                  sponsors.find((s) => s.id === frame.sponsor_id)?.name ?? null;

                return (
                  <li
                    key={frame.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {overlayUrl ? (
                        <div className="relative h-16 w-28 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                          <img
                            src={overlayUrl}
                            alt={frame.label}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-dashed border-slate-600 bg-slate-900 text-[10px] text-slate-400">
                          No overlay
                        </div>
                      )}

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-50">
                            {frame.label}
                          </span>
                          {!frame.is_active && (
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                              Inactive
                            </span>
                          )}
                          {frame.season_tag && (
                            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                              {frame.season_tag}
                            </span>
                          )}
                          {sponsorName && (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                              {sponsorName}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-400">
                          Key: <code>{frame.key}</code> · Order:{" "}
                          {frame.sort_order} · Opacity:{" "}
                          {frame.overlay_opacity.toFixed(2)}
                        </p>
                        {frame.description && (
                          <p className="mt-1 text-xs text-slate-400">
                            {frame.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(frame)}
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(frame.id)}
                        disabled={deletingId === frame.id}
                        className="rounded-lg border border-red-500/70 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/20 disabled:opacity-60"
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl border border-slate-700 bg-slate-900 px-5 py-6 shadow-xl shadow-black/60">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">
                  {isEditing ? "Edit Frame" : "Add Frame"}
                </h2>
                <p className="text-xs text-slate-400">
                  Season Tag is optional and currently used only for grouping in
                  this dashboard. Overlay opacity is advanced; leave it at{" "}
                  <code>1</code> unless you want the PNG to be semi-transparent.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-200">
                  Frame Key
                </label>
                <input
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  value={form.key}
                  onChange={(e) => handleInputChange("key", e.target.value)}
                  placeholder="live-mic, neon-nights…"
                />
                <p className="text-[11px] text-slate-400">
                  Short, unique ID used by the app to pick a frame.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-200">
                  Label
                </label>
                <input
                  required
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  value={form.label}
                  onChange={(e) => handleInputChange("label", e.target.value)}
                  placeholder="Neon Nights, VIP Lounge…"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-200">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  value={form.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Gold confetti VIP celebration frame…"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-200">
                    Season Tag (optional)
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.season_tag}
                    onChange={(e) =>
                      handleInputChange("season_tag", e.target.value)
                    }
                    placeholder="summer, holiday, halloween…"
                  />
                  <p className="text-[11px] text-slate-400">
                    For grouping in the dashboard. The mobile app doesn&apos;t
                    use this yet.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-200">
                    Sponsor (optional)
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.sponsor_id}
                    onChange={(e) =>
                      handleInputChange("sponsor_id", e.target.value)
                    }
                  >
                    <option value="">No sponsor</option>
                    {sponsors.map((sponsor) => (
                      <option key={sponsor.id} value={sponsor.id}>
                        {sponsor.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-200">
                    Overlay Opacity (advanced)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.overlay_opacity}
                    onChange={(e) =>
                      handleInputChange(
                        "overlay_opacity",
                        Number(e.target.value)
                      )
                    }
                  />
                  <p className="text-[11px] text-slate-400">
                    1 = fully solid PNG. Lower values make the overlay more
                    see-through over the user photo.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-200">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.sort_order}
                    onChange={(e) =>
                      handleInputChange("sort_order", Number(e.target.value))
                    }
                  />
                  <p className="text-[11px] text-slate-400">
                    Lower numbers appear first in the app.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-700 pt-3">
                <label className="inline-flex items-center gap-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500"
                    checked={form.is_active}
                    onChange={(e) =>
                      handleInputChange("is_active", e.target.checked)
                    }
                  />
                  Active
                </label>

                <div className="space-y-1 text-right">
                  <p className="text-xs font-semibold text-slate-200">
                    Overlay Image (PNG)
                  </p>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-500 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-50 hover:bg-slate-700">
                    Choose File…
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleInputChange(
                          "overlayFile",
                          e.target.files?.[0] ?? undefined
                        )
                      }
                    />
                  </label>
                  <p className="text-[11px] text-slate-400">
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
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
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
                    ? "Save Changes"
                    : "Create Frame"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
