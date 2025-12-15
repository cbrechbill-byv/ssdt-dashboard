// app/feedback/page.tsx
// Path: /feedback
// Sugarshack Downtown - Guest Feedback
// Upgraded view: actionable summary, sentiment buckets, and “needs follow-up” queue + original table.

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

function clampRating(v: number | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const c = Math.max(1, Math.min(5, n));
  return c;
}

function getOverallScore(row: FeedbackRow): number | null {
  const vals = [clampRating(row.music_rating), clampRating(row.food_rating), clampRating(row.fun_rating)].filter(
    (v): v is number => v != null
  );
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getPhoneDigits(raw: string | null): string {
  return (raw ?? "").trim().replace(/\D/g, "");
}

function formatPhonePretty(raw: string | null): { label: string; isValid: boolean; hasValue: boolean } {
  const original = (raw ?? "").trim();
  if (!original) return { label: "—", isValid: false, hasValue: false };

  const digits = getPhoneDigits(original);

  // accept 11-digit starting with 1, normalize to 10
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (normalized.length !== 10) {
    return { label: original, isValid: false, hasValue: true };
  }

  const formatted = `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6, 10)}`;
  return { label: formatted, isValid: true, hasValue: true };
}

function ratingTone(r: number | null): "good" | "meh" | "bad" | "none" {
  if (r == null) return "none";
  if (r >= 4.5) return "good";
  if (r >= 3.5) return "meh";
  return "bad";
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "meh" | "bad";
}) {
  const cls =
    tone === "good"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "meh"
      ? "bg-amber-100 text-amber-800"
      : tone === "bad"
      ? "bg-rose-100 text-rose-800"
      : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide text-[10px] ${cls}`}
    >
      {children}
    </span>
  );
}

export default async function FeedbackPage() {
  const session = await getDashboardSession();
  if (!session) redirect("/login");

  const supabase = supabaseServer;

  const now = new Date();
  const start7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); // last 7 days incl today
  const start30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("feedback")
    .select(
      "id, music_rating, food_rating, fun_rating, comment, anonymous, contact_name, contact_email, contact_phone, submitted_at, created_at"
    )
    .order("submitted_at", { ascending: false })
    .limit(500);

  if (error) console.error("[feedback] load error", error);

  const rows: FeedbackRow[] = (data ?? []) as FeedbackRow[];

  const totalResponses = rows.length;

  const avgMusic = safeAvg(rows.map((r) => r.music_rating));
  const avgFood = safeAvg(rows.map((r) => r.food_rating));
  const avgFun = safeAvg(rows.map((r) => r.fun_rating));

  // time-windowed views (computed in memory from latest 500)
  const submittedAt = (r: FeedbackRow) => new Date(r.submitted_at ?? r.created_at ?? 0);
  const rows7 = rows.filter((r) => submittedAt(r).getTime() >= start7.getTime());
  const rows30 = rows.filter((r) => submittedAt(r).getTime() >= start30.getTime());

  const avgOverallAll = safeAvg(rows.map((r) => getOverallScore(r)));
  const avgOverall7 = safeAvg(rows7.map((r) => getOverallScore(r)));
  const avgOverall30 = safeAvg(rows30.map((r) => getOverallScore(r)));

  const withComment = rows.filter((r) => (r.comment ?? "").trim().length > 0);
  const withContact = rows.filter((r) => {
    const hasEmail = !!(r.contact_email ?? "").trim();
    const phone = formatPhonePretty(r.contact_phone);
    const hasName = !!(r.contact_name ?? "").trim();
    return hasEmail || (phone.hasValue && phone.isValid) || hasName;
  });

  // actionable: negative + identified contact, or strong comment with contact
  const needsFollowUp = rows.filter((r) => {
    if (r.anonymous) return false;

    const score = getOverallScore(r);
    const comment = (r.comment ?? "").trim().toLowerCase();
    const hasComment = comment.length > 0;

    const hasEmail = !!(r.contact_email ?? "").trim();
    const phone = formatPhonePretty(r.contact_phone);
    const hasPhone = phone.hasValue && phone.isValid;
    const hasAnyContact = hasEmail || hasPhone;

    const negative = score != null && score < 3.5;
    const containsHelpWords =
      comment.includes("manager") ||
      comment.includes("refund") ||
      comment.includes("bad") ||
      comment.includes("rude") ||
      comment.includes("dirty") ||
      comment.includes("slow") ||
      comment.includes("overpriced") ||
      comment.includes("issue") ||
      comment.includes("problem");

    return hasAnyContact && (negative || (hasComment && containsHelpWords));
  });

  // quick distribution (overall score buckets)
  const bucket = (score: number | null): "great" | "ok" | "poor" | "na" => {
    if (score == null) return "na";
    if (score >= 4.5) return "great";
    if (score >= 3.5) return "ok";
    return "poor";
  };

  const dist = rows.reduce(
    (acc, r) => {
      const b = bucket(getOverallScore(r));
      acc[b] += 1;
      return acc;
    },
    { great: 0, ok: 0, poor: 0, na: 0 }
  );

  const topIssueArea = (() => {
    const m = safeAvg(rows.map((r) => r.music_rating)) ?? 0;
    const f = safeAvg(rows.map((r) => r.food_rating)) ?? 0;
    const fun = safeAvg(rows.map((r) => r.fun_rating)) ?? 0;

    const pairs = [
      { key: "Music", val: m },
      { key: "Food & Drink", val: f },
      { key: "Fun / Vibe", val: fun },
    ].sort((a, b) => a.val - b.val);

    // If everything is empty, return null-ish
    if ((safeAvg(rows.map((r) => r.music_rating)) ?? null) == null &&
        (safeAvg(rows.map((r) => r.food_rating)) ?? null) == null &&
        (safeAvg(rows.map((r) => r.fun_rating)) ?? null) == null) {
      return null;
    }

    return pairs[0].key;
  })();

  return (
    <DashboardShell
      activeTab="feedback"
      title="Guest feedback"
      subtitle="See what guests are saying — and what needs attention first."
    >
      <div className="space-y-6">
        {/* Action summary */}
        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Needs follow-up"
            helper="Identified submissions with low scores or urgent comments."
            value={needsFollowUp.length}
            tone={needsFollowUp.length > 0 ? "bad" : "neutral"}
          />
          <SummaryCard
            label="Avg overall (7 days)"
            helper="Average of music/food/fun where provided."
            value={avgOverall7 != null ? avgOverall7.toFixed(2) : "—"}
            tone={avgOverall7 != null ? (avgOverall7 >= 4.0 ? "good" : avgOverall7 >= 3.5 ? "meh" : "bad") : "neutral"}
          />
          <SummaryCard
            label="Avg overall (30 days)"
            helper="Rolling 30-day quality signal."
            value={avgOverall30 != null ? avgOverall30.toFixed(2) : "—"}
            tone={avgOverall30 != null ? (avgOverall30 >= 4.0 ? "good" : avgOverall30 >= 3.5 ? "meh" : "bad") : "neutral"}
          />
          <SummaryCard
            label="Most at-risk area"
            helper="Lowest average category across all responses."
            value={topIssueArea ?? "—"}
            tone={topIssueArea ? "meh" : "neutral"}
          />
        </section>

        {/* Classic totals + category averages */}
        <section className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Total feedback"
            helper="Latest 500 shown."
            value={totalResponses}
          />
          <SummaryCard
            label="Average music"
            helper="1–5 rating (higher is better)."
            value={avgMusic != null ? avgMusic.toFixed(1) : "—"}
            tone={avgMusic != null ? (avgMusic >= 4.0 ? "good" : avgMusic >= 3.5 ? "meh" : "bad") : "neutral"}
          />
          <SummaryCard
            label="Average food & drink"
            helper="1–5 rating (higher is better)."
            value={avgFood != null ? avgFood.toFixed(1) : "—"}
            tone={avgFood != null ? (avgFood >= 4.0 ? "good" : avgFood >= 3.5 ? "meh" : "bad") : "neutral"}
          />
          <SummaryCard
            label="Average fun / vibe"
            helper="1–5 rating (higher is better)."
            value={avgFun != null ? avgFun.toFixed(1) : "—"}
            tone={avgFun != null ? (avgFun >= 4.0 ? "good" : avgFun >= 3.5 ? "meh" : "bad") : "neutral"}
          />
        </section>

        {/* Signal cards */}
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Responses with comments"
            value={`${withComment.length} / ${totalResponses}`}
            helper="Comments are where the real stories show up."
          />
          <StatCard
            label="Responses with contact info"
            value={`${withContact.length} / ${totalResponses}`}
            helper="Reach-back possible (name/email/valid phone)."
          />
          <StatCard
            label="Overall distribution"
            value={
              <div className="flex flex-wrap gap-2">
                <Chip tone="good">Great {dist.great}</Chip>
                <Chip tone="meh">OK {dist.ok}</Chip>
                <Chip tone="bad">Poor {dist.poor}</Chip>
                {dist.na > 0 ? <Chip>NA {dist.na}</Chip> : null}
              </div>
            }
            helper="Based on overall score buckets."
          />
        </section>

        {/* Follow-up queue */}
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Follow-up queue
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Identified submissions that likely need a reach-out (low overall score or urgent wording).
              </p>
            </div>
            <p className="text-[11px] text-slate-500">
              {needsFollowUp.length} item{needsFollowUp.length === 1 ? "" : "s"}
            </p>
          </div>

          {needsFollowUp.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Nothing urgent right now. Keep an eye on low scores with contact info.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3 text-left font-semibold">Submitted</th>
                    <th className="py-2 pr-3 text-left font-semibold">Overall</th>
                    <th className="py-2 pr-3 text-left font-semibold">Name</th>
                    <th className="py-2 pr-3 text-left font-semibold">Email</th>
                    <th className="py-2 pr-3 text-left font-semibold">Phone</th>
                    <th className="py-2 pr-3 text-left font-semibold">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {needsFollowUp.slice(0, 25).map((row) => {
                    const score = getOverallScore(row);
                    const phone = formatPhonePretty(row.contact_phone);

                    return (
                      <tr key={row.id} className="border-b border-slate-50 align-top last:border-0">
                        <td className="py-2 pr-3 text-[11px] text-slate-600 whitespace-nowrap">
                          {formatDateLabel(row.submitted_at ?? row.created_at)}
                        </td>
                        <td className="py-2 pr-3 text-[11px] whitespace-nowrap">
                          {score == null ? (
                            <span className="text-slate-400">—</span>
                          ) : score >= 4.0 ? (
                            <Chip tone="good">{score.toFixed(2)}</Chip>
                          ) : score >= 3.5 ? (
                            <Chip tone="meh">{score.toFixed(2)}</Chip>
                          ) : (
                            <Chip tone="bad">{score.toFixed(2)}</Chip>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {row.contact_name?.trim() ? row.contact_name : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {row.contact_email?.trim() ? (
                            <a
                              className="text-sky-700 hover:underline underline-offset-2"
                              href={`mailto:${row.contact_email.trim()}`}
                            >
                              {row.contact_email.trim()}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-[11px] whitespace-nowrap">
                          {!phone.hasValue ? (
                            <span className="text-slate-400">—</span>
                          ) : phone.isValid ? (
                            <a
                              className="text-sky-700 hover:underline underline-offset-2"
                              href={`tel:${getPhoneDigits(row.contact_phone)}`}
                            >
                              {phone.label}
                            </a>
                          ) : (
                            <span className="text-rose-700 font-medium" title="Invalid phone number">
                              {phone.label}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-800">
                          {(row.comment ?? "").trim() ? (
                            (row.comment ?? "").trim()
                          ) : (
                            <span className="text-slate-400">No comment</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {needsFollowUp.length > 25 && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Showing top 25. Use the full table below for all results.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Detailed table (original, with a new Overall column + better contact links) */}
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
              <p className="text-[11px] text-slate-500">Showing latest {rows.length} responses</p>
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
                    <th className="py-2 pr-3 text-left font-semibold">Submitted</th>
                    <th className="py-2 pr-3 text-left font-semibold">Overall</th>
                    <th className="py-2 pr-3 text-left font-semibold">Music</th>
                    <th className="py-2 pr-3 text-left font-semibold">Food</th>
                    <th className="py-2 pr-3 text-left font-semibold">Fun</th>
                    <th className="py-2 pr-3 text-left font-semibold">Comment</th>
                    <th className="py-2 pr-3 text-left font-semibold">Name</th>
                    <th className="py-2 pr-3 text-left font-semibold">Email</th>
                    <th className="py-2 pr-3 text-left font-semibold">Phone</th>
                    <th className="py-2 pr-3 text-left font-semibold">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isAnonymous = !!row.anonymous;
                    const hasComment = (row.comment ?? "").trim().length > 0;
                    const score = getOverallScore(row);
                    const phone = formatPhonePretty(row.contact_phone);

                    return (
                      <tr key={row.id} className="border-b border-slate-50 align-top last:border-0">
                        <td className="py-2 pr-3 text-[11px] text-slate-600 whitespace-nowrap">
                          {formatDateLabel(row.submitted_at ?? row.created_at)}
                        </td>

                        <td className="py-2 pr-3 text-[11px] whitespace-nowrap">
                          {score == null ? (
                            <span className="text-slate-400">—</span>
                          ) : score >= 4.0 ? (
                            <Chip tone="good">{score.toFixed(2)}</Chip>
                          ) : score >= 3.5 ? (
                            <Chip tone="meh">{score.toFixed(2)}</Chip>
                          ) : (
                            <Chip tone="bad">{score.toFixed(2)}</Chip>
                          )}
                        </td>

                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          <span className={ratingTone(row.music_rating) === "bad" ? "text-rose-700 font-semibold" : ""}>
                            {formatRating(row.music_rating)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          <span className={ratingTone(row.food_rating) === "bad" ? "text-rose-700 font-semibold" : ""}>
                            {formatRating(row.food_rating)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          <span className={ratingTone(row.fun_rating) === "bad" ? "text-rose-700 font-semibold" : ""}>
                            {formatRating(row.fun_rating)}
                          </span>
                        </td>

                        <td className="py-2 pr-3 text-[11px] text-slate-800">
                          {hasComment ? row.comment!.trim() : <span className="text-slate-400">No comment</span>}
                        </td>

                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {row.contact_name?.trim() ? row.contact_name : <span className="text-slate-400">—</span>}
                        </td>

                        <td className="py-2 pr-3 text-[11px] text-slate-800 whitespace-nowrap">
                          {row.contact_email?.trim() ? (
                            <a
                              className="text-sky-700 hover:underline underline-offset-2"
                              href={`mailto:${row.contact_email.trim()}`}
                            >
                              {row.contact_email.trim()}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-2 pr-3 text-[11px] whitespace-nowrap">
                          {!phone.hasValue ? (
                            <span className="text-slate-400">—</span>
                          ) : phone.isValid ? (
                            <a
                              className="text-sky-700 hover:underline underline-offset-2"
                              href={`tel:${getPhoneDigits(row.contact_phone)}`}
                            >
                              {phone.label}
                            </a>
                          ) : (
                            <span className="text-rose-700 font-medium" title="Invalid phone number">
                              {phone.label}
                            </span>
                          )}
                        </td>

                        <td className="py-2 pr-3 text-[11px] whitespace-nowrap">
                          {isAnonymous ? (
                            <Chip>Anonymous</Chip>
                          ) : (
                            <Chip tone="good">Identified</Chip>
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

// --- Presentational helpers ---------------------------------------------------

type SummaryCardProps = {
  label: string;
  helper: string;
  value: string | number;
  tone?: "neutral" | "good" | "meh" | "bad";
};

function SummaryCard({ label, helper, value, tone = "neutral" }: SummaryCardProps) {
  const ring =
    tone === "good"
      ? "border-emerald-200"
      : tone === "meh"
      ? "border-amber-200"
      : tone === "bad"
      ? "border-rose-200"
      : "border-slate-200";

  return (
    <div className={`rounded-3xl border ${ring} bg-white px-6 py-4 shadow-sm`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-xl font-semibold text-slate-900">{value}</div>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}
