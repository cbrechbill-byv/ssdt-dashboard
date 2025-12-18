// app/photo-booth/sponsors/page.tsx
// Path: /photo-booth/sponsors
// Dashboard: Sponsors (manage name, tier, order, and logos)
//
// Goal (no app code changes):
// - Sponsors list (64x64 circle on black bg) must show black logos
// - Sponsor detail hero must show a LARGE, clean logo (not tiny)
//
// Fix approach:
// - Auto-trim whitespace (transparent + near-white)
// - Normalize to 1024x1024 PNG (crisper for hero)
// - Scale artwork to fill more of the square (minimal padding; no distortion)
// - Add a subtle SOLID white rounded-rect "backer" behind the artwork so black logos remain visible on dark backgrounds
// - Keep UI unchanged; reprocess button re-uploads using same logic

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import DashboardShell from "@/components/layout/DashboardShell";
import { logDashboardEvent } from "@/lib/logDashboardEvent";

type Sponsor = {
  id: string;
  name: string;
  logo_path: string | null;
  website_url: string | null;
  tier: string | null;
  is_active: boolean;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  id?: string;
  name: string;
  logoFile?: File | null;
  logo_path?: string | null;
  website_url: string;
  tier: string;
  is_active: boolean;
  sort_order: number;
  start_date: string;
  end_date: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  logoFile: undefined,
  logo_path: undefined,
  website_url: "",
  tier: "",
  is_active: true,
  sort_order: 0,
  start_date: "",
  end_date: "",
  notes: "",
};

const SPONSOR_BUCKET = "sponsor-logos";

// App renders list logos at 64x64.
const LOGO_SIZE_IN_APP = 64;
const MIN_LOGO_PX = LOGO_SIZE_IN_APP * 3; // 192 (input sanity check only)
const RECOMMENDED_LOGO_PX = 256;

// ✅ Output size (bigger = cleaner hero). No app change required.
const OUTPUT_PNG_SIZE = 1024;

// ✅ Fill ratio (higher = artwork appears larger). Keep just a tiny safety margin.
const FIT_PADDING = 0.985;

// Trimming thresholds
const ALPHA_MIN = 12; // ignore near-transparent pixels
const WHITE_MIN = 248; // treat near-white pixels as background even if opaque

// ✅ Backer (so black logos show on dark UI)
// - White rounded-rect behind the logo artwork (not full square, so it still feels "logo-like")
const BACKER_ENABLED = true;
const BACKER_PADDING_MULT = 1.10; // backer a bit bigger than artwork
const BACKER_RADIUS_MULT = 0.22; // corner roundness relative to backer min dimension

function getLogoPublicUrl(logo_path: string | null | undefined) {
  if (!logo_path) return null;
  const { data } = supabase.storage.from(SPONSOR_BUCKET).getPublicUrl(logo_path);
  return data?.publicUrl ?? null;
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Could not read image dimensions"));
      img.src = url;
    });
    return dims;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeSponsors(list: Sponsor[]): Sponsor[] {
  const sorted = [...list].sort((a, b) => {
    const ao = Number(a.sort_order ?? 0);
    const bo = Number(b.sort_order ?? 0);
    if (ao !== bo) return ao - bo;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });

  return sorted.map((s, idx) => ({
    ...s,
    sort_order: idx,
  }));
}

function sanitizeBaseName(name: string) {
  return (name || "logo")
    .replace(/\.[^/.]+$/, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image for processing"));
    img.src = url;
  });
  URL.revokeObjectURL(url);
  return img;
}

function computeTrimBounds(
  imageData: ImageData,
  width: number,
  height: number
): { x: number; y: number; w: number; h: number } | null {
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  // A pixel counts as "content" if:
  // - alpha is meaningfully present, AND
  // - it's not near-white (trim white backgrounds)
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = row + x * 4;
      const a = data[i + 3];
      if (a < ALPHA_MIN) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const isNearWhite = r >= WHITE_MIN && g >= WHITE_MIN && b >= WHITE_MIN;
      if (isNearWhite) continue;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) return null;

  // small pad so we don't clip strokes
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function processLogoToSquarePng(
  originalFile: File,
  opts?: {
    size?: number;
    padding?: number;
    trim?: boolean;
    backer?: boolean;
  }
): Promise<File> {
  const size = opts?.size ?? OUTPUT_PNG_SIZE;
  const padding = opts?.padding ?? FIT_PADDING;
  const trim = opts?.trim ?? true;
  const backer = opts?.backer ?? BACKER_ENABLED;

  const img = await fileToImage(originalFile);
  const srcW = img.naturalWidth || 0;
  const srcH = img.naturalHeight || 0;
  if (!srcW || !srcH) throw new Error("Invalid image dimensions.");

  // Draw source to temp so we can read pixels for trimming
  const temp = document.createElement("canvas");
  temp.width = srcW;
  temp.height = srcH;
  const tctx = temp.getContext("2d");
  if (!tctx) throw new Error("Canvas not supported");

  tctx.clearRect(0, 0, srcW, srcH);
  tctx.imageSmoothingEnabled = true;
  // @ts-ignore
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(img, 0, 0);

  let crop = { x: 0, y: 0, w: srcW, h: srcH };
  if (trim) {
    const imageData = tctx.getImageData(0, 0, srcW, srcH);
    const bounds = computeTrimBounds(imageData, srcW, srcH);
    if (bounds) crop = bounds;
  }

  // Output canvas
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.clearRect(0, 0, size, size);

  // Fit cropped content inside nearly-full square (minimal padding for larger hero)
  const maxW = size * padding;
  const maxH = size * padding;
  const scale = Math.min(maxW / crop.w, maxH / crop.h);

  const drawW = Math.round(crop.w * scale);
  const drawH = Math.round(crop.h * scale);
  const dx = Math.round((size - drawW) / 2);
  const dy = Math.round((size - drawH) / 2);

  ctx.imageSmoothingEnabled = true;
  // @ts-ignore
  ctx.imageSmoothingQuality = "high";

  // ✅ Backer behind artwork (so black logos show on dark backgrounds)
  if (backer) {
    const bw = Math.min(size, Math.round(drawW * BACKER_PADDING_MULT));
    const bh = Math.min(size, Math.round(drawH * BACKER_PADDING_MULT));
    const bx = Math.round((size - bw) / 2);
    const by = Math.round((size - bh) / 2);
    const br = Math.round(Math.min(bw, bh) * BACKER_RADIUS_MULT);

    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    drawRoundedRect(ctx, bx, by, bw, bh, br);
    ctx.fill();
    ctx.restore();
  }

  // Artwork on top
  ctx.drawImage(temp, crop.x, crop.y, crop.w, crop.h, dx, dy, drawW, drawH);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to create PNG blob"))),
      "image/png",
      1.0
    );
  });

  const base = sanitizeBaseName(originalFile.name || "logo");
  const fileName = `${base}-${Date.now()}-${size}.png`;
  return new File([blob], fileName, { type: "image/png" });
}

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoDims, setLogoDims] = useState<{ width: number; height: number } | null>(null);

  const [previewAsMobile, setPreviewAsMobile] = useState<boolean>(true);

  // Reprocess state
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessMsg, setReprocessMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetchSponsors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchSponsors() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("sponsors")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setError("Failed to load sponsors.");
      setLoading(false);
      return;
    }

    const normalized = normalizeSponsors((data || []) as Sponsor[]);
    setSponsors(normalized);
    setLoading(false);

    // Best-effort normalize sort_order in DB
    void (async () => {
      try {
        const updates = normalized.map((s) =>
          supabase.from("sponsors").update({ sort_order: s.sort_order }).eq("id", s.id)
        );
        await Promise.all(updates);
      } catch {
        // ignore
      }
    })();
  }

  const nextSuggestedSortOrder = useMemo(() => {
    const max = sponsors.reduce((m, s) => Math.max(m, Number(s.sort_order ?? 0)), 0);
    return Number.isFinite(max) ? max + 1 : 1;
  }, [sponsors]);

  function resetPreviewState() {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(null);
    setLogoDims(null);
  }

  function openCreateModal() {
    resetPreviewState();
    setForm({ ...EMPTY_FORM, sort_order: nextSuggestedSortOrder });
    setIsEditing(false);
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(sponsor: Sponsor) {
    resetPreviewState();
    setIsEditing(true);
    setError(null);
    setForm({
      id: sponsor.id,
      name: sponsor.name,
      logoFile: undefined,
      logo_path: sponsor.logo_path,
      website_url: sponsor.website_url || "",
      tier: sponsor.tier || "",
      is_active: sponsor.is_active,
      sort_order: sponsor.sort_order ?? 0,
      start_date: sponsor.start_date ? sponsor.start_date.substring(0, 10) : "",
      end_date: sponsor.end_date ? sponsor.end_date.substring(0, 10) : "",
      notes: sponsor.notes || "",
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

  async function onPickLogo(file?: File | null) {
    handleInputChange("logoFile", file ?? undefined);

    resetPreviewState();
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setLogoPreviewUrl(preview);

    try {
      const dims = await getImageDimensions(file);
      setLogoDims(dims);
    } catch (e) {
      console.error(e);
      setLogoDims(null);
    }
  }

  async function uploadLogoIfNeeded(file?: File | null): Promise<string | null | undefined> {
    if (!file) return form.logo_path ?? null;

    // ✅ Fully automatic: trim + normalize + backer (no UI change)
    const processed = await processLogoToSquarePng(file, {
      size: OUTPUT_PNG_SIZE,
      padding: FIT_PADDING,
      trim: true,
      backer: true,
    });

    const fileName = processed.name;

    const { error: uploadError } = await supabase.storage.from(SPONSOR_BUCKET).upload(fileName, processed, {
      upsert: true,
      contentType: "image/png",
    });

    if (uploadError) {
      console.error(uploadError);
      throw new Error(uploadError.message || "Failed to upload logo");
    }

    return fileName;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!form.name.trim()) throw new Error("Sponsor name is required");

      const sortOrderNum = Number(form.sort_order);
      if (!Number.isFinite(sortOrderNum)) throw new Error("Sort order must be a number.");

      if (form.logoFile) {
        const dims = logoDims ?? (await getImageDimensions(form.logoFile));
        if (dims.width < MIN_LOGO_PX || dims.height < MIN_LOGO_PX) {
          throw new Error(
            `Logo image is too small. Please upload at least ${MIN_LOGO_PX}×${MIN_LOGO_PX}px (recommended ${RECOMMENDED_LOGO_PX}×${RECOMMENDED_LOGO_PX}px). Current: ${dims.width}×${dims.height}px.`
          );
        }
      }

      const logo_path = await uploadLogoIfNeeded(form.logoFile);

      const payload = {
        name: form.name,
        logo_path: logo_path ?? null,
        website_url: form.website_url || null,
        tier: form.tier || null,
        is_active: form.is_active,
        sort_order: sortOrderNum,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
      };

      let sponsorId: string | undefined;
      const action: "create" | "update" = form.id ? "update" : "create";

      if (form.id) {
        const { error } = await supabase.from("sponsors").update(payload).eq("id", form.id);
        if (error) throw new Error(error.message || "Failed to save sponsor");
        sponsorId = form.id;
      } else {
        const { data, error } = await supabase.from("sponsors").insert(payload).select("id").single();
        if (error) throw new Error(error.message || "Failed to create sponsor");
        sponsorId = data?.id;
      }

      void logDashboardEvent({
        action,
        entity: "sponsors",
        entityId: sponsorId,
        details: {
          name: form.name,
          tier: form.tier || null,
          is_active: form.is_active,
          sort_order: sortOrderNum,
          website_url: form.website_url || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          logo_path: logo_path ?? null,
          logo_normalized: form.logoFile
            ? { size: OUTPUT_PNG_SIZE, padding: FIT_PADDING, trim: true, backer: true }
            : null,
        },
      });

      await fetchSponsors();
      closeModal();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error saving sponsor");
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sponsor?")) return;
    setDeletingId(id);
    setError(null);

    const sponsor = sponsors.find((s) => s.id === id);

    try {
      const { error } = await supabase.from("sponsors").delete().eq("id", id);
      if (error) throw new Error(error.message || "Failed to delete sponsor");

      void logDashboardEvent({
        action: "delete",
        entity: "sponsors",
        entityId: id,
        details: sponsor
          ? {
              name: sponsor.name,
              tier: sponsor.tier,
              is_active: sponsor.is_active,
              sort_order: sponsor.sort_order,
              logo_path: sponsor.logo_path,
            }
          : { id },
      });

      await fetchSponsors();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error deleting sponsor");
    } finally {
      setDeletingId(null);
    }
  }

  async function bumpSortOrder(id: string, delta: number) {
    setError(null);
    if (reordering) return;

    const normalized = normalizeSponsors(sponsors);
    const idx = normalized.findIndex((s) => s.id === id);
    if (idx === -1) return;

    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= normalized.length) return;

    const reordered = [...normalized];
    const temp = reordered[idx];
    reordered[idx] = reordered[swapIdx];
    reordered[swapIdx] = temp;

    const finalList = reordered.map((s, i) => ({ ...s, sort_order: i }));
    setSponsors(finalList);

    setReordering(true);
    try {
      await Promise.all(
        finalList.map((s) => supabase.from("sponsors").update({ sort_order: s.sort_order }).eq("id", s.id))
      );

      void logDashboardEvent({
        action: "update",
        entity: "sponsors",
        entityId: id,
        details: { reorder: true, direction: delta < 0 ? "up" : "down" },
      });
    } catch (e) {
      console.error(e);
      setError("Failed to update sponsor order. Refresh and try again.");
      await fetchSponsors();
    } finally {
      setReordering(false);
    }
  }

  async function reprocessExistingLogos() {
    if (reprocessing) return;
    if (
      !confirm(
        "Reprocess ALL existing sponsor logos? This will re-upload normalized PNGs and update logo_path."
      )
    ) {
      return;
    }

    setReprocessing(true);
    setReprocessMsg(null);
    setError(null);

    try {
      const withLogos = sponsors.filter((s) => !!s.logo_path);

      if (withLogos.length === 0) {
        setReprocessMsg("No sponsor logos found to reprocess.");
        setReprocessing(false);
        return;
      }

      let ok = 0;
      let failed = 0;

      for (const s of withLogos) {
        try {
          if (!s.logo_path) continue;

          const { data: blob, error: dlErr } = await supabase.storage.from(SPONSOR_BUCKET).download(s.logo_path);
          if (dlErr || !blob) throw new Error(dlErr?.message || "Download failed");

          const guessedExt = (s.logo_path.split(".").pop() || "png").toLowerCase();
          const baseName = sanitizeBaseName(s.name || "logo");
          const original = new File([blob], `${baseName}.${guessedExt}`, {
            type: blob.type || "application/octet-stream",
          });

          const processed = await processLogoToSquarePng(original, {
            size: OUTPUT_PNG_SIZE,
            padding: FIT_PADDING,
            trim: true,
            backer: true,
          });

          const fileName = processed.name;

          const { error: upErr } = await supabase.storage.from(SPONSOR_BUCKET).upload(fileName, processed, {
            upsert: true,
            contentType: "image/png",
          });
          if (upErr) throw new Error(upErr.message || "Upload failed");

          const { error: dbErr } = await supabase.from("sponsors").update({ logo_path: fileName }).eq("id", s.id);
          if (dbErr) throw new Error(dbErr.message || "DB update failed");

          ok++;
        } catch (e) {
          console.error("[reprocess sponsor logo] failed", s.id, e);
          failed++;
        }
      }

      void logDashboardEvent({
        action: "update",
        entity: "sponsors",
        details: {
          reprocess_existing_logos: true,
          output: { size: OUTPUT_PNG_SIZE, padding: FIT_PADDING, trim: true, backer: true },
          results: { ok, failed },
        },
      });

      await fetchSponsors();
      setReprocessMsg(`Reprocess complete: ${ok} updated, ${failed} failed.`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to reprocess logos.");
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <DashboardShell title="Sponsors" subtitle="Manage sponsor names, tiers, order, and logos." activeTab="sponsors">
      <div className="space-y-4">
        <header className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Sponsors</h2>
            <p className="text-xs text-slate-600">
              Tip: logos should be at least{" "}
              <span className="font-semibold">
                {MIN_LOGO_PX}×{MIN_LOGO_PX}px
              </span>{" "}
              (recommended{" "}
              <span className="font-semibold">
                {RECOMMENDED_LOGO_PX}×{RECOMMENDED_LOGO_PX}px
              </span>
              ) for crisp mobile quality (app renders at {LOGO_SIZE_IN_APP}×{LOGO_SIZE_IN_APP}). Uploads are auto-trimmed and normalized to {OUTPUT_PNG_SIZE}px PNG with a white backer so black logos stay visible.
            </p>

            <div className="mt-2 flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-500"
                  checked={previewAsMobile}
                  onChange={(e) => setPreviewAsMobile(e.target.checked)}
                />
                Preview logos as mobile (64×64)
              </label>
              <span className="text-[11px] text-slate-500">
                {previewAsMobile ? "Showing mobile size preview." : "Showing larger dashboard preview."}
              </span>
              {reordering && <span className="text-[11px] text-slate-500">Updating order…</span>}
              {reprocessing && <span className="text-[11px] text-slate-500">Reprocessing logos…</span>}
            </div>

            {reprocessMsg && <div className="mt-2 text-[11px] text-slate-600">{reprocessMsg}</div>}
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => void reprocessExistingLogos()}
              disabled={reprocessing || loading || sponsors.length === 0}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              title="Auto-trim + normalize + backer all existing sponsor logos"
            >
              {reprocessing ? "Reprocessing…" : "Reprocess existing logos"}
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/40 hover:bg-sky-400"
            >
              + Add sponsor
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
            <h3 className="text-base font-semibold text-slate-900">All sponsors</h3>
            {loading && <span className="text-xs uppercase tracking-wide text-slate-500">Loading…</span>}
          </div>

          {sponsors.length === 0 && !loading ? (
            <p className="text-sm text-slate-600">No sponsors yet. Use “Add sponsor” to create your first sponsor.</p>
          ) : (
            <ul className="space-y-3">
              {sponsors.map((sponsor, i) => {
                const logoUrl = getLogoPublicUrl(sponsor.logo_path);
                const logoBoxSize = previewAsMobile ? 64 : 80;
                const imgPad = previewAsMobile ? "p-2" : "p-3";

                return (
                  <li
                    key={sponsor.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        <div
                          className="flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white"
                          style={{
                            width: logoBoxSize,
                            height: logoBoxSize,
                            backgroundImage:
                              "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
                            backgroundSize: "16px 16px",
                            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                          }}
                          title={previewAsMobile ? "Mobile preview (64×64)" : "Dashboard preview"}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={logoUrl} alt={sponsor.name} className={cn("h-full w-full object-contain", imgPad)} />
                        </div>
                      ) : (
                        <div
                          className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-[10px] text-slate-400"
                          style={{ width: logoBoxSize, height: logoBoxSize }}
                        >
                          No logo
                        </div>
                      )}

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">{sponsor.name}</span>
                          {sponsor.tier && (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                              {sponsor.tier}
                            </span>
                          )}
                          {!sponsor.is_active && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                              Inactive
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600">
                          Order: {sponsor.sort_order}
                          {sponsor.website_url && (
                            <>
                              {" "}
                              ·{" "}
                              <a
                                href={sponsor.website_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-600 underline-offset-2 hover:underline"
                              >
                                {sponsor.website_url}
                              </a>
                            </>
                          )}
                        </p>

                        {(sponsor.start_date || sponsor.end_date) && (
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {sponsor.start_date && `Start: ${sponsor.start_date.substring(0, 10)}`}
                            {sponsor.start_date && sponsor.end_date && " · "}
                            {sponsor.end_date && `End: ${sponsor.end_date.substring(0, 10)}`}
                          </p>
                        )}

                        {sponsor.notes && <p className="mt-1 text-xs text-slate-600">{sponsor.notes}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => void bumpSortOrder(sponsor.id, -1)}
                        disabled={i === 0 || reordering}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => void bumpSortOrder(sponsor.id, +1)}
                        disabled={i === sponsors.length - 1 || reordering}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                        title="Move down"
                      >
                        ↓
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(sponsor)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDelete(sponsor.id)}
                        disabled={deletingId === sponsor.id}
                        className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        {deletingId === sponsor.id ? "Deleting…" : "Delete"}
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
                <h2 className="text-lg font-semibold text-slate-900">{isEditing ? "Edit sponsor" : "Add sponsor"}</h2>
                <p className="text-xs text-slate-600">
                  App list uses a 64×64 circle on a dark background. Uploads are auto-trimmed, normalized to {OUTPUT_PNG_SIZE}px PNG,
                  and get a white backer so black logos stay visible while still looking clean in the sponsor hero.
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
              <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Sponsor name</label>
                <input
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  value={form.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Bud Light, local brewery, brand partner…"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Tier (optional)</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.tier}
                    onChange={(e) => handleInputChange("tier", e.target.value)}
                    placeholder="Stage, Platinum, Gold…"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Website URL (optional)</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.website_url}
                    onChange={(e) => handleInputChange("website_url", e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Sponsor order (sort_order)</label>
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
                  <label className="text-xs font-semibold text-slate-800">Status</label>
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-500"
                      checked={form.is_active}
                      onChange={(e) => handleInputChange("is_active", e.target.checked)}
                    />
                    Active sponsor
                  </label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Start date (optional)</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.start_date}
                    onChange={(e) => handleInputChange("start_date", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">End date (optional)</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.end_date}
                    onChange={(e) => handleInputChange("end_date", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Notes (internal)</label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  value={form.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Anything you want to remember about this sponsor."
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-[220px]">
                    <p className="text-xs font-semibold text-slate-800">Logo image (PNG/JPG)</p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Minimum: {MIN_LOGO_PX}×{MIN_LOGO_PX}px (recommended {RECOMMENDED_LOGO_PX}×{RECOMMENDED_LOGO_PX}px). Uploads auto-trim and normalize.
                    </p>

                    <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                      Choose file…
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => void onPickLogo(e.target.files?.[0] ?? null)} />
                    </label>

                    <p className="mt-2 text-[11px] text-slate-500">
                      {form.logoFile ? `Selected: ${form.logoFile.name}` : form.logo_path ? `Current: ${form.logo_path}` : "No file selected yet"}
                    </p>

                    {logoDims &&
                      (() => {
                        const tooSmall = logoDims.width < MIN_LOGO_PX || logoDims.height < MIN_LOGO_PX;
                        const recommended = logoDims.width >= RECOMMENDED_LOGO_PX && logoDims.height >= RECOMMENDED_LOGO_PX;

                        return (
                          <p className={cn("mt-1 text-[11px]", tooSmall ? "text-rose-700" : recommended ? "text-emerald-700" : "text-green-700")}>
                            {logoDims.width}×{logoDims.height}px {tooSmall ? "— too small" : recommended ? "— recommended" : "— OK"}
                          </p>
                        );
                      })()}
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-2xl border border-slate-200 bg-white p-3"
                      style={{
                        width: previewAsMobile ? 96 : 112,
                        height: previewAsMobile ? 96 : 112,
                        backgroundImage:
                          "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
                        backgroundSize: "18px 18px",
                        backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0px",
                      }}
                      title="Preview (checkerboard)"
                    >
                      {(() => {
                        const src = logoPreviewUrl ?? getLogoPublicUrl(form.logo_path);
                        if (!src) return <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">No logo</div>;
                        // eslint-disable-next-line @next/next/no-img-element
                        return <img src={src} alt="Logo preview" className="h-full w-full object-contain" />;
                      })()}
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="rounded-full border border-slate-300 bg-slate-950"
                        style={{ width: LOGO_SIZE_IN_APP + 12, height: LOGO_SIZE_IN_APP + 12, padding: 6 }}
                        title="Mobile render (approx)"
                      >
                        {(() => {
                          const src = logoPreviewUrl ?? getLogoPublicUrl(form.logo_path);
                          if (!src) return null;
                          // eslint-disable-next-line @next/next/no-img-element
                          return <img src={src} alt="Mobile preview" className="h-full w-full object-contain" />;
                        })()}
                      </div>
                      <span className="text-[11px] text-slate-500">Mobile (64×64)</span>
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
                  {saving ? (isEditing ? "Saving…" : "Creating…") : isEditing ? "Save changes" : "Create sponsor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
