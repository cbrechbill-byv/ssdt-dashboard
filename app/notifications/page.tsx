"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";

type Audience = "all" | "vip" | "test";

export default function NotificationsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<null | { type: "success" | "error"; message: string }>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!title.trim() || !message.trim()) {
      setStatus({ type: "error", message: "Title and message are required." });
      return;
    }

    try {
      setIsSending(true);
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          audience,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to send notification.");
      }

      setStatus({
        type: "success",
        message: "Notification queued and sent to Expo. 🎉",
      });
      setTitle("");
      setMessage("");
      setAudience("all");
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err?.message || "Something went wrong while sending.",
      });
    } finally {
      setIsSending(false);
    }
  }

  const previewTitle = title || "Sugarshack Downtown";
  const previewBody =
    message ||
    "Fresh music vibes and specials tonight at Sugarshack Downtown. Tap to see what’s on.";

  return (
    <DashboardShell
      title="Push notifications"
      subtitle="Send targeted updates to VIPs and Sugarshack app users."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(260px,2fr)]">
        {/* Left: form */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Compose notification
              </h2>
              <p className="text-xs text-slate-500">
                Short, punchy messages perform best. Think “What’s happening
                right now at Sugarshack?”
              </p>
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            {/* Audience */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Audience
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAudience("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    audience === "all"
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  All users
                </button>
                <button
                  type="button"
                  onClick={() => setAudience("vip")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    audience === "vip"
                      ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  VIPs only
                </button>
                <button
                  type="button"
                  onClick={() => setAudience("test")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    audience === "test"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Test device
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                “Test device” is great to confirm the copy and timing on your own
                phone before blasting to everyone.
              </p>
            </div>

            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Title
              </label>
              <input
                id="title"
                type="text"
                maxLength={60}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tonight at Sugarshack Downtown"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 bg-slate-50"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Keep it under ~40 characters for best visibility on most phones.
              </p>
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="message"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Message
              </label>
              <textarea
                id="message"
                rows={4}
                maxLength={180}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Live set starting at 8PM, drink specials until 9. Tap for details."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 bg-slate-50 resize-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Aim for 1–2 short sentences. Users see this on their lock screen.
              </p>
            </div>

            {/* Status */}
            {status && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  status.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {status.message}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="submit"
                disabled={isSending}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-950 text-white text-xs font-medium px-4 py-2 shadow-sm hover:bg-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSending ? "Sending…" : "Send notification"}
              </button>
              <p className="text-[11px] text-slate-400">
                Sent via Expo push service. Delivery depends on device settings and
                connectivity.
              </p>
            </div>
          </form>
        </section>

        {/* Right: preview + tips */}
        <section className="space-y-4">
          {/* Preview card */}
          <div className="bg-slate-950 text-slate-50 rounded-2xl border border-slate-800 shadow-sm p-4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400 mb-2">
              Lock screen preview
            </p>
            <div className="bg-slate-900 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Now • Sugarshack Downtown</span>
                <span>𝗶OS preview</span>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-white">{previewTitle}</p>
                <p className="text-[11px] text-slate-200">{previewBody}</p>
              </div>
            </div>
          </div>

          {/* Tips card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400 mb-1.5">
              Sending great notifications
            </p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li>• Lead with the “why” — what’s special right now?</li>
              <li>• Avoid sending more than a few times per week.</li>
              <li>• Use “Test device” first to see exactly what fans will see.</li>
              <li>• Follow up push with in-venue signage and QR codes.</li>
            </ul>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
