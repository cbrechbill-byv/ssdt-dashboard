// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\notifications\page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { logDashboardEvent } from "@/lib/logDashboardEvent";

type Audience = "all" | "vip" | "test";

type NotificationLog = {
  id: string;
  created_at: string;
  title: string;
  body: string;
  audience: string;
  route: string | null;
  sent_count: number | null;
  sample_devices: any | null;
};

const ET_TZ = "America/New_York";

// Keep this small + practical (reduce typos)
const ROUTE_PRESETS: { label: string; value: string }[] = [
  { label: "Messages", value: "/messages" },
  { label: "Tonight", value: "/tonight" },
  { label: "Calendar", value: "/calendar" },
  { label: "Rewards", value: "/rewards" },
  { label: "VIP / Free Drink", value: "/free-drink" },
  { label: "Sponsors", value: "/sponsors" },
  { label: "Menu", value: "/menu" },
];

function formatDateEt(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: ET_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function clampStr(s: string, max: number) {
  const clean = (s ?? "").toString();
  return clean.length > max ? clean.slice(0, max) : clean;
}

// Some gentle length targets (not hard limits)
const TITLE_SOFT_MAX = 48;
const BODY_SOFT_MAX = 140;

export default function NotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [route, setRoute] = useState("/messages");
  const [audience, setAudience] = useState<Audience>("all");
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<null | { type: "success" | "error"; message: string }>(null);

  const [latestLog, setLatestLog] = useState<NotificationLog | null>(null);
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const titleCount = title.length;
  const bodyCount = body.length;

  const previewTitle = title.trim() || "Sugarshack Downtown";
  const previewBody =
    body.trim() || "New message from Sugarshack Downtown. Tap to open your in-app messages.";

  const canSend = useMemo(() => {
    return !!title.trim() && !!body.trim() && !isSending;
  }, [title, body, isSending]);

  async function loadLogs() {
    try {
      const res = await fetch("/api/notifications/logs");
      if (!res.ok) return;
      const data = await res.json();
      const logs = (data.logs || []) as NotificationLog[];

      if (logs.length > 0) {
        setLatestLog(logs[0]);
        setHistory(logs.slice(1));
      } else {
        setLatestLog(null);
        setHistory([]);
      }
    } catch (err) {
      console.error("Failed to load notification logs", err);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!title.trim() || !body.trim()) {
      setStatus({ type: "error", message: "Title and message are required." });
      return;
    }

    // Clean + guard against accidental huge strings
    const cleanTitle = clampStr(title.trim(), 120);
    const cleanBody = clampStr(body.trim(), 500);
    const cleanRoute = (route.trim() || "/messages").trim();
    const cleanAudience: Audience = audience;

    try {
      setIsSending(true);

      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          body: cleanBody,
          route: cleanRoute,
          audience: cleanAudience,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to send notification.");
      }

      setStatus({ type: "success", message: "Notification queued and sent to Expo. 🎉" });

      // Audit log
      void logDashboardEvent({
        action: "create",
        entity: "notifications",
        entityId: json?.log_id ?? null,
        details: {
          source: "notifications-page",
          title: cleanTitle,
          body: cleanBody,
          route: cleanRoute,
          audience: cleanAudience,
          sent_count: json?.sent_count ?? null,
        },
      });

      // Reset form
      setTitle("");
      setBody("");
      setRoute("/messages");
      setAudience("all");

      // Refresh logs
      void loadLogs();
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err?.message || "Something went wrong while sending.",
      });
    } finally {
      setIsSending(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("Delete this notification log?");
    if (!ok) return;

    try {
      setDeletingId(id);

      const res = await fetch("/api/notifications/logs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete log.");
      }

      // Audit log delete
      void logDashboardEvent({
        action: "delete",
        entity: "notifications",
        entityId: id,
        details: { source: "notifications-page", note: "Deleted notification log row" },
      });

      await loadLogs();
    } catch (err) {
      console.error("[notifications] delete error", err);
      alert("Could not delete this log. Check the server logs for details.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <DashboardShell
      title="Push notifications"
      subtitle="Send targeted updates to VIPs and Sugarshack app users."
      activeTab="notifications"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(260px,2fr)]">
        {/* LEFT: compose form */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Compose notification</h2>
            <p className="text-xs text-slate-500 mb-4">
              Short, punchy messages perform best. Think “What’s happening right now at Sugarshack?”
            </p>

            <form onSubmit={handleSend} className="space-y-4">
              {/* Audience */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">Audience</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "all", label: "All users" },
                    { key: "vip", label: "VIPs only" },
                    { key: "test", label: "Test device" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setAudience(opt.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        audience === opt.key
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {audience === "test" && (
                  <p className="mt-2 text-[11px] text-amber-700">
                    Tip: “Test device” is safest first. If nothing arrives, confirm your test token exists server-side.
                  </p>
                )}
              </div>

              {/* Title */}
              <div>
                <div className="flex items-end justify-between gap-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Title</label>
                  <span className={`text-[11px] ${titleCount > TITLE_SOFT_MAX ? "text-rose-600" : "text-slate-400"}`}>
                    {titleCount}/{TITLE_SOFT_MAX}
                  </span>
                </div>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="Tonight at Sugarshack…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                {titleCount > TITLE_SOFT_MAX && (
                  <p className="mt-1 text-[11px] text-rose-600">Consider shortening the title for better lock-screen fit.</p>
                )}
              </div>

              {/* Body */}
              <div>
                <div className="flex items-end justify-between gap-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Message</label>
                  <span className={`text-[11px] ${bodyCount > BODY_SOFT_MAX ? "text-rose-600" : "text-slate-400"}`}>
                    {bodyCount}/{BODY_SOFT_MAX}
                  </span>
                </div>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="Short description of the event, special, or reward."
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                {bodyCount > BODY_SOFT_MAX && (
                  <p className="mt-1 text-[11px] text-rose-600">Long messages may truncate. Keep the first sentence strongest.</p>
                )}
              </div>

              {/* Route */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Target screen (optional)</label>

                <div className="flex flex-wrap gap-2 mb-2">
                  {ROUTE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setRoute(p.value)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                        route === p.value
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="/messages, /calendar, /rewards"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Examples: <code>/messages</code>, <code>/calendar</code>, <code>/rewards</code>
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
                  disabled={!canSend}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-950 text-white text-xs font-medium px-4 py-2 shadow-sm hover:bg-slate-900 disabled:opacity-60"
                >
                  {isSending ? "Sending…" : "Send notification"}
                </button>
                <p className="text-[11px] text-slate-400">
                  Sent via Expo push service. Delivery depends on device settings and connectivity.
                </p>
              </div>
            </form>
          </div>
        </section>

        {/* RIGHT: preview, tips, history */}
        <section className="space-y-4">
          {/* Preview */}
          <div className="bg-slate-950 text-slate-50 rounded-2xl border border-slate-800 shadow-sm p-4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400 mb-2">Lock screen preview</p>
            <div className="bg-slate-900 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Now • Sugarshack Downtown</span>
                <span>iOS preview</span>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-white">{previewTitle}</p>
                <p className="text-[11px] text-slate-200 whitespace-pre-line">{previewBody}</p>
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

          {/* Last message + older history */}
          {latestLog && (
            <div className="space-y-3">
              {/* Last message sent */}
              <div className="bg-slate-950 text-slate-50 rounded-2xl border border-slate-800 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400 mb-1">Last message sent</p>
                    <p className="text-[11px] text-slate-400">
                      {formatDateEt(latestLog.created_at)} · {latestLog.audience.toUpperCase()}
                    </p>
                    <p className="text-sm font-semibold mt-2">{latestLog.title}</p>
                    <p className="text-xs text-slate-200 mt-1">{latestLog.body}</p>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Route: {latestLog.route ?? "/messages"} · Sent to {latestLog.sent_count ?? 0} device(s)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(latestLog.id)}
                    disabled={deletingId === latestLog.id}
                    className="text-[11px] rounded-full border border-slate-500 px-2 py-1 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {deletingId === latestLog.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>

              {/* Older history */}
              {history.length > 0 && (
                <details className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <summary className="cursor-pointer text-xs text-slate-600 mb-2">
                    Show older history ({history.length})
                  </summary>
                  <div className="space-y-3 mt-2">
                    {history.map((log) => (
                      <div key={log.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-slate-500">
                              {formatDateEt(log.created_at)} · {log.audience.toUpperCase()}
                            </p>
                            <p className="text-sm font-medium text-slate-900">{log.title}</p>
                            <p className="text-xs text-slate-700">{log.body}</p>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Route: {log.route ?? "/messages"} · Sent to {log.sent_count ?? 0} device(s)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(log.id)}
                            disabled={deletingId === log.id}
                            className="self-start text-[11px] rounded-full border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          >
                            {deletingId === log.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {!latestLog && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-xs text-slate-600">
              No notification history yet. Send a <span className="font-semibold">Test device</span> push first to verify delivery.
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
