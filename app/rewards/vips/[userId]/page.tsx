// PATH: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\rewards\vips\[userId]\page.tsx
// app/rewards/vips/[userId]/page.tsx
//
// VIP Edit Profile
// ✅ Rewards consistency:
// - Identity + notification prefs come from rewards_users
// - Totals (points/last_scan_at/is_vip) come from rewards_user_overview (source of truth used by Tonight/Overview)
// ✅ Session enforced in server action
// ✅ Redirect back to this VIP after save (not the list)
// ✅ Sidebar is now "Quick actions + data sources" (removes redundant snapshot)

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import DashboardShell from "@/components/layout/DashboardShell";
import { getDashboardSession } from "@/lib/dashboardAuth";
import Link from "next/link";

const ET_TZ = "America/New_York";

type RewardsUsersRow = {
  user_id: string;
  phone: string | null;
  full_name: string | null;
  email: string | null;
  zip: string | null;
  notify_artists: boolean | null;
  notify_specials: boolean | null;
  notify_vip_only: boolean | null;
};

type RewardsUserOverviewRow = {
  user_id: string | null;
  is_vip: boolean | null;
  total_points: number | null;
  last_scan_at: string | null;
};

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

function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return phone;
}

function formatDateTimeEt(value: string | null): string {
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

// --- Server action -----------------------------------------------------------

export async function updateVipProfile(formData: FormData) {
  "use server";

  const session = await getDashboardSession();
  if (!session) redirect("/login");

  const userId = String(formData.get("user_id") || "").trim();
  if (!userId) return;

  const full_name = ((formData.get("full_name") as string) || "").trim() || null;
  const email = ((formData.get("email") as string) || "").trim() || null;
  const zip = ((formData.get("zip") as string) || "").trim() || null;

  const notify_artists = formData.get("notify_artists") === "on";
  const notify_specials = formData.get("notify_specials") === "on";
  const notify_vip_only = formData.get("notify_vip_only") === "on";

  const supabase = supabaseServer;

  const actor_email = session.email ?? "unknown";
  const actor_role = session.role ?? "unknown";

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

  if (updateErr) console.error("[VIP edit] error updating rewards_users", updateErr);

  const { error: logErr } = await supabase.from("dashboard_audit_log").insert({
    actor_email,
    actor_role,
    action: "rewards_vip:update_profile",
    entity: "rewards_users",
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

  if (logErr) console.error("[VIP edit] error writing dashboard_audit_log", logErr);

  // Revalidate both list + this page
  revalidatePath("/rewards/vips");
  revalidatePath(`/rewards/vips/${userId}`);

  redirect(`/rewards/vips/${userId}?updated=1`);
}

// --- Data loading ------------------------------------------------------------

async function loadVip(userId: string): Promise<VipUserRow> {
  const supabase = supabaseServer;

  const [{ data: u, error: uErr }, { data: o, error: oErr }] = await Promise.all([
    supabase
      .from("rewards_users")
      .select("user_id, phone, full_name, email, zip, notify_artists, notify_specials, notify_vip_only")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("rewards_user_overview")
      .select("user_id, is_vip, total_points, last_scan_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (uErr) {
    console.error("[VIP edit] error loading rewards_users row", uErr);
    throw uErr;
  }
  if (!u) notFound();

  if (oErr) {
    console.error("[VIP edit] error loading rewards_user_overview row", oErr);
    // If overview fails, we can still render identity; keep sane defaults
  }

  const userRow = u as RewardsUsersRow;
  const overRow = (o ?? null) as RewardsUserOverviewRow | null;

  return {
    user_id: userRow.user_id,
    phone: userRow.phone ?? null,
    full_name: userRow.full_name ?? null,
    email: userRow.email ?? null,
    zip: userRow.zip ?? null,
    // If overview is missing for some reason, treat as VIP false but still allow editing
    is_vip: !!overRow?.is_vip,
    notify_artists: userRow.notify_artists ?? true,
    notify_specials: userRow.notify_specials ?? true,
    notify_vip_only: userRow.notify_vip_only ?? true,
    total_points: Number(overRow?.total_points ?? 0) || 0,
    last_scan_at: overRow?.last_scan_at ?? null,
  };
}

function VipSubnav({ userId }: { userId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/rewards/vips"
        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
      >
        ← Back to VIP users
      </Link>

      <Link
        href={`/rewards/vips/${userId}/insights`}
        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
      >
        Insights
      </Link>

      <span className="inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
        Edit profile
      </span>
    </div>
  );
}

export default async function VipEditPage(props: { params: Promise<{ userId: string }> }) {
  const session = await getDashboardSession();
  if (!session) redirect("/login");

  const { userId } = await props.params;
  if (!userId) notFound();

  const vip = await loadVip(userId);

  return (
    <DashboardShell
      activeTab="rewards"
      title="VIP user"
      subtitle={`Edit profile details and notification preferences. (Timezone: ${ET_TZ})`}
    >
      <div className="space-y-6">
        <VipSubnav userId={vip.user_id} />

        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">VIP identity</p>
              <p className="mt-1 truncate text-base font-semibold text-slate-900">{vip.full_name || "VIP Guest"}</p>
              <p className="mt-1 text-xs text-slate-600">
                {formatPhone(vip.phone)} <span className="text-slate-300">·</span>{" "}
                <span className="font-mono text-[11px] text-slate-500">{vip.user_id}</span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Points</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{vip.total_points}</p>
                <p className="text-[11px] text-slate-500">From rewards_user_overview</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Last check-in</p>
                <p className="mt-1 text-[11px] font-medium text-slate-900">{formatDateTimeEt(vip.last_scan_at)}</p>
                <p className="text-[11px] text-slate-500">ET display</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Status</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-900">{vip.is_vip ? "VIP active" : "Not VIP"}</p>
                <p className="text-[11px] text-slate-500">From overview</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h1 className="text-lg font-semibold text-slate-900">VIP profile</h1>
            <p className="mt-1 text-xs text-slate-600">Correct name, email, ZIP, and notification settings.</p>

            <form action={updateVipProfile} className="mt-5 space-y-4 text-xs">
              <input type="hidden" name="user_id" value={vip.user_id} />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Phone
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">
                    {formatPhone(vip.phone)}
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="full_name" className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
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
                  <label htmlFor="email" className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
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
                  <label htmlFor="zip" className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Notifications</p>

                <ToggleRow
                  id="notify_artists"
                  name="notify_artists"
                  label="Artist announcements"
                  helper="Lineups, live music nights, and artist updates."
                  defaultChecked={vip.notify_artists ?? true}
                />
                <ToggleRow
                  id="notify_specials"
                  name="notify_specials"
                  label="Specials & events"
                  helper="Food/drink specials, events and pop-ups."
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
                  href={`/rewards/vips/${vip.user_id}/insights`}
                  className="rounded-full border border-slate-300 px-4 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  View insights
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

          <aside className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Quick actions</p>

              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href={`/rewards/vips/${vip.user_id}/insights`}
                  className="rounded-full bg-amber-400 px-4 py-2 text-center text-[11px] font-semibold text-slate-900 hover:bg-amber-500"
                >
                  Open insights
                </Link>
                <Link
                  href="/rewards/vips"
                  className="rounded-full border border-slate-300 px-4 py-2 text-center text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Back to VIP list
                </Link>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-700">
                <p className="font-semibold text-slate-900">Data sources</p>
                <p className="mt-1 text-slate-600">
                  Identity + notification prefs come from <span className="font-mono">rewards_users</span>.
                  Points, VIP status, and last check-in come from <span className="font-mono">rewards_user_overview</span>.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-amber-100 bg-amber-50 px-6 py-4 text-xs text-amber-900">
              <p className="font-semibold">Reminder</p>
              <p className="mt-1">
                Editing this profile does <span className="font-semibold">not</span> add or remove points.
                Use the <span className="font-semibold">Set total points</span> controls on the VIP list for balance changes.
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
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-3">
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
