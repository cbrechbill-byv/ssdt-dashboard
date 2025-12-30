// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\activity\page.tsx
// app/activity/page.tsx
// Path: /activity
// Sugarshack Downtown - Dashboard Activity Log
//
// ✅ Improvements:
// - URL filters: q (search), entity, action, range (today|7d|30d|all)
// - ET-aligned date windows (ET -> UTC ISO) for range filtering
// - Action + Entity badges for scannability
// - Better "Details" fallback (compact preview + JSON keys)
// - Keeps expandable JSON panel

import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ET_TZ = "America/New_York";

type AuditRow = {
  id: string;
  created_at: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string | null;
  entity: string | null;
  entity_id: string | null;
  details: any | null;
};

type RangeKey = "today" | "7d" | "30d" | "all";

function formatDateEt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
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

function getEtYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ✅ ET-local wall-clock time -> absolute UTC ISO string (DST-safe)
function etWallClockToUtcIso(ymd: string, hmss: string): string {
  const [Y, M, D] = ymd.split("-").map((x) => Number(x));
  const [h, m, s] = hmss.split(":").map((x) => Number(x));

  const approxUtcMs = Date.UTC(Y, M - 1, D, h, m, s);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(approxUtcMs));

  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = match?.[1] === "-" ? -1 : 1;
  const offH = match ? Number(match[2]) : 0;
  const offM = match?.[3] ? Number(match[3]) : 0;
  const offsetMinutes = sign * (offH * 60 + offM);

  const utcMs = approxUtcMs - offsetMinutes * 60_000;
  return new Date(utcMs).toISOString();
}

function safeJson(details: any): string {
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    try {
      return String(details);
    } catch {
      return "";
    }
  }
}

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function compactDetailsFallback(details: any | null): string {
  if (!details) return "";
  if (typeof details === "string") return details;

  if (isPlainObject(details)) {
    // Prefer these common keys if present
    const preferred = [
      "title",
      "audience",
      "route",
      "sent_count",
      "name",
      "label",
      "tier",
      "sort_order",
      "is_active",
      "source",
      "delta",
      "previous_points",
      "target_points",
    ];

    const bits: string[] = [];

    for (const k of preferred) {
      if (details[k] === undefined || details[k] === null) continue;
      const v = typeof details[k] === "string" ? details[k] : JSON.stringify(details[k]);
      bits.push(`${k}=${v}`);
      if (bits.length >= 4) break;
    }

    if (bits.length) return bits.join(" · ");

    const keys = Object.keys(details);
    if (keys.length) return `keys: ${keys.slice(0, 6).join(", ")}${keys.length > 6 ? "…" : ""}`;
  }

  // Fallback to a short JSON string
  const raw = safeJson(details);
  return raw.length > 140 ? `${raw.slice(0, 140)}…` : raw;
}

function formatActionLabel(action: string | null, entity: string | null) {
  if (!action) return "—";
  const a = action.toLowerCase();
  const e = (entity ?? "").toLowerCase();

  if (a === "login") return "Logged in";
  if (a === "logout") return "Logged out";

  // VIP points adjustments
  if (a === "vip:adjust_points") return "Adjusted VIP points";

  // ✅ Notifications (push)
  if (e === "notifications") {
    if (a === "create") return "Sent push notification";
    if (a === "delete") return "Deleted notification log";
    if (a === "update") return "Updated notification";
  }

  // Staff codes
  if (e === "rewards_staff_code" || e === "staff_codes") {
    if (a === "create") return "Created staff code";
    if (a === "update") return "Updated staff code";
    if (a === "delete") return "Deleted staff code";
  }

  // Rewards menu
  if (e === "rewards_menu_item" || e === "reward_menu" || e === "rewards") {
    if (a === "create") return "Created reward";
    if (a === "update") return "Updated reward";
    if (a === "delete") return "Deleted reward";
  }

  // VIP profile edits
  if (e === "rewards_user_profile" || e === "rewards_users") {
    if (a === "update") return "Updated VIP profile";
  }

  // Sponsors
  if (e === "sponsors") {
    if (a === "create") return "Created sponsor";
    if (a === "update") return "Updated sponsor";
    if (a === "delete") return "Deleted sponsor";
  }

  // Menu items
  if (e === "bar_bites_items" || e === "bar_bites") {
    if (a === "create") return "Created menu item";
    if (a === "update") return "Updated menu item";
    if (a === "delete") return "Deleted menu item";
  }

  // Fan wall
  if (e === "fan_wall_posts" || e === "fan_wall") {
    if (a === "create") return "Created fan wall post";
    if (a === "update") return "Updated fan wall post";
    if (a === "delete") return "Deleted fan wall post";
  }

  return `${a} ${entity ?? ""}`.trim();
}

function entityGroupLabel(entity: string | null): string {
  const e = (entity ?? "").toLowerCase();
  if (!e) return "Other";

  if (e.includes("login") || e.includes("auth")) return "Auth";
  if (e === "notifications" || e.includes("notification")) return "Notifications";
  if (e.includes("staff") || e.includes("code")) return "Staff";
  if (e.includes("reward") || e.includes("rewards")) return "Rewards";
  if (e.includes("vip") || e.includes("users")) return "VIP";
  if (e.includes("sponsor")) return "Sponsors";
  if (e.includes("bar_bites") || e.includes("menu")) return "Menu";
  if (e.includes("fan_wall")) return "Fan Wall";

  return "Other";
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "emerald" | "amber" | "rose";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : tone === "rose"
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-200 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function actionTone(action: string | null): "slate" | "emerald" | "amber" | "rose" {
  const a = (action ?? "").toLowerCase();
  if (a === "create") return "emerald";
  if (a === "update") return "amber";
  if (a === "delete") return "rose";
  if (a === "login" || a === "logout") return "slate";
  if (a.startsWith("vip:")) return "amber";
  return "slate";
}

function entityTone(entity: string | null): "slate" | "emerald" | "amber" | "rose" {
  const group = entityGroupLabel(entity);
  if (group === "Notifications") return "slate";
  if (group === "Rewards") return "amber";
  if (group === "VIP") return "emerald";
  if (group === "Sponsors") return "amber";
  if (group === "Menu") return "slate";
  if (group === "Fan Wall") return "slate";
  if (group === "Staff") return "slate";
  return "slate";
}

function normalizeOpt(v: string | null | undefined) {
  const s = (v ?? "").trim();
  return s.length ? s : "";
}

export default async function ActivityLogPage(props: {
  searchParams?: Promise<{ q?: string; entity?: string; action?: string; range?: RangeKey }>;
}) {
  // Protect the page
  const session = await getDashboardSession();
  if (!session) redirect("/login");

  const sp = (await props.searchParams) ?? {};
  const q = normalizeOpt(sp.q);
  const entity = normalizeOpt(sp.entity);
  const action = normalizeOpt(sp.action);
  const range: RangeKey = (sp.range as RangeKey) ?? "7d";

  const supabase = supabaseServer;

  // Range bounds (ET -> UTC ISO)
  const todayEt = getEtYmd();
  let gteUtc: string | null = null;
  let lteUtc: string | null = null;

  if (range === "today") {
    gteUtc = etWallClockToUtcIso(todayEt, "00:00:00");
    lteUtc = etWallClockToUtcIso(todayEt, "23:59:59");
  } else if (range === "7d") {
    // start of day 6 days ago through end of today
    const start = new Date(new Date().toLocaleString("en-US", { timeZone: ET_TZ }));
    start.setDate(start.getDate() - 6);
    const startYmd = getEtYmd(start);
    gteUtc = etWallClockToUtcIso(startYmd, "00:00:00");
    lteUtc = etWallClockToUtcIso(todayEt, "23:59:59");
  } else if (range === "30d") {
    const start = new Date(new Date().toLocaleString("en-US", { timeZone: ET_TZ }));
    start.setDate(start.getDate() - 29);
    const startYmd = getEtYmd(start);
    gteUtc = etWallClockToUtcIso(startYmd, "00:00:00");
    lteUtc = etWallClockToUtcIso(todayEt, "23:59:59");
  }

  // Query
  let query = supabase
    .from("dashboard_audit_log")
    .select("id, created_at, actor_email, actor_role, action, entity, entity_id, details")
    .order("created_at", { ascending: false })
    .limit(200);

  if (gteUtc) query = query.gte("created_at", gteUtc);
  if (lteUtc) query = query.lte("created_at", lteUtc);

  if (entity) query = query.eq("entity", entity);
  if (action) query = query.eq("action", action);

  // Search across multiple fields (including jsonb via ::text)
  if (q) {
    const escaped = q.replace(/,/g, "");
    query = query.or(
      [
        `actor_email.ilike.%${escaped}%`,
        `actor_role.ilike.%${escaped}%`,
        `action.ilike.%${escaped}%`,
        `entity.ilike.%${escaped}%`,
        `entity_id.ilike.%${escaped}%`,
        `details::text.ilike.%${escaped}%`,
      ].join(",")
    );
  }

  const { data, error } = await query;

  if (error) console.error("[Activity log] error loading dashboard_audit_log", error);

  const rows = (data ?? []) as AuditRow[];

  // Build filter options from the returned rows (simple + practical)
  const entityOptions = Array.from(new Set(rows.map((r) => r.entity).filter(Boolean) as string[])).sort();
  const actionOptions = Array.from(new Set(rows.map((r) => r.action).filter(Boolean) as string[])).sort();

  const anyFilters = !!q || !!entity || !!action || range !== "7d";

  return (
    <DashboardShell activeTab="activity" title="Activity log" subtitle="See who changed what in the SSDT dashboard (ET time).">
      <div className="space-y-4">
        {/* Header + filters */}
        <div className="rounded-3xl bg-white px-6 py-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs text-slate-600">
            Timestamps are shown in <span className="font-semibold">Eastern Time (ET)</span>. Use filters to find staff activity,
            rewards edits, VIP changes, sponsor/menu updates, notifications, and{" "}
            <span className="font-semibold">login / logout</span>.
          </p>

          <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Search</label>
              <input
                name="q"
                defaultValue={q}
                placeholder="Search email, action, entity, id, details…"
                className="w-64 max-w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Range</label>
              <select
                name="range"
                defaultValue={range}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time (latest 200)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Entity</label>
              <select
                name="entity"
                defaultValue={entity}
                className="min-w-[180px] rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
              >
                <option value="">All</option>
                {entityOptions.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Action</label>
              <select
                name="action"
                defaultValue={action}
                className="min-w-[160px] rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
              >
                <option value="">All</option>
                {actionOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="inline-flex items-center rounded-full bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-amber-500"
            >
              Apply
            </button>

            {anyFilters && (
              <Link href="/activity" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
                Clear
              </Link>
            )}

            <div className="ml-auto text-[11px] text-slate-400">
              Showing <span className="font-semibold text-slate-600">{rows.length}</span> of 200 (latest)
            </div>
          </form>
        </div>

        {/* Activity table */}
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-600">No activity matches your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-900">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 text-left">Time (ET)</th>
                    <th className="py-2 pr-4 text-left">User</th>
                    <th className="py-2 pr-4 text-left">Action</th>
                    <th className="py-2 pr-4 text-left">Entity</th>
                    <th className="py-2 pr-4 text-left">Details</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const detailsFallback = compactDetailsFallback(row.details);
                    const showJson = row.details != null && typeof row.details !== "string";
                    const actionLabel = formatActionLabel(row.action, row.entity);

                    return (
                      <tr key={row.id} className="align-top">
                        <td className="py-2 pr-4 text-xs text-slate-700 whitespace-nowrap">
                          {formatDateEt(row.created_at)}
                        </td>

                        <td className="py-2 pr-4 text-xs text-slate-800 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span>{row.actor_email ?? "Unknown"}</span>
                            {row.actor_role && <span className="text-[11px] text-slate-500">{row.actor_role}</span>}
                          </div>
                        </td>

                        <td className="py-2 pr-4 text-xs text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Badge tone={actionTone(row.action)}>{row.action ?? "—"}</Badge>
                            <span className="text-[11px] text-slate-700">{actionLabel}</span>
                          </div>
                        </td>

                        <td className="py-2 pr-4 text-xs text-slate-700 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Badge tone={entityTone(row.entity)}>{entityGroupLabel(row.entity)}</Badge>
                              <span>{row.entity ?? "—"}</span>
                            </div>
                            {row.entity_id && <span className="text-[11px] text-slate-400">id: {row.entity_id}</span>}
                          </div>
                        </td>

                        <td className="py-2 pr-4 text-xs text-slate-700">
                          {detailsFallback ? (
                            <div className="space-y-2">
                              <div className="leading-relaxed">{detailsFallback}</div>

                              {showJson && (
                                <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    View JSON
                                  </summary>
                                  <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-slate-700">
                                    {safeJson(row.details)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Small footer hint */}
        <div className="text-[11px] text-slate-400">
          Tip: search for a <span className="font-semibold">user_id</span>, an{" "}
          <span className="font-semibold">entity_id</span>, or a keyword like{" "}
          <span className="font-semibold">vip:adjust_points</span>.
        </div>
      </div>
    </DashboardShell>
  );
}
