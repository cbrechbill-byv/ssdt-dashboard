// app/rewards/staff-codes/page.tsx
// Path: /rewards/staff-codes
// Manage staff PIN codes used for in-app reward redemptions.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import DashboardShell from "@/components/layout/DashboardShell";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDashboardSession } from "@/lib/dashboardAuth";

type StaffCode = {
  id: string;
  label: string;
  pin_hash: string; // currently storing plain 4-digit PIN
  created_at: string | null;
};

async function requireDashboardSession() {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  return session;
}

async function fetchStaffCodes(): Promise<StaffCode[]> {
  const { data, error } = await supabaseServer
    .from("rewards_staff_codes")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[staff-codes] fetchStaffCodes error", error);
    return [];
  }

  return (data ?? []) as StaffCode[];
}

async function logStaffCodeAction(options: {
  action: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  const session = await getDashboardSession();
  const supabase = supabaseServer;

  const actor_email = session?.email ?? "unknown";
  const actor_role = session?.role ?? "unknown";

  const { error } = await supabase.from("dashboard_audit_log").insert({
    actor_email,
    actor_role,
    action: options.action,
    entity: "rewards_staff_codes",
    entity_id: options.entityId ?? null,
    details: options.details ?? null,
  });

  if (error) {
    console.error("[staff-codes] log action error", error);
  }
}

// --- Server actions ----------------------------------------------------------

export async function createStaffCode(formData: FormData) {
  "use server";

  await requireDashboardSession();

  const label = (formData.get("label") as string)?.trim();
  const pin = (formData.get("pin") as string)?.trim();

  if (!label || !pin) {
    console.error("[staff-codes] label or pin missing");
    return;
  }

  // For now we store the raw 4-digit PIN in pin_hash to match the mobile app.
  // (Later we can migrate to hashing + RPC verify function.)
  const { data, error } = await supabaseServer
    .from("rewards_staff_codes")
    .insert({
      label,
      pin_hash: pin,
    })
    .select()
    .single();

  if (error) {
    console.error("[staff-codes] create error", error);
  } else if (data) {
    await logStaffCodeAction({
      action: "staff_code:create",
      entityId: data.id,
      details: { label: data.label },
    });
  }

  revalidatePath("/rewards/staff-codes");
}

export async function upsertOrDeleteStaffCode(formData: FormData) {
  "use server";

  await requireDashboardSession();

  const id = formData.get("id") as string;
  const intent = (formData.get("intent") as string | null) ?? "save";

  if (!id) {
    console.error("[staff-codes] Missing id in upsertOrDeleteStaffCode");
    return;
  }

  if (intent === "delete") {
    const { error } = await supabaseServer
      .from("rewards_staff_codes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[staff-codes] delete error", error);
    } else {
      await logStaffCodeAction({
        action: "staff_code:delete",
        entityId: id,
      });
    }

    revalidatePath("/rewards/staff-codes");
    return;
  }

  // Save / update
  const label = (formData.get("label") as string)?.trim();
  const pin = (formData.get("pin") as string)?.trim();

  const { error } = await supabaseServer
    .from("rewards_staff_codes")
    .update({
      label,
      pin_hash: pin,
    })
    .eq("id", id);

  if (error) {
    console.error("[staff-codes] update error", error);
  } else {
    await logStaffCodeAction({
      action: "staff_code:update",
      entityId: id,
      details: { label },
    });
  }

  revalidatePath("/rewards/staff-codes");
}

// --- Page --------------------------------------------------------------------

export default async function StaffCodesPage() {
  await requireDashboardSession();
  const codes = await fetchStaffCodes();

  return (
    <DashboardShell
      activeTab="rewards"
      title="Sugarshack Downtown VIP Dashboard"
      subtitle="Staff codes · PINs used to approve reward redemptions."
    >
      <div className="space-y-8">
        {/* Add new staff code */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <h1 className="text-base font-semibold text-slate-900">
            Add new staff code
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create a simple label and 4-digit PIN that staff can use to approve
            in-app reward redemptions.
          </p>

          <form
            action={createStaffCode}
            className="mt-4 grid gap-3 text-sm md:grid-cols-[minmax(0,2.5fr)_minmax(0,1.2fr)_auto] md:items-end"
          >
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Label
              </label>
              <input
                type="text"
                name="label"
                required
                placeholder="Jess – Bar, Inside"
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-300"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                PIN (4 digits)
              </label>
              <input
                type="password"
                name="pin"
                required
                maxLength={4}
                pattern="\d{4}"
                placeholder="1234"
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-300"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex items-center rounded-full bg-amber-400 px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-500"
              >
                Add staff code
              </button>
            </div>
          </form>
        </section>

        {/* Existing staff codes */}
        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Existing staff codes
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Update labels or rotate PINs as needed. Changes apply
                immediately in the app.
              </p>
            </div>
            {codes.length > 0 && (
              <p className="text-xs text-slate-500">
                {codes.length} code{codes.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {codes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No staff codes yet. Add your first PIN above.
            </p>
          ) : (
            <>
              {/* Header row */}
              <div className="mt-5 grid gap-3 border-b border-slate-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.4fr)]">
                <span>Label</span>
                <span>PIN</span>
                <span>Created</span>
                <span className="text-right">Actions</span>
              </div>

              {/* Rows */}
              <div className="mt-1 space-y-3">
                {codes.map((code) => (
                  <form
                    key={code.id}
                    action={upsertOrDeleteStaffCode}
                    className="grid gap-3 rounded-3xl bg-slate-50 px-4 py-3 text-sm shadow-sm md:grid-cols-[minmax(0,2.5fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] md:items-center"
                  >
                    <input type="hidden" name="id" value={code.id} />

                    <div>
                      <input
                        type="text"
                        name="label"
                        defaultValue={code.label}
                        className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                      />
                    </div>

                    <div>
                      <input
                        type="password"
                        name="pin"
                        defaultValue={code.pin_hash}
                        maxLength={4}
                        pattern="\d{4}"
                        className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                      />
                    </div>

                    <div className="text-xs text-slate-500">
                      {code.created_at
                        ? new Date(code.created_at).toLocaleString()
                        : "—"}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="submit"
                        name="intent"
                        value="save"
                        className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600"
                      >
                        Save
                      </button>
                      <button
                        type="submit"
                        name="intent"
                        value="delete"
                        className="rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
