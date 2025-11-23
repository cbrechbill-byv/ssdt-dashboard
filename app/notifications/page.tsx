"use client";

import React, { useState, useEffect } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";

// For logs coming from Supabase
type NotificationLog = {
  id: string;
  created_at: string;
  title: string;
  body: string;
  audience: string;
  route: string | null;
  sent_count: number | null;
};

type Audience = "all" | "vip" | "test";

export default function NotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [route, setRoute] = useState("/home");
  const [audience, setAudience] = useState<Audience>("all");
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<null | {
    type: "success" | "error";
    message: string;
  }>(null);

  // Logging
  const [latestLog, setLatestLog] = useState<NotificationLog | null>(null);
  const [history, setHistory] = useState<NotificationLog[]>([]);

  /* ------------------------------------------------------------------
     LOAD LOGS FROM SUPABASE
  ------------------------------------------------------------------ */

  async function loadLogs() {
    try {
      const res = await fetch("/api/notifications/logs");
      if (!res.ok) return;

      const data = await res.json();
      const logs = data.logs as NotificationLog[];

      if (logs.length > 0) {
        setLatestLog(logs[0]);
        setHistory(logs.slice(1));
      }
    } catch {}
  }

  useEffect(() => {
    loadLogs();
  }, []);

  /* ------------------------------------------------------------------
     SEND NOTIFICATION
  ------------------------------------------------------------------ */

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!title.trim() || !body.trim()) {
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
          body: body.trim(),
          route: route.trim(),
          audience,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to send notification.");
      }

      setStatus({
        type: "success",
        message: "Notification queued and sent to Expo. 🎉",
      });

      // Reset form
      setTitle("");
      setBody("");
      setAudience("all");

      // Reload logs
      loadLogs();
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err?.message || "Something went wrong while sending.",
      });
    } finally {
      setIsSending(false);
    }
  }

  /* ------------------------------------------------------------------
     PREVIEW
  ------------------------------------------------------------------ */

  const previewTitle = title || "Sugarshack Downtown";
  const previewBody =
    body ||
    "Fresh music vibes and specials tonight at Sugarshack Downtown. Tap to see what’s on.";

  /* ------------------------------------------------------------------
     RENDER
  ------------------------------------------------------------------ */

  return (
    <DashboardShell
      title="Push notifications"
      subtitle="Send targeted updates to VIPs and Sugarshack app users."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(260px,2fr)]">
        {/* ------------------------------------------------------------- */}
        {/* Left column: Form + Logs */}
        {/* ------------------------------------------------------------- */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-6">

          {/* ---------------- LAST MESSAGE SENT ---------------- */}
          {latestLog && (
            <div className="border border-slate-200 bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Last message sent</p>
              <p className="text-sm font-semibold text-slate-900">
                {latestLog.title}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {latestLog.body}
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                Audience: {latestLog.audience.toUpperCase()} · 
                Route: {latestLog.route ?? "/home"} · 
                Sent to {latestLog.sent_count ?? 0} device(s)
              </p>
            </div>
          )}

          {/* ---------------- HISTORY (COLLAPSIBLE) ---------------- */}
          {history.length > 0 && (
            <details className="border border-slate-200 bg-white rounded-xl p-4">
              <summary className="cursor-pointer text-xs text-slate-600 mb-2">
                Show older history ({history.length})
              </summary>
              <div className="space-y-3">
                {history.map((log) => (
                  <div
                    key={log.id}
                    className="border border-slate-200 rounded-lg p-3 bg-slate-50"
                  >
                    <p className="text-xs text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm font-medium text-slate-900">
                      {log.title}
                    </p>
                    <p className="text-xs text-slate-700">{log.body}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Audience: {log.audience} · Route: {log.route}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* ---------------- COMPOSE FORM ---------------- */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-1">
              Compose notification
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Short, punchy messages perform best.
            </p>

            <form onSubmit={handleSend} className="space-y-4">

              {/* Audience */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Audience
                </label>
                <div className="flex flex-wrap gap-2">
                  {["all", "vip", "test"].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAudience(val as Audience)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        audience === val
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {val === "all"
                        ? "All users"
                        : val === "vip"
                        ? "VIPs only"
                        : "Test device"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Tonight at Sugarshack Downtown"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Message
                </label>
                <textarea
                  rows={4}
                  maxLength={180}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Live set starting at 8PM, drink specials until 9. Tap for details."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900/10 resize-none"
                />
              </div>

              {/* Route (deep link) */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Deep link route when tapped
                </label>
                <input
                  type="text"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="/home"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-slate-900/10"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Example: <code>/home</code>, <code>/calendar</code>, <code>/vip</code>
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
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-950 text-white text-xs font-medium px-4 py-2 shadow-sm hover:bg-slate-900 disabled:opacity-60"
                >
                  {isSending ? "Sending…" : "Send notification"}
                </button>
                <p className="text-[11px] text-slate-400">
                  Sent via Expo push service.
                </p>
              </div>

            </form>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* Right column: Existing preview + tips (unchanged) */}
        {/* ------------------------------------------------------------- */}
        <section className="space-y-4">

          {/* Preview */}
          <div className="bg-slate-950 text-slate-50 rounded-2xl border border-slate-800 shadow-sm p-4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400 mb-2">
              Lock screen preview
            </p>
            <div className="bg-slate-900 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Now • Sugarshack Downtown</span>
                <span>iOS preview</span>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-white">
                  {previewTitle}
                </p>
                <p className="text-[11px] text-slate-200">{previewBody}</p>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400 mb-1.5">
              Sending great notifications
            </p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li>• Lead with the “why” — what’s special right now?</li>
              <li>• Avoid sending more than a few times per week.</li>
              <li>• Use “Test device” first to see exactly what fans will see.</li>
              <li>• Follow up push with signage & QR codes.</li>
            </ul>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
