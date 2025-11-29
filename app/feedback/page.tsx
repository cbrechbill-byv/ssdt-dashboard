// app/feedback/page.tsx
import React from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

type FeedbackRow = {
  id: string;
  created_at: string | null;
  visit_date: string | null;
  music_rating: number | null;
  food_rating: number | null;
  fun_rating: number | null;
  comments: string | null;
  vip_name: string | null;
  vip_phone: string | null;
  vip_email: string | null;
};

async function getFeedback(): Promise<FeedbackRow[]> {
  try {
    const { data, error } = await supabaseServer
      .from("feedback")
      .select(
        `
        id,
        created_at,
        visit_date,
        music_rating,
        food_rating,
        fun_rating,
        comments,
        vip_name,
        vip_phone,
        vip_email
      `
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[Dashboard] Failed to load feedback:", error.message ?? error);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("[Dashboard] Unexpected error loading feedback:", err);
    return [];
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

export default async function FeedbackPage() {
  const rows = await getFeedback();

  return (
    <DashboardShell
      title="Feedback"
      subtitle="See what guests are saying about their night at Sugarshack Downtown."
      activeTab="feedback"
    >
      <div className="space-y-4">
        {rows.length === 0 ? (
          <Card>
            <CardHeader>
              <p className="text-sm text-slate-600">
                No feedback has been submitted yet. Once guests start using the app, their
                responses will show up here.
              </p>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardHeader className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-slate-900">
                        {row.vip_name || "Guest"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Visit: {formatDate(row.visit_date)} · Submitted:{" "}
                        {formatDate(row.created_at)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>Music: {row.music_rating ?? "—"}/5</div>
                      <div>Food: {row.food_rating ?? "—"}/5</div>
                      <div>Fun: {row.fun_rating ?? "—"}/5</div>
                    </div>
                  </div>
                  {(row.vip_email || row.vip_phone) && (
                    <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                      {row.vip_email && <div>Email: {row.vip_email}</div>}
                      {row.vip_phone && <div>Phone: {row.vip_phone}</div>}
                    </div>
                  )}
                </CardHeader>
                {row.comments && (
                  <CardContent>
                    <p className="text-sm text-slate-800 whitespace-pre-line">
                      {row.comments}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
