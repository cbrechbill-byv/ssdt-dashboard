"use client";

import React, { useState } from "react";

interface ArtistImageUploaderProps {
  /** Used to label uploads & help build a nice filename */
  artistName: string;
  /** Optional slug to help shape the storage path */
  slug?: string | null;
  /** Existing image_path from Supabase (if any) */
  initialPath?: string | null;
  /** Form field name, should be "image_path" */
  fieldName?: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "artist";
}

export default function ArtistImageUploader({
  artistName,
  slug,
  initialPath,
  fieldName = "image_path",
}: ArtistImageUploaderProps) {
  const [imagePath, setImagePath] = useState(initialPath ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus(null);
    setPreviewUrl(null);

    if (!file.type.startsWith("image/")) {
      setStatus("Please choose an image file (JPEG or PNG).");
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxBytes) {
      setStatus("Image is too large. Max size is 5 MB.");
      return;
    }

    // Optional: quick client preview (original, server resizes later)
    setPreviewUrl(URL.createObjectURL(file));
    setIsUploading(true);
    setStatus("Uploading and resizing image…");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("artistName", artistName || "Artist");
      formData.append("artistSlug", slug ? slug : slugify(artistName || "artist"));

      const res = await fetch("/api/artists/upload-image", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error("[ArtistImageUploader] Upload error:", json);
        setStatus(json.error || "Upload failed. Please try another image.");
        return;
      }

      setImagePath(json.path as string);
      setStatus("Image uploaded successfully.");
    } catch (err) {
      console.error("[ArtistImageUploader] Upload exception:", err);
      setStatus("Upload failed due to a network error.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Hidden field that the server action will read */}
      <input type="hidden" name={fieldName} value={imagePath} />

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-800">
              Artist image
            </p>
            <p className="text-[11px] text-slate-500">
              JPEG or PNG, at least 600×600. We’ll resize to a square
              image for the app and reject images that are too small.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-semibold text-slate-900 shadow-sm hover:bg-amber-300">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {isUploading ? "Uploading…" : "Choose image"}
          </label>
        </div>

        {imagePath && !previewUrl && (
          <p className="text-[11px] text-slate-500">
            Current image path:{" "}
            <code className="font-mono text-[10px]">{imagePath}</code>
          </p>
        )}

        {previewUrl && (
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {/* local preview, not the resized blob, but good enough */}
              <img
                src={previewUrl}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              This is a preview of the image you selected. It will be
              resized and stored in Supabase.
            </p>
          </div>
        )}

        {status && (
          <p className="text-[11px] text-slate-600">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
