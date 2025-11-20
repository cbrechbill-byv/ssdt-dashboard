"use client";

import React from "react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-lg border border-slate-200 px-8 py-9">
        <div className="flex justify-center mb-6">
          <img
            src="/ssdt-logo.png"
            alt="Sugarshack Downtown"
            className="h-14 sm:h-16 w-auto"
          />
        </div>

        <h1 className="text-center text-2xl font-semibold text-slate-900">
          Sugarshack Downtown Dashboard
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Internal view for VIP rewards, fan wall, and tonight&apos;s shows.
        </p>

        <form
          method="POST"
          action="/api/login"
          className="mt-8 space-y-5"
        >
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 text-white text-sm font-medium py-2.5 mt-2 shadow-sm hover:bg-slate-800"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          For Sugarshack Downtown staff use only.
        </p>
      </div>
    </div>
  );
}
