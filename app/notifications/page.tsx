"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function NotificationsPage() {
  const [title, setTitle] = useState("Tonight at Sugarshack Downtown");
  const [message, setMessage] = useState(
    "VIPs get a free welcome shot before 10pm. Show this notification at the bar!"
  );
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setIsSending(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to send notification");
        return;
      }

      setResult(
        data.sent
          ? `Notification sent to ${data.sent} device(s).`
          : data.note || "No devices registered yet."
      );
    } catch (_err) {
      setError("Unexpected error sending notification");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Send push notification
          </h1>
          <p className="text-sm text-slate-500">
            Broadcast a simple message to all devices that have your SSDT app installed.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-xs font-medium rounded-full border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
        >
          ← Back to dashboard
        </Link>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-xl">
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Notification title
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Optional. Shown in bold on most devices.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Notification message
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500 min-h-[80px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Keep it short and punchy. Most lock screens only show the first couple of lines.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSending}
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-400 shadow-sm"
          >
            {isSending ? "Sending..." : "Send notification"}
          </button>

          {result && (
            <p className="text-xs text-emerald-600 mt-2">
              {result}
            </p>
          )}

          {error && (
            <p className="text-xs text-rose-600 mt-2">
              {error}
            </p>
          )}
        </form>

        <div className="mt-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 p-3">
          <p className="text-[11px] text-slate-500">
            This will send to <span className="font-medium">all registered devices</span> in Supabase.
            Once we connect the mobile app, each install will automatically register its push token here.
          </p>
        </div>
      </div>
    </div>
  );
}
