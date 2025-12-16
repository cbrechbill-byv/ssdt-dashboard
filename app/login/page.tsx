// app/login/page.tsx
// Path: /login
// SSDT Dashboard login + reset password request

"use client";

import React, { useState } from "react";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetErr, setResetErr] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Incorrect email or password.");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError("Login failed. Please try again.");
      setLoading(false);
    }
  }

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setResetErr("");

    try {
      const res = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, mode: "reset" }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to request reset.");

      setResetDone(true);
    } catch (err: any) {
      console.error(err);
      setResetErr(err.message || "Failed to request reset.");
      setResetLoading(false);
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
          Staff Dashboard
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          Internal view for staff use only.
        </p>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Email
            </label>
            <input
              type="email"
              placeholder="staff@yourvenue.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-slate-400"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <button
            type="button"
            onClick={() => {
              setResetOpen(true);
              setResetDone(false);
              setResetErr("");
              setResetEmail(email || "");
            }}
            className="w-full text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Forgot password?
          </button>
        </form>

        <p className="text-slate-400 text-xs mt-6">
          Sugarshack Downtown staff only.
        </p>
      </div>

      {/* Reset modal */}
      {resetOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Reset password
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  We’ll email you a reset link (expires in 1 hour).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetOpen(false)}
                className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            {resetDone ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                If an account exists for that email, a reset link has been sent.
              </div>
            ) : (
              <form onSubmit={requestReset} className="mt-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    Email
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-slate-400"
                    required
                  />
                </div>

                {resetErr && <p className="text-red-600 text-sm">{resetErr}</p>}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {resetLoading ? "Sending..." : "Email reset link"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
