// app/reset-password/page.tsx
// Path: /reset-password
// Sets password from emailed token

"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing reset token.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to reset password.");
      }

      setDone(true);
    } catch (e: any) {
      setError(e.message || "Failed to reset password.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white shadow-xl rounded-2xl p-10 max-w-md w-full text-center border border-slate-200">
        <div className="relative w-48 h-20 mx-auto mb-6">
          <Image
            src="/ssdt-logo.png"
            alt="Sugarshack Downtown"
            fill
            className="object-contain"
          />
        </div>

        <h2 className="text-xl font-semibold text-slate-800 mb-1">
          Set your password
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          Choose a new password for your dashboard account.
        </p>

        {done ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Password set! You can now{" "}
            <a className="font-semibold underline underline-offset-2" href="/login">
              sign in
            </a>
            .
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                New password
              </label>
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Confirm password
              </label>
              <input
                type="password"
                placeholder="Re-type password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-slate-400"
                required
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save password"}
            </button>
          </form>
        )}

        <p className="text-slate-400 text-xs mt-6">
          Sugarshack Downtown staff only.
        </p>
      </div>
    </div>
  );
}
