"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setError("Invalid username or password.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 px-8 py-8 sm:px-10 sm:py-10">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative w-56 h-16">
              <Image
                src="/ssdt-logo.png"
                alt="Sugarshack Downtown"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl font-semibold text-center text-slate-900">
            Sugarshack Downtown Dashboard
          </h1>
          <p className="mt-1 text-sm text-center text-slate-500">
            Internal view for VIP rewards, fan wall, and tonight&apos;s shows.
          </p>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 mt-1">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-slate-900 text-white text-sm font-medium py-2.5 shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-[11px] text-center text-slate-400">
            For Sugarshack Downtown staff use only.
          </p>
        </div>
      </div>
    </div>
  );
}
