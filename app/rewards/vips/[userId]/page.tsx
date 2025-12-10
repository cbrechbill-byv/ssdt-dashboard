// app/rewards/vips/[userId]/page.tsx

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import DashboardShell from "@/components/layout/DashboardShell";
import { getDashboardSession } from "@/lib/dashboardAuth";
import Link from "next/link";

type VipUserRow = {
  user_id: string;
  phone: string | null;
  full_name: string | null;
  email: string | null;
  zip: string | null;
  is_vip: boolean;
  notify_artists: boolean | null;
  notify_specials: boolean | null;
  notify_vip_only: boolean | null;
  total_points: number;
  last_scan_at: string | null;
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Server action to update VIP profile
export async function updateVipProfile(formData: FormData) {
  "use server";

  const userId = String(formData.get("user_id") || "");
  const full_name = ((formData.get("full_name") as string) || "").trim() || null;
  const email = ((formData.get("email") as string) || "").trim() || null;
  const zip = ((formData.get("zip") as string) || "").trim() || null;

  const notify_artists = formData.get("notify_artists") === "on";
  const notify_specials = formData.get("notify_specials") === "on";
  const notify_vip_only = formData.get("notify_vip_only") === "on";

  if (!userId) {
    return;
  }

  const supabase = supabaseServer;
  const session = await getDashboardSession();
  const actor_email = session?.email ?? "unknown";
  const actor_role = session?.role ?? "unknown";

  const { error: updateErr } = await supabase
    .from("rewards_users")
    .update({
      full_name,
      email,
      zip,
      notify_artists,
      notify_specials,
      notify_vip_only,
    })
    .eq("user_id", userId);

  if (updateErr) {
    console.error("[VIP edit] error updating rewards_users", updateErr);
  }

  const { error: logErr } = await supabase.from("dashboard_audit_log").insert({
    actor_email,
    actor_role,
    action: "update",
    entity: "rewards_user_profile",
    entity_id: userId,
    details: {
      full_name,
      email,
      zip,
      notify_artists,
      notify_specials,
      notify_vip_only,
      source: "rewards-vip-edit-page",
    },
  });

  if (logErr) {
    console.error("[VIP edit] error writing dashboard_audit_log", logErr);
  }

  revalidatePath("/rewards/vips");
  redirect("/rewards/vips?updated=1");
}

async function loadVip(userId: string): Promise<VipUserRow> {
  const { data, error } = await supabaseServer
    .from("rewards_users")
    .select(
      "user_id, phone, full_name, email, zip, is_vip, notify_artists, notify_specials, notify_vip_only, total_points, last_scan_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[VIP edit] error loading rewards_users row", error);
    throw error;
  }

  if (!data) {
    notFound();
  }

  const row = data as any;

  return {
    user_id: row.user_id,
    phone: row.phone,
    full_name: row.full_name,
    email: row.email,
    zip: row.zip,
    is_vip: !!row.is_vip,
    notify_artists: row.notify_artists ?? true,
    notify_specials: row.notify_specials ?? true,
    notify_vip_only: row.notify_vip_only ?? true,
    total_points: row.total_points ?? 0,
    last_scan_at: row.last_scan_at ?? null,
  };
}

export default async function VipEditPage({
  params,
}: {
  params: { userId: string };
}) {
  const vip = await loadVip(params.userId);

  return (
    <DashboardShell
      activeTab="rewards"
      title="Edit VIP user"
      subtitle="Update contact details and notification preferences for this VIP guest."
    >
      <div className="space-y-6">
        {/* Back link */}
        <div>
          <Link
            href="/rewards/vips"
            className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to VIP users
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          {/* Edit form */}
          <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h1 className="text-lg font-semibold text-slate-900">
              VIP profile
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Use this form to correct names, email addresses, ZIP codes, and
              notification settings.
            </p>

            <form action={updateVipProfile} className="mt-5 space-y-4 text-xs">
              <input type="hidden" name="user_id" value={vip.user_id} />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Phone
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">
                    {vip.phone || "Unknown"}
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="full_name"
                    className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                  >
                    Full name
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    defaultValue={vip.full_name ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                    placeholder="VIP guest name"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="email"
                    className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={vip.email ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                    placeholder="guest@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="zip"
                    className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                  >
                    ZIP code
                  </label>
                  <input
                    id="zip"
                    name="zip"
                    defaultValue={vip.zip ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                    placeholder="e.g. 33904"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Notifications
                </p>
                <ToggleRow
                  id="notify_artists"
                  name="notify_artists"
                  label="Artist announcements"
                  helper="New artists, tonight’s lineup and live music nights."
                  defaultChecked={vip.notify_artists ?? true}
                />
                <ToggleRow
                  id="notify_specials"
                  name="notify_specials"
                  label="Specials & events"
                  helper="Food & drink specials, events and pop-ups."
                  defaultChecked={vip.notify_specials ?? true}
                />
                <ToggleRow
                  id="notify_vip_only"
                  name="notify_vip_only"
                  label="VIP-only perks"
                  helper="Occasional VIP-only surprises and rewards."
                  defaultChecked={vip.notify_vip_only ?? true}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Link
                  href="/rewards/vips"
                  className="rounded-full border border-slate-300 px-4 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-5 py-2 text-[11px] font-semibold text-white hover:bg-slate-800"
                >
                  Save changes
                </button>
              </div>
            </form>
          </section>

          {/* Context card */}
          <aside className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                VIP snapshot
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Quick view of this guest’s current rewards status.
              </p>

              <dl className="mt-4 space-y-2 text-xs text-slate-800">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Points balance</dt>
                  <dd className="font-semibold">{vip.total_points}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Last check-in</dt>
                  <dd className="font-medium">
                    {formatDateTime(vip.last_scan_at)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">VIP status</dt>
                  <dd className="font-medium">
                    {vip.is_vip ? "VIP active" : "Not marked VIP"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-3xl border border-amber-100 bg-amber-50 px-6 py-4 text-xs text-amber-900">
              <p className="font-semibold">Remember</p>
              <p className="mt-1">
                Changes here do not add or remove points. Use the{" "}
                <span className="font-semibold">Adjust points</span> controls on
                the VIP users list for balance changes.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}

function ToggleRow(props: {
  id: string;
  name: string;
  label: string;
  helper: string;
  defaultChecked: boolean;
}) {
  const { id, name, label, helper, defaultChecked } = props;
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start justify-between gap-3"
    >
      <div>
        <p className="text-xs font-medium text-slate-900">{label}</p>
        <p className="text-[11px] text-slate-600">{helper}</p>
      </div>
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
      />
    </label>
  );
}
