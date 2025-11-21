"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError("Incorrect passcode. Please try again.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (_err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-sm shadow-xl p-6 space-y-6">
        <div className="flex flex-col items-center gap-3">
          {/* Logo */}
          <div className="relative w-56 h-14">
            <Image
              src="/ssdt-logo.png"
              alt="Sugarshack Downtown"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Title / subtitle */}
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold text-white">
              SSDT VIP Admin
            </h1>
            <p className="text-xs text-slate-400">
              Staff-only access to check-ins, rewards, and fan wall.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs font-medium text-slate-200 space-y-1">
            <span>Admin passcode</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/80 focus:border-emerald-400/80"
              placeholder="Enter passcode"
            />
          </label>

          {error && (
            <p className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !password.trim()}
            className="w-full rounded-xl bg-emerald-400 text-slate-950 text-sm font-semibold py-2.5 hover:bg-emerald-300 disabled:opacity-60 disabled:hover:bg-emerald-400 transition-colors"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-500">
          Having trouble? Ask the manager to confirm the admin code.
        </p>
      </div>
    </div>
  );
}
