"use client";

import React from "react";
import type { HelpItem } from "@/app/help/HelpClient";

export default function HelpSection({ section }: { section: HelpItem }) {
  return (
    <section
      id={section.id}
      className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        {section.title}
      </h2>

      <div className="prose prose-slate max-w-none text-sm">
        {section.content}
      </div>
    </section>
  );
}
