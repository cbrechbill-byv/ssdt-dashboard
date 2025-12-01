import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type LogRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  actor_role: string | null;
  action: "create" | "update" | "delete" | string;
  entity: string;
  entity_id: string | null;
  details: any;
};

export default async function ActivityLogPage() {
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("dashboard_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as LogRow[];

  return (
    <DashboardShell
      title="Activity Log"
      subtitle="Recent changes made in the SSDT dashboard"
      activeTab="activity"  // ✅ must match DashboardTab type
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Recent Activity
            </h2>
            <p className="text-xs text-slate-500">
              Last {rows.length} actions across artists, events, sponsors,
              notifications, and more.
            </p>
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-200">
            Failed to load activity log: {error.message}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                  Time
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                  User
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                  Action
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                  Entity
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-xs text-slate-500"
                  >
                    No activity yet. Changes to artists, events, sponsors,
                    notifications, and frames will appear here.
                  </td>
                </tr>
              )}

              {rows.map((row) => {
                const when = new Date(row.created_at);
                const timeStr = when.toLocaleString("en-US", {
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const userLabel =
                  row.actor_email ||
                  (row.actor_role ? `(${row.actor_role})` : "Unknown");

                const details =
                  row.details && typeof row.details === "object"
                    ? JSON.stringify(row.details)
                    : row.details?.toString() ?? "";

                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                      {timeStr}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                      {userLabel}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 capitalize">
                        <span
                          className={
                            row.action === "create"
                              ? "h-1.5 w-1.5 rounded-full bg-emerald-500"
                              : row.action === "update"
                              ? "h-1.5 w-1.5 rounded-full bg-sky-500"
                              : row.action === "delete"
                              ? "h-1.5 w-1.5 rounded-full bg-red-500"
                              : "h-1.5 w-1.5 rounded-full bg-slate-400"
                          }
                        />
                        {row.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                      {row.entity}
                      {row.entity_id && (
                        <span className="ml-1 text-[10px] text-slate-400">
                          ({row.entity_id.slice(0, 8)}…)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-xs truncate">
                      {details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
