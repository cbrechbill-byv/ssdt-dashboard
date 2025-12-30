// app/photo-booth/sponsors/page.tsx
// Path: /photo-booth/sponsors
// Dashboard: Sponsors
//
// Sponsors management only (Add/Edit/Delete/Order/Logo).
// Sponsor Preloader settings + sponsor pool selection are managed at:
//   /photo-booth/sponsor-preloader
//
// V2:
// - Adds Ultra-Premium Logo Prep (auto-trim, pad to 2000x2000 transparent PNG, optional halo for dark logos)
// - Adds App-Exact Preview (64x64 list tile + preloader tile on dark background)
// - Adds "Prefer Light Variant" warning when logo is detected as dark (halo applied)
// - Keeps sponsor CRUD + list intact; no preloader settings UI here.

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  sponsor_message: string | null;

  // kept for DB compatibility (managed in Preloader page)
  is_preloader_enabled: boolean;

  created_at: string;
  updated_at: string;
};

type FormState = {
  id?: string;
  name: string;
  logo_path?: string | null;
  website_url: string;
  tier: string;
  is_active: boolean;
  sort_order: number;
  start_date: string;
  end_date: string;
  notes: string;
  sponsor_message: string;

  // preserved on edit (not shown/edited here)
  is_preloader_enabled: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  logo_path: null,
  website_url: "",
  tier: "",
  is_active: true,
  sort_order: 0,
  start_date: "",
  end_date: "",
  notes: "",
  sponsor_message: "",
  is_preloader_enabled: false,
};

const SPONSOR_BUCKET = "sponsor-logos";

// Upload guardrails
const MAX_BYTES = 7 * 1024 * 1024;
const MIN_LOGO_PX = 800; // raw input minimum (before prep); higher than before to avoid soft results

// “Ultra premium” output standard
const PREMIUM_OUT_SIZE = 2000; // upload standard
const FIT_PADDING = 0.88; // how much of the square the trimmed logo occupies

// Trim + luminance detection thresholds
const ALPHA_MIN = 12;
const WHITE_MIN = 248;

// Optional “premium halo plate” for dark logos (helps on preloader background)
const DARK_LUMINANCE_THRESHOLD = 0.44;
const HALO_ALPHA = 0.16;
const HALO_RADIUS_MULT = 0.28;
const HALO_PADDING_MULT = 1.2;

// App preview sizes (match mobile feel)
const APP_TILE_SIZE = 64; // sponsor list tile
const PRELOADER_TILE_SIZE = 76; // small “glass” logo chip in your preloader
const PRELOADER_TILE_PAD = 14; // inner padding in chip

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "") || "sponsor"
  );
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

  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function computeAverageLuminance(imageData: ImageData, crop: { x: number; y: number; w: number; h: number }): number {
  const data = imageData.data;
  const width = imageData.width;

  let sum = 0;
  let count = 0;

  for (let y = crop.y; y < crop.y + crop.h; y++) {
    const row = y * width * 4;
    for (let x = crop.x; x < crop.x + crop.w; x++) {
      const i = row + x * 4;
      const a = data[i + 3];
      if (a < ALPHA_MIN) continue;

      if (data[i] >= WHITE_MIN && data[i + 1] >= WHITE_MIN && data[i + 2] >= WHITE_MIN) continue;

      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += lum;
      count++;
    }
  }

  if (count === 0) return 1;
  return sum / count;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function drawPremiumHalo(ctx: CanvasRenderingContext2D, size: number, drawW: number, drawH: number) {
  const bw = Math.min(size, Math.round(drawW * HALO_PADDING_MULT));
  const bh = Math.min(size, Math.round(drawH * HALO_PADDING_MULT));
  const bx = Math.round((size - bw) / 2);
  const by = Math.round((size - bh) / 2);
  const br = Math.round(Math.min(bw, bh) * HALO_RADIUS_MULT);

  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${HALO_ALPHA})`;
  drawRoundedRect(ctx, bx, by, bw, bh, br);
  ctx.fill();

  const grad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  grad.addColorStop(0, "rgba(255,255,255,0.16)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.06)");
  grad.addColorStop(1, "rgba(255,255,255,0.12)");
  ctx.fillStyle = grad;
  drawRoundedRect(ctx, bx, by, bw, bh, br);
  ctx.fill();
  ctx.restore();
}

function sanitizeBaseName(name: string) {
  return (name || "logo")
    .replace(/\.[^/.]+$/, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
}

async function canvasToPngFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to create PNG blob"))), "image/png", 1.0);
  });
  return new File([blob], fileName, { type: "image/png" });
}

async function prepLogoToPremiumSquarePng(
  originalFile: File
): Promise<{
  file: File;
  avgLuminance: number;
  haloApplied: boolean;
  previewDataUrl: string;
}> {
  const size = PREMIUM_OUT_SIZE;

  const img = await fileToImage(originalFile);
  const srcW = img.naturalWidth || 0;
  const srcH = img.naturalHeight || 0;
  if (!srcW || !srcH) throw new Error("Invalid image dimensions.");

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

  const fullData = tctx.getImageData(0, 0, srcW, srcH);
  let crop = { x: 0, y: 0, w: srcW, h: srcH };
  const bounds = computeTrimBounds(fullData, srcW, srcH);
  if (bounds) crop = bounds;

  const avgLum = computeAverageLuminance(fullData, crop);
  const needsHalo = avgLum < DARK_LUMINANCE_THRESHOLD;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.clearRect(0, 0, size, size);

  const maxW = size * FIT_PADDING;
  const maxH = size * FIT_PADDING;
  const scale = Math.min(maxW / crop.w, maxH / crop.h);

  const drawW = Math.round(crop.w * scale);
  const drawH = Math.round(crop.h * scale);
  const dx = Math.round((size - drawW) / 2);
  const dy = Math.round((size - drawH) / 2);

  ctx.imageSmoothingEnabled = true;
  // @ts-ignore
  ctx.imageSmoothingQuality = "high";

  if (needsHalo) drawPremiumHalo(ctx, size, drawW, drawH);
  ctx.drawImage(temp, crop.x, crop.y, crop.w, crop.h, dx, dy, drawW, drawH);

  const base = sanitizeBaseName(originalFile.name || "logo");
  const fileName = `${base}-${Date.now()}-${size}.png`;
  const file = await canvasToPngFile(canvas, fileName);

  const previewDataUrl = canvas.toDataURL("image/png");

  return { file, avgLuminance: avgLum, haloApplied: needsHalo, previewDataUrl };
}

function AppExactPreview({
  sponsorName,
  tier,
  logoDataUrlOrPublicUrl,
  preferLightVariant,
}: {
  sponsorName: string;
  tier: string;
  logoDataUrlOrPublicUrl: string | null;
  preferLightVariant?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-800">App-exact preview</p>
          <p className="text-[11px] text-slate-500">
            This matches the dark + glass look like your mobile Sponsors + Preloader screens.
          </p>
        </div>

        {preferLightVariant ? (
          <div className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
            Prefer Light Variant
          </div>
        ) : null}
      </div>

      {preferLightVariant ? (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          This logo is dark on transparent and may look faint on the preloader background. If possible, request/upload a{" "}
          <span className="font-semibold">white/light version</span> of the logo (transparent PNG).
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="p-4">
          <div
            className="rounded-2xl p-4"
            style={{
              background:
                "radial-gradient(900px 500px at 50% 0%, rgba(56,189,248,0.20), rgba(2,6,23,0.00)), linear-gradient(180deg, #0b1220 0%, #050814 70%, #030615 100%)",
            }}
          >
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <div
                  className="shrink-0 overflow-hidden rounded-2xl border border-white/12 bg-white/6"
                  style={{ width: APP_TILE_SIZE, height: APP_TILE_SIZE }}
                >
                  {logoDataUrlOrPublicUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoDataUrlOrPublicUrl} alt="App tile preview" className="h-full w-full object-contain p-2" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-white/35">No logo</div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-semibold text-white/95">{sponsorName || "Sponsor name"}</div>
                    {tier ? (
                      <div className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/75">
                        {tier}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-white/55">Tap for details</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="mb-3 text-xs font-semibold text-white/85">Preloader chip</div>
              <div className="flex items-center justify-center">
                <div
                  className="flex items-center justify-center rounded-3xl border border-white/10 bg-white/6 shadow-[0_0_40px_rgba(56,189,248,0.12)]"
                  style={{ width: PRELOADER_TILE_SIZE, height: PRELOADER_TILE_SIZE }}
                >
                  {logoDataUrlOrPublicUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoDataUrlOrPublicUrl}
                      alt="Preloader chip preview"
                      className="h-full w-full object-contain"
                      style={{ padding: PRELOADER_TILE_PAD }}
                    />
                  ) : (
                    <div className="text-[10px] text-white/35">No logo</div>
                  )}
                </div>
              </div>
              <div className="mt-3 text-center text-[11px] text-white/55">
                This chip preview is the best indicator of readability during your sponsor preloader overlay.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SponsorLogoUltraUploader({
  sponsorName,
  tier,
  currentLogoKey,
  onChangeLogoKey,
}: {
  sponsorName: string;
  tier: string;
  currentLogoKey: string | null | undefined;
  onChangeLogoKey: (next: string | null) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [localPreviewDataUrl, setLocalPreviewDataUrl] = useState<string | null>(null);
  const [prepMeta, setPrepMeta] = useState<{ avgLuminance: number; haloApplied: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const currentPublicUrl = useMemo(() => getLogoPublicUrl(currentLogoKey ?? null), [currentLogoKey]);
  const effectivePreview = localPreviewDataUrl || currentPublicUrl;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = e.target;
    const file = inputEl.files?.[0] ?? null;
    if (!file) return;

    setStatus("");
    setLocalPreviewDataUrl(null);
    setPrepMeta(null);

    if (!file.type.startsWith("image/")) {
      setStatus("Only image uploads are allowed.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (file.size > MAX_BYTES) {
      setStatus("Image too large. Max size is 7 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    try {
      const dims = await getImageDimensions(file);
      if (dims.width < MIN_LOGO_PX || dims.height < MIN_LOGO_PX) {
        setStatus(`Image is too small. Please upload at least ${MIN_LOGO_PX}×${MIN_LOGO_PX}px for premium results.`);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    } catch {
      // allow continuing; prep step may still work
    }

    setIsUploading(true);
    setStatus("Preparing ultra-premium logo (trim + pad + 2000×2000 PNG)…");

    try {
      const prepared = await prepLogoToPremiumSquarePng(file);
      setLocalPreviewDataUrl(prepared.previewDataUrl);
      setPrepMeta({ avgLuminance: prepared.avgLuminance, haloApplied: prepared.haloApplied });

      setStatus(
        `Uploading… (Output: ${PREMIUM_OUT_SIZE}px PNG · ${prepared.haloApplied ? "Dark logo detected" : "Looks good"} · Luminance: ${prepared.avgLuminance.toFixed(
          2
        )})`
      );

      const formData = new FormData();
      formData.append("file", prepared.file);
      formData.append("sponsorName", sponsorName || "Sponsor");
      formData.append("sponsorSlug", slugify(sponsorName || "sponsor"));

      const res = await fetch("/api/sponsors/upload-logo", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        console.error("[SponsorLogoUltraUploader] Upload error:", json);
        setStatus(json?.error || "Upload failed. Please try another image.");
        return;
      }

      onChangeLogoKey((json.key as string) ?? null);

      void logDashboardEvent({
        action: "update",
        entity: "sponsors",
        details: {
          logo_prep: {
            output_size: PREMIUM_OUT_SIZE,
            fit_padding: FIT_PADDING,
            halo_threshold: DARK_LUMINANCE_THRESHOLD,
            halo_applied: prepared.haloApplied,
            avg_luminance: prepared.avgLuminance,
          },
        },
      });

      setStatus("✅ Uploaded. This preview matches what you’ll see in the app. Don’t forget to Save Sponsor.");
    } catch (err: any) {
      console.error("[SponsorLogoUltraUploader] error", err);
      setStatus(err?.message || "Failed to prepare/upload logo.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      else {
        try {
          inputEl.value = "";
        } catch {
          // ignore
        }
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800">Sponsor logo (Ultra-Premium Prep)</p>
            <p className="text-[11px] text-slate-600">
              Upload PNG/JPEG/WebP — we auto-prep to a transparent <span className="font-semibold">2000×2000 PNG</span> with trim + padding.
              Dark logos get a subtle halo only when needed (preloader visibility).
            </p>
          </div>

          <label className="inline-flex shrink-0 cursor-pointer items-center rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-semibold text-slate-900 shadow-sm hover:bg-amber-300">
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
            {isUploading ? "Working…" : "Choose logo"}
          </label>
        </div>

        {status ? <div className="break-words text-[11px] text-slate-700">{status}</div> : null}

        <div className="text-[11px] text-slate-500">
          Recommended input: transparent PNG, exported at <span className="font-semibold">2000×2000</span> (or larger).
        </div>
      </div>

      <AppExactPreview
        sponsorName={sponsorName}
        tier={tier}
        logoDataUrlOrPublicUrl={effectivePreview}
        preferLightVariant={prepMeta?.haloApplied ?? false}
      />
    </div>
  );
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

  useEffect(() => {
    void fetchSponsors();
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

    void (async () => {
      try {
        const updates = normalized.map((s) => supabase.from("sponsors").update({ sort_order: s.sort_order }).eq("id", s.id));
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

  function handleInputChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreateModal() {
    setForm({ ...EMPTY_FORM, sort_order: nextSuggestedSortOrder, is_preloader_enabled: false });
    setIsEditing(false);
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(sponsor: Sponsor) {
    setIsEditing(true);
    setError(null);
    setForm({
      id: sponsor.id,
      name: sponsor.name,
      logo_path: sponsor.logo_path,
      website_url: sponsor.website_url || "",
      tier: sponsor.tier || "",
      is_active: sponsor.is_active,
      sort_order: sponsor.sort_order ?? 0,
      start_date: sponsor.start_date ? sponsor.start_date.substring(0, 10) : "",
      end_date: sponsor.end_date ? sponsor.end_date.substring(0, 10) : "",
      notes: sponsor.notes || "",
      sponsor_message: sponsor.sponsor_message || "",
      is_preloader_enabled: !!sponsor.is_preloader_enabled,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSaving(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!form.name.trim()) throw new Error("Sponsor name is required");

      const sortOrderNum = Number(form.sort_order);
      if (!Number.isFinite(sortOrderNum)) throw new Error("Sort order must be a number.");

      const payload: any = {
        name: form.name,
        logo_path: form.logo_path ?? null,
        website_url: form.website_url || null,
        tier: form.tier || null,
        is_active: form.is_active,
        sort_order: sortOrderNum,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
        sponsor_message: form.sponsor_message || null,
      };

      if (!form.id) payload.is_preloader_enabled = false;
      else payload.is_preloader_enabled = !!form.is_preloader_enabled;

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
          logo_path: form.logo_path ?? null,
          sponsor_message: form.sponsor_message || null,
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
        details: sponsor ? { name: sponsor.name, logo_path: sponsor.logo_path } : { id },
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
      await Promise.all(finalList.map((s) => supabase.from("sponsors").update({ sort_order: s.sort_order }).eq("id", s.id)));
    } catch (e) {
      console.error(e);
      setError("Failed to update sponsor order. Refresh and try again.");
      await fetchSponsors();
    } finally {
      setReordering(false);
    }
  }

  return (
    <DashboardShell title="Sponsors" subtitle="Manage sponsor names, tiers, order, and logos." activeTab="sponsors">
      <div className="space-y-4">
        <header className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-slate-900">Sponsors</h2>
            <p className="text-xs text-slate-600">
              Upload logos with <span className="font-semibold">Ultra-Premium Prep</span> so they remain readable in the app preloader.
            </p>
            {reordering && <div className="mt-2 text-[11px] text-slate-500">Updating order…</div>}
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
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
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-800">{error}</div>
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

                return (
                  <li
                    key={sponsor.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {logoUrl ? (
                        <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white" style={{ width: 72, height: 72 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={logoUrl} alt={sponsor.name} className="h-full w-full object-contain p-2" />
                        </div>
                      ) : (
                        <div
                          className="flex shrink-0 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-[10px] text-slate-400"
                          style={{ width: 72, height: 72 }}
                        >
                          No logo
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-slate-900">{sponsor.name}</span>

                          {sponsor.tier && (
                            <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                              {sponsor.tier}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600">Order: {sponsor.sort_order}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">{isEditing ? "Edit sponsor" : "Add sponsor"}</h2>
                <p className="text-xs text-slate-600">
                  Logos are prepped to a premium standard so they remain readable on the mobile preloader.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="shrink-0 rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            {error && <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Sponsor name</label>
                <input
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  value={form.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Tier (optional)</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.tier}
                    onChange={(e) => handleInputChange("tier", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Website URL (optional)</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.website_url}
                    onChange={(e) => handleInputChange("website_url", e.target.value)}
                  />
                </div>
              </div>

              <SponsorLogoUltraUploader
                sponsorName={form.name}
                tier={form.tier}
                currentLogoKey={form.logo_path ?? null}
                onChangeLogoKey={(next) => handleInputChange("logo_path", next)}
              />

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
