// app/reset-password/ResetPasswordClient.tsx
// Path: /reset-password (client UI)

"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Missing reset token. Please use the link from your email.");
      return;
    }
    if (!password || password.length < 8) {
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

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to reset password. Try again.");
        setLoading(false);
        return;
      }

      setSuccess("Password updated. You can sign in now.");
      setLoading(false);

      // Send them back to login after a short moment
      setTimeout(() => router.push("/login"), 800);
    } catch (err) {
      console.error("[reset-password] error", err);
      setError("Unexpected error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white shadow-xl rounded-2xl p-10 max-w-md w-full text-center border border-slate-200">
        {/* Logo */}
        <div className="relative w-48 h-20 mx-auto mb-6">
          <Image
            src="/ssdt-logo.png"
            alt="Sugarshack Downtown"
            fill
            className="object-contain"
          />
        </div>

        <h2 className="text-xl font-semibold text-slate-800 mb-1">
          Set / Reset Password
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          Enter a new password for your dashboard account.
        </p>

        {!token && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 text-left">
            Missing reset token. Please open the link from your email.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              New password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-slate-400"
              required
              disabled={!token || loading}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Minimum 8 characters.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Confirm password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-slate-400"
              required
              disabled={!token || loading}
            />
          </div>

          {error && <p className="text-rose-600 text-sm">{error}</p>}
          {success && <p className="text-emerald-700 text-sm">{success}</p>}

          <button
            type="submit"
            disabled={!token || loading}
            className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save password"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.push("/login")}
          className="mt-6 text-slate-500 text-xs hover:underline"
        >
          Back to login
        </button>
      </div>
    </div>
  );
}
