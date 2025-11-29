"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

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

function getLogoPublicUrl(logo_path: string | null | undefined) {
  if (!logo_path) return null;
  const { data } = supabase.storage.from(SPONSOR_BUCKET).getPublicUrl(logo_path);
  return data?.publicUrl ?? null;
}

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    void fetchSponsors();
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

    setSponsors(data || []);
    setLoading(false);
  }

  function openCreateModal() {
    setForm(EMPTY_FORM);
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
  }

  function handleInputChange<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function uploadLogoIfNeeded(
    file?: File | null
  ): Promise<string | null | undefined> {
    if (!file) return form.logo_path ?? null;

    const originalName = file.name || "logo.png";
    const ext = originalName.includes(".")
      ? originalName.split(".").pop() || "png"
      : "png";
    const base = originalName
      .replace(/\.[^/.]+$/, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    const fileName = `${base}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(SPONSOR_BUCKET)
      .upload(fileName, file, {
        upsert: true,
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
      if (!form.name.trim()) {
        throw new Error("Sponsor name is required");
      }

      // First, handle logo upload (if any)
      const logo_path = await uploadLogoIfNeeded(form.logoFile);

      const payload = {
        name: form.name,
        logo_path: logo_path ?? null,
        website_url: form.website_url || null,
        tier: form.tier || null,
        is_active: form.is_active,
        sort_order: form.sort_order,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
      };

      if (form.id) {
        // Update existing sponsor
        const { error } = await supabase
          .from("sponsors")
          .update(payload)
          .eq("id", form.id);

        if (error) {
          console.error(error);
          throw new Error(error.message || "Failed to save sponsor");
        }
      } else {
        // Create new sponsor
        const { error } = await supabase.from("sponsors").insert(payload);

        if (error) {
          console.error(error);
          throw new Error(error.message || "Failed to create sponsor");
        }
      }

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

    try {
      const { error } = await supabase.from("sponsors").delete().eq("id", id);

      if (error) {
        console.error(error);
        throw new Error(error.message || "Failed to delete sponsor");
      }

      await fetchSponsors();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error deleting sponsor");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sponsors</h1>
            <p className="text-sm text-slate-600">
              Manage sponsor names, tiers, and logos. Your existing mobile
              Sponsors screen can pull from this data while keeping the current
              layout.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/40 hover:bg-sky-400"
          >
            + Add Sponsor
          </button>
        </header>

        {error && !modalOpen && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900">
              All Sponsors
            </h2>
            {loading && (
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Loading…
              </span>
            )}
          </div>

          {sponsors.length === 0 && !loading ? (
            <p className="text-sm text-slate-600">
              No sponsors yet. Use “Add Sponsor” to create your first sponsor.
            </p>
          ) : (
            <ul className="space-y-3">
              {sponsors.map((sponsor) => {
                const logoUrl = getLogoPublicUrl(sponsor.logo_path);

                return (
                  <li
                    key={sponsor.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                          <img
                            src={logoUrl}
                            alt={sponsor.name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-[10px] text-slate-400">
                          No logo
                        </div>
                      )}

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {sponsor.name}
                          </span>
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
                            {sponsor.start_date &&
                              `Start: ${sponsor.start_date.substring(0, 10)}`}
                            {sponsor.start_date && sponsor.end_date && " · "}
                            {sponsor.end_date &&
                              `End: ${sponsor.end_date.substring(0, 10)}`}
                          </p>
                        )}

                        {sponsor.notes && (
                          <p className="mt-1 text-xs text-slate-600">
                            {sponsor.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {isEditing ? "Edit Sponsor" : "Add Sponsor"}
                </h2>
                <p className="text-xs text-slate-600">
                  Upload a square-ish logo if possible. The mobile app can use
                  this along with the sponsor tier to layout the section.
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
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">
                  Sponsor Name
                </label>
                <input
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  value={form.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Bud Light, Local Brewery, Brand Partner…"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    Tier (optional)
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.tier}
                    onChange={(e) =>
                      handleInputChange("tier", e.target.value)
                    }
                    placeholder="headline, supporting, beer partner…"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    Website URL (optional)
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.website_url}
                    onChange={(e) =>
                      handleInputChange("website_url", e.target.value)
                    }
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    Start Date (optional)
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.start_date}
                    onChange={(e) =>
                      handleInputChange("start_date", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    End Date (optional)
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    value={form.end_date}
                    onChange={(e) =>
                      handleInputChange("end_date", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">
                  Notes (internal)
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  value={form.notes}
                  onChange={(e) =>
                    handleInputChange("notes", e.target.value)
                  }
                  placeholder="Anything you want to remember about this sponsor."
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-3">
                <label className="inline-flex items-center gap-2 text-xs text-slate-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-500"
                    checked={form.is_active}
                    onChange={(e) =>
                      handleInputChange("is_active", e.target.checked)
                    }
                  />
                  Active
                </label>

                <div className="space-y-1 text-right">
                  <p className="text-xs font-semibold text-slate-800">
                    Logo Image (PNG/JPG)
                  </p>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                    Choose File…
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleInputChange(
                          "logoFile",
                          e.target.files?.[0] ?? undefined
                        )
                      }
                    />
                  </label>
                  <p className="text-[11px] text-slate-500">
                    {form.logoFile
                      ? `Selected: ${form.logoFile.name}`
                      : form.logo_path
                      ? `Current: ${form.logo_path}`
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
                    ? "Save Changes"
                    : "Create Sponsor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
