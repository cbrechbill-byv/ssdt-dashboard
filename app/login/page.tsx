"use client";

import React from "react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="rounded-2xl bg-white shadow-md border border-slate-200 px-6 py-5 text-center max-w-sm">
        <h1 className="text-lg font-semibold text-slate-800">
          Login placeholder
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Dashboard access is protected by admin password (Basic Auth).
        </p>
        <p className="mt-2 text-xs text-slate-400">
          This page is not used yet. You can close this tab.
        </p>
      </div>
    </div>
  );
}
