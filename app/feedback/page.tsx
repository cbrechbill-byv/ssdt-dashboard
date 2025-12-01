import React from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";

type FeedbackRow = {
  id: string;
  music_rating: number | null;
  food_rating: number | null;
  fun_rating: number | null;
  comment: string | null;
  anonymous: boolean;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
};

function RatingDots({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-xs text-slate-500">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={[
              "flex h-5 w-5 items-center justify-center rounded-full border text-[11px]",
              n <= value
                ? "bg-amber-400 border-amber-400 text-slate-900"
                : "bg-transparent border-slate-300 text-slate-400",
            ].join(" ")}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactInfo({
  anonymous,
  name,
  email,
  phone,
}: {
  anonymous: boolean;
  name: string | null;
  email: string | null;
  phone: string | null;
}) {
  if (anonymous) {
    return (
      <div className="mt-2 text-xs text-slate-500">
        Submitted anonymously
      </div>
    );
  }

  const hasAny = name || email || phone;
  if (!hasAny) return null;

  return (
    <div className="mt-2 space-y-0.5 text-xs text-slate-500">
      {name && <div>Name: {name}</div>}
      {email && <div>Email: {email}</div>}
      {phone && <div>Phone: {phone}</div>}
    </div>
  );
}

async function getFeedback(): Promise<FeedbackRow[]> {
  try {
    const { data, error } = await supabaseServer
      .from("feedback")
      .select(
        "id, music_rating, food_rating, fun_rating, comment, anonymous, contact_name, contact_email, contact_phone, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error(
        "[Dashboard] Failed to load feedback:",
        (error as any).message || error
      );
      return [];
    }

    return (data || []) as FeedbackRow[];
  } catch (err) {
    console.error("[Dashboard] Unexpected error loading feedback:", err);
    return [];
  }
}

export default async function FeedbackPage() {
  const rows = await getFeedback();

  return (
    <DashboardShell
      title="Feedback"
      subtitle="See how guests are rating the Sugarshack Downtown experience."
      activeTab="feedback"
    >
      <div className="space-y-4">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
            No feedback yet. Once guests start submitting from the app, it will
            appear here.
          </div>
        ) : (
          rows.map((row) => {
            const created = row.created_at
              ? new Date(row.created_at).toLocaleString()
              : "—";

            return (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Guest feedback
                      </h3>
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                          row.anonymous
                            ? "bg-slate-100 text-slate-700"
                            : "bg-emerald-100 text-emerald-800",
                        ].join(" ")}
                      >
                        {row.anonymous ? "Anonymous" : "Contactable"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{created}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
                    <RatingDots label="Music" value={row.music_rating} />
                    <RatingDots label="Food" value={row.food_rating} />
                    <RatingDots label="Fun" value={row.fun_rating} />
                  </div>
                </div>

                {row.comment && (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    {row.comment}
                  </p>
                )}

                <ContactInfo
                  anonymous={row.anonymous}
                  name={row.contact_name}
                  email={row.contact_email}
                  phone={row.contact_phone}
                />
              </div>
            );
          })
        )}
      </div>
    </DashboardShell>
  );
}
