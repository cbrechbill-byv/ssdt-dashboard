"use client";

import React, { useState } from "react";

type Props = {
  label?: string;
  helpText?: string;
  value: string; // stored logo_path: "sponsor-logos/<key>" OR "<key>"
  onChange: (next: string) => void;
  className?: string;
};

export default function SponsorLogoUploader({
  label = "Sponsor Logo",
  helpText = "Upload a clean transparent PNG (recommended 1024×1024). Stored in Storage and saved to this sponsor.",
  value,
  onChange,
  className,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(file?: File | null) {
    if (!file) return;
    setUploading(true);
    setErr(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/sponsors/upload-logo", {
        method: "POST",
        body: form,
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Upload failed");

      onChange(String(json.path || ""));
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      <div className="text-xs font-semibold text-slate-800">{label}</div>
      <div className="mt-1 text-[11px] text-slate-600">{helpText}</div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100">
          {uploading ? "Uploading…" : value ? "Replace logo…" : "Choose logo…"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
        </label>

        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={uploading}
            className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          >
            Remove
          </button>
        ) : null}

        <div className="text-[11px] text-slate-500">
          {value ? (
            <>
              Saved path: <span className="font-mono">{value}</span>
            </>
          ) : (
            <>No logo uploaded yet.</>
          )}
        </div>
      </div>

      {err ? (
        <div className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
      ) : null}
    </div>
  );
}