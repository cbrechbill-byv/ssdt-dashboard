// app/rewards/staff-codes/page.tsx
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

import { supabaseServer } from "@/lib/supabaseServer";
import DashboardShell from "@/components/layout/DashboardShell";
import { getDashboardSession } from "@/lib/dashboardAuth";

type StaffCode = {
  id: string;
  label: string;
  created_at: string;
};

async function requireDashboardSession() {
  const session = await getDashboardSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

async function fetchStaffCodes(): Promise<StaffCode[]> {
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("rewards_staff_codes")
    .select("id, label, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[staff-codes] fetchStaffCodes error", error);
    return [];
  }

  return (data ?? []) as StaffCode[];
}

async function logStaffCodeAction(options: {
  action: "create" | "delete";
  entityId?: string | null;
  details?: Record<string, unknown>;
}) {
  const session = await getDashboardSession();
  const supabase = supabaseServer;

  const actor_email = session?.user?.email ?? "unknown";
  const actor_role = session?.user?.role ?? "unknown";

  const { error } = await supabase.from("dashboard_audit_log").insert({
    actor_email,
    actor_role,
    action: options.action,
    entity: "rewards_staff_code",
    entity_id: options.entityId ?? null,
    details: options.details ?? null,
  });

  if (error) {
    console.error("[staff-codes] logStaffCodeAction error", error);
  }
}

export default async function StaffCodesPage() {
  await requireDashboardSession();
  const codes = await fetchStaffCodes();

  return (
    <DashboardShell activeTab="rewards">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Rewards Staff Codes
          </h1>
          <p className="text-sm text-gray-500">
            Create PIN codes for staff devices that can approve redemptions.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <StaffCodesTable codes={codes} />
          <NewStaffCodeForm />
        </div>
      </div>
    </DashboardShell>
  );
}

// SERVER ACTIONS

export async function createStaffCode(formData: FormData) {
  "use server";

  await requireDashboardSession();
  const supabase = supabaseServer;

  const label = String(formData.get("label") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!label || !pin) return;

  // Hash the PIN with bcrypt
  const pin_hash = await bcrypt.hash(pin, 10);

  const { data, error } = await supabase
    .from("rewards_staff_codes")
    .insert({ label, pin_hash })
    .select("id")
    .single();

  if (error) {
    console.error("[staff-codes] createStaffCode error", error);
  } else {
    await logStaffCodeAction({
      action: "create",
      entityId: data?.id ?? null,
      details: { label },
    });
  }

  revalidatePath("/rewards/staff-codes");
}

export async function deleteStaffCode(formData: FormData) {
  "use server";

  await requireDashboardSession();
  const supabase = supabaseServer;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const { error } = await supabase
    .from("rewards_staff_codes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[staff-codes] deleteStaffCode error", error);
  } else {
    await logStaffCodeAction({
      action: "delete",
      entityId: id,
    });
  }

  revalidatePath("/rewards/staff-codes");
}

// PRESENTATION

function StaffCodesTable({ codes }: { codes: StaffCode[] }) {
  if (!codes.length) {
    return (
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">
          No staff codes yet. Use the form on the right to create a code for
          each server, bartender, or POS tablet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-medium">Existing staff codes</h2>
      </div>
      <div className="max-h-[480px] overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Label</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {codes.map((code) => (
              <tr key={code.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <div className="font-medium">{code.label}</div>
                </td>
                <td className="px-4 py-2">
                  <span className="text-xs text-gray-500">
                    {new Date(code.created_at).toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end">
                    <form action={deleteStaffCode}>
                      <input type="hidden" name="id" value={code.id} />
                      <button
                        type="submit"
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewStaffCodeForm() {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-medium">Add staff code</h2>
      <form action={createStaffCode} className="space-y-3 text-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Label
          </label>
          <input
            name="label"
            className="w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Bar 1 iPad"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            PIN
          </label>
          <input
            name="pin"
            type="password"
            className="w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="4–6 digit code"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            PINs are hashed before storing. You&apos;ll need to share the plain
            PIN with your staff.
          </p>
        </div>
        <button
          type="submit"
          className="mt-2 w-full rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Create staff code
        </button>
      </form>
    </div>
  );
}
