// app/feedback/page.tsx
// Path: /feedback
// Sugarshack Downtown - Guest Feedback
// Original table-style UI with added summary cards (totals + averages).

import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { getDashboardSession } from "@/lib/dashboardAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: string;
  music_rating: number | null;
  food_rating: number | null;
  fun_rating: number | null;
  comment: string | null;
  anonymous: boolean | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  submitted_at: string | null;
  created_at: string | null;
};

function formatDateLabel(iso: string | null): string {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRating(value: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${value}/5`;
}

function safeAvg(values: (number | null)[]): number | null {
  const nums = values
    .map((v) => (v == null ? null : Number(v)))
    .filter((v) => v != null && Number.isFinite(v)) as number[];
  if (!nums.length) return null;
  const sum = nums.reduce((acc, v) => acc + v, 0);
  return sum / nums.length;
}

export default async function FeedbackPage() {
  const session = await getDashboardSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("feedback")
    .select(
      "id, music_rating, food_rating, fun_rating, comment, anonymous, contact_name, contact_email, contact_phone, submitted_at, created_at"
    )
    .order("submitted_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("[feedback] load error", error);
  }

  const rows: FeedbackRow[] = (data ?? []) as FeedbackRow[];

  const totalResponses = rows.length;
  const avgMusic = safeAvg(rows.map((r) => r.music_rating));
  const avgFood = safeAvg(rows.map((r) => r.food_rating));
  const avgFun = safeAvg(rows.map((r) => r.fun_rating));

  return (
    <DashboardShell
      activeTab="feedback"
      title="Guest feedback"
      subtitle="See what guests are saying about the music, food, and overall vibe."
    >
      <div className="space-y-6">
        {/* Summary cards row */}
        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Total feedback"
            helper="All submissions from the app (latest 300 shown)."
            value={totalResponses}
          />
          <SummaryCard
            label="Average music"
            helper="1–5 rating (higher is better)."
            value={avgMusic != null ? avgMusic.toFixed(1) : "—"}
          />
          <SummaryCard
            label="Average food & drink"
            helper="1–5 rating (higher is better)."
            value={avgFood != null ? avgFood.toFixed(1) : "—"}
          />
          <SummaryCard
            label="Average fun / vibe"
            helper="1–5 rating (higher is better)."
            value={avgFun != null ? avgFun.toFixed(1) : "—"}
          />
        </section>

        {/* Detailed table */}
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Feedback submissions
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Newest first. Use this to spot patterns and follow up with guests who left contact info.
              </p>
            </div>
            {rows.length > 0 && (
              <p className="text-[11px] text-slate-500">
                Showing latest {rows.length} responses
              </p>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No feedback yet. Once guests submit feedback from the app, it will appear here.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3 text-left font-semibold">
                      Submitted
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Music
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Food
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Fun
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Comment
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Name
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Email
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Phone
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isAnonymous = !!row.anonymous;
                    const hasComment =
                      row.comment && row.comment.trim().length > 0;

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-50 align-top last:border-0"
                      >
                        {/* Submitted at */}
                        <td className="py-2 pr-3 text-[11px] text-slate-600 whitespace-nowrap">
                          {formatDateLabel(row.submitted_at ?? row.created_at)}
                        </td>

                        {/* Ratings */}
                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {formatRating(row.music_rating)}
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {formatRating(row.food_rating)}
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {formatRating(row.fun_rating)}
                        </td>

                        {/* Comment */}
                        <td className="py-2 pr-3 text-[11px] text-slate-800">
                          {hasComment ? (
                            row.comment!.trim()
                          ) : (
                            <span className="text-slate-400">No comment</span>
                          )}
                        </td>

                        {/* Name / email / phone */}
                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {row.contact_name ? (
                            row.contact_name
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {row.contact_email ? (
                            row.contact_email
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-[11px] whitespace-nowrap">
  {(() => {
    const raw = row.contact_phone?.trim() ?? "";
    const digits = raw.replace(/\D/g, "");

    // 10-digit US number = valid
    const isValid = digits.length === 10;

    if (!raw) {
      return <span className="text-slate-400">—</span>;
    }

    if (!isValid) {
      return (
        <span className="text-red-600 font-medium" title="Invalid phone number">
          {raw}
        </span>
      );
    }

    // Format valid 10-digit number
    const formatted = `(${digits.slice(0, 3)}) ${digits.slice(
      3,
      6
    )}-${digits.slice(6, 10)}`;

    return <span className="text-slate-800">{formatted}</span>;
  })()}
</td>


                        {/* Anonymous vs identified */}
                        <td className="py-2 pr-3 text-[11px] whitespace-nowrap">
                          {isAnonymous ? (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-[10px] text-slate-600">
                              Anonymous
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-[10px] text-emerald-800">
                              Identified
                            </span>
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

// --- Presentational helper ---------------------------------------------------

type SummaryCardProps = {
  label: string;
  helper: string;
  value: string | number;
};

function SummaryCard({ label, helper, value }: SummaryCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}
