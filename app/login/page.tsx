"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passcode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data?.error || "Invalid passcode.");
        setIsLoading(false);
        return;
      }

      const from = searchParams.get("from") || "/dashboard";
      router.push(from);
      router.refresh();
    } catch (err) {
      console.error(err);
      setErrorMsg("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 px-8 py-9">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative w-56 h-14">
              <Image
                src="/ssdt-logo.png"
                alt="Sugarshack Downtown"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-6">
            <p className="text-xs font-medium tracking-[0.2em] text-slate-500">
              STAFF DASHBOARD
            </p>
            <h1 className="mt-2 text-xl font-semibold text-slate-900">
              Sign in to continue
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Enter tonight&apos;s admin passcode to access VIP &amp; rewards.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="passcode"
                className="block text-xs font-medium text-slate-600 mb-1.5"
              >
                Admin passcode
              </label>
              <input
                id="passcode"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                placeholder="••••••••"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-1 inline-flex items-center justify-center rounded-xl bg-emerald-500 text-sm font-semibold text-white py-2.5 shadow-sm hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        {/* Footnote */}
        <p className="mt-4 text-center text-xs text-slate-400">
          For Sugarshack Downtown staff use only.
        </p>
      </div>
    </div>
  );
}
