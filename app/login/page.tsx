"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Invalid password.");
        setLoading(false);
        return;
      }

      // Cookie is set server-side → now go to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError("Unexpected error. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 shadow-xl p-6 space-y-6">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="relative w-48 h-14">
            <Image
              src="/ssdt-logo.png"
              alt="Sugarshack Downtown"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs font-medium text-slate-200">
            Admin passcode
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-400"
            placeholder="Enter admin passcode"
          />

          {error && (
            <p className="text-xs text-rose-400 bg-rose-900/40 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full rounded-xl bg-emerald-400 text-slate-950 font-semibold py-2.5 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-500 pt-2">
          Sugarshack Downtown staff only
        </p>
      </div>
    </div>
  );
}
