import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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

function formatDateEST(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("en-US", {
    timeZone: "America/New_York", // ⬅️ EST/EDT display
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatActionLabel(action: string | null, entity: string | null) {
  if (!action) return "—";
  const a = action.toLowerCase();
  const e = (entity ?? "").toLowerCase();

  if (a === "login") return "Logged in";
  if (a === "logout") return "Logged out";
  if (e === "rewards_staff_code") {
    if (a === "create") return "Created staff code";
    if (a === "delete") return "Deleted staff code";
  }
  if (e === "rewards_menu_item" || e === "reward_menu") {
    if (a === "create") return "Created reward";
    if (a === "update") return "Updated reward";
    if (a === "delete") return "Deleted reward";
  }

  return `${a} ${entity ?? ""}`.trim();
}

function formatDetails(details: any | null): string {
  if (!details) return "";
  try {
    if (typeof details === "string") return details;
    if (details.label && details.source === "staff-codes-page") {
      return `Label: ${details.label}`;
    }
    if (details.name && details.source === "rewards-page") {
      return `Reward: ${details.name}`;
    }
    if (details.source === "dashboard-login-route") {
      return "Dashboard login";
    }
    if (details.source === "dashboard-logout-route") {
      return "Dashboard logout";
    }
    // Fallback: compact JSON
    return JSON.stringify(details);
  } catch {
    return "";
  }
}

export default async function ActivityLogPage() {
  // Require dashboard session (protect the page)
  const session = await getDashboardSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("dashboard_audit_log")
    .select(
      "id, created_at, actor_email, actor_role, action, entity, entity_id, details"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[Activity log] error loading dashboard_audit_log", error);
  }

  const rows = (data ?? []) as AuditRow[];

    return (
    <DashboardShell
      activeTab="activity"
      title="Activity log"
      subtitle="See who changed what in the SSDT dashboard."
    >

      <div className="space-y-4">
        {/* Header card */}
        <div className="rounded-3xl bg-white px-6 py-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs text-slate-600">
            Timestamps are shown in{" "}
            <span className="font-semibold">Eastern Time (EST/EDT)</span>. The
            log includes reward changes, staff code changes, and{" "}
            <span className="font-semibold">login / logout</span> events.
          </p>
        </div>

        {/* Activity table */}
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-600">
              No activity recorded yet. As you and your team use the dashboard,
              this log will capture edits, logins, and logouts.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-900">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 text-left">Time (EST)</th>
                    <th className="py-2 pr-4 text-left">User</th>
                    <th className="py-2 pr-4 text-left">Action</th>
                    <th className="py-2 pr-4 text-left">Entity</th>
                    <th className="py-2 pr-4 text-left">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-4 text-xs text-slate-700">
                        {formatDateEST(row.created_at)}
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-800">
                        <div className="flex flex-col">
                          <span>{row.actor_email ?? "Unknown"}</span>
                          {row.actor_role && (
                            <span className="text-[11px] text-slate-500">
                              {row.actor_role}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-800">
                        {formatActionLabel(row.action, row.entity)}
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-700">
                        {row.entity ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-700">
                        {formatDetails(row.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
