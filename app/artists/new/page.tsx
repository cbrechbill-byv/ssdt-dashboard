"use client";

import React, { useTransition } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { createArtist } from "./actions";

export default function NewArtistPage() {
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      await createArtist(formData);
      window.location.href = "/artists";
    });
  }

  return (
    <DashboardShell
      title="Add artist"
      subtitle="Create a new artist profile for Sugarshack Downtown."
      activeTab="artists"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Artist name
          </label>
          <input
            name="name"
            required
            className="mt-1 w-full rounded-lg bg-slate-900 px-3 py-2 text-slate-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-200">
            Genre
          </label>
          <input
            name="genre"
            required
            className="mt-1 w-full rounded-lg bg-slate-900 px-3 py-2 text-slate-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-200">
            Website (optional)
          </label>
          <input
            name="website"
            className="mt-1 w-full rounded-lg bg-slate-900 px-3 py-2 text-slate-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-200">
            Instagram (optional)
          </label>
          <input
            name="instagram"
            className="mt-1 w-full rounded-lg bg-slate-900 px-3 py-2 text-slate-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-200">
            Bio (optional)
          </label>
          <textarea
            name="bio"
            rows={4}
            className="mt-1 w-full rounded-lg bg-slate-900 px-3 py-2 text-slate-100"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-amber-400 px-6 py-2 font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save artist"}
        </button>
      </form>
    </DashboardShell>
  );
}
