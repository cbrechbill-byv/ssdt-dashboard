import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type LogRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: any | null;
};

export const dynamic = "force-dynamic";

async function getLogs(): Promise<LogRow[]> {
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from<LogRow>("dashboard_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[ActivityLog] failed to load logs:", error);
    return [];
  }

  return data ?? [];
}

export default async function ActivityLogPage() {
  const logs = await getLogs();

  return (
    <DashboardShell
      title="Activity log"
      subtitle="See who changed what on the dashboard."
      activeTab="activity"
    >
      <div className="space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Activity log
            </h2>
            <p className="text-xs text-slate-600">
              Last 200 dashboard actions recorded by the audit log system.
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">
              No activity has been recorded yet. Once actions are wired to the
              audit log, they will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Entity</th>
                    <th className="px-3 py-2">Record</th>
                    <th className="px-3 py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const date = new Date(log.created_at);
                    const timeString = isNaN(date.getTime())
                      ? log.created_at
                      : date.toLocaleString();

                    return (
                      <tr
                        key={log.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                      >
                        <td className="px-3 py-2 align-top text-[11px] text-slate-600 whitespace-nowrap">
                          {timeString}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px]">
                          {log.actor_email ?? "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px]">
                          {log.actor_role ?? "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] font-semibold uppercase tracking-wide">
                          {log.action}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px]">
                          {log.entity}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                          {log.entity_id ?? "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-slate-500 max-w-xs">
                          {log.details ? (
                            <pre className="whitespace-pre-wrap break-words rounded bg-slate-900/95 px-2 py-1 text-[10px] text-slate-100">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
