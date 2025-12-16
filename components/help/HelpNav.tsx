"use client";

import React from "react";
import type { HelpItem } from "@/app/help/HelpClient";

export default function HelpNav({ sections }: { sections: HelpItem[] }) {
  return (
    <aside className="w-64 shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Help Topics
      </p>

      <nav className="space-y-1">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-amber-50"
          >
            {s.title}
          </a>
        ))}
      </nav>
    </aside>
  );
}
