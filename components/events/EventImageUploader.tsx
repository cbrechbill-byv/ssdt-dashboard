"use client";

import React, { useMemo, useState } from "react";

interface EventImageUploaderProps {
  eventTitle: string;
  eventId: string; // required so we can store at events/<eventId>/...
  initialPath?: string | null;
  initialUrl?: string | null;
  fieldName?: string; // defaults to "image_path"
}

export default function EventImageUploader({
  eventTitle,
  eventId,
  initialPath,
  initialUrl,
  fieldName = "image_path",
}: EventImageUploaderProps) {
  const [imagePath, setImagePath] = useState(initialPath ?? "");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const effectivePreviewUrl = useMemo(() => {
    if (uploadedUrl) return uploadedUrl;
    if (initialUrl) return initialUrl;
    return null;
  }, [uploadedUrl, initialUrl]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus(null);
    setUploadedUrl(null);

    if (!file.type.startsWith("image/")) {
      setStatus("Please choose an image file (JPEG or PNG).");
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setStatus("Image is too large. Max size is 5 MB.");
      return;
    }

    if (!eventId || eventId.trim().length === 0) {
      setStatus("Missing event id. Save the event first, then upload an image.");
      return;
    }

    setIsUploading(true);
    setStatus("Uploading and resizing image…");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("eventId", eventId);
      formData.append("eventTitle", eventTitle || "Event");

      const res = await fetch("/api/events/upload-image", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error("[EventImageUploader] Upload error:", json);
        setStatus(json.error || "Upload failed. Please try another image.");
        return;
      }

      setImagePath(json.path as string);
      setUploadedUrl(json.publicUrl as string | null);
      setStatus("Image uploaded successfully. Don’t forget to save the event.");
    } catch (error) {
      console.error("[EventImageUploader] Upload exception:", error);
      setStatus("Upload failed due to a network error.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Hidden field used by the server action */}
      <input type="hidden" name={fieldName} value={imagePath} />

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-800">Event image</p>
            <p className="text-[11px] text-slate-500">
              JPEG or PNG, at least 600×600. We’ll resize to a square image for the app and reject images that are too small.
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

        {effectivePreviewUrl ? (
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={effectivePreviewUrl}
                alt="Event image preview"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              This is the current image for this event. Choose a new file to replace it, then save the event.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">No image uploaded yet for this event.</p>
        )}

        {status && <p className="text-[11px] text-slate-600">{status}</p>}
      </div>
    </div>
  );
}
