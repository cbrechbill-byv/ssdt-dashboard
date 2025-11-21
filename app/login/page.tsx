"use client";

import React, { useState } from "react";
import Image from "next/image";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });

    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      setLoading(false);
      setError("Incorrect passcode.");
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

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            placeholder="Admin passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-slate-400"
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-slate-400 text-xs mt-6">
          Sugarshack Downtown staff only.
        </p>
      </div>
    </div>
  );
}
