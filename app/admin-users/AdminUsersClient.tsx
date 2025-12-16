// app/admin-users/AdminUsersClient.tsx
// Path: /admin-users (client UI)

"use client";

import React, { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";

type AdminUser = {
  id: string;
  email: string;
  role: string | null;
  created_at: string | null;
};

type FormState = {
  id?: string;
  email: string;
  role: string;
};

const EMPTY_FORM: FormState = { email: "", role: "admin" };

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDateEST(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminUsersClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin-users", { method: "GET" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to load admin users.");
      setUsers((data?.users ?? []) as AdminUser[]);
    } catch (e: any) {
      setError(e.message || "Failed to load admin users.");
    } finally {
      setLoading(false);
    }
  }

  const totalAdmins = useMemo(
    () => users.filter((u) => (u.role ?? "admin") === "admin").length,
    [users]
  );

  function openCreate() {
    setIsEditing(false);
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(u: AdminUser) {
    setIsEditing(true);
    setForm({ id: u.id, email: u.email, role: u.role ?? "admin" });
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSaving(false);
    setError(null);
    setForm(EMPTY_FORM);
    setIsEditing(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const email = form.email.trim().toLowerCase();
      if (!email) throw new Error("Email is required.");

      const payload = { email, role: (form.role || "admin").trim() };

      const res = await fetch("/api/admin-users", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.id ? { id: form.id, ...payload } : payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to save user.");

      await loadUsers();
      closeModal();
    } catch (e: any) {
      setError(e.message || "Failed to save user.");
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this dashboard user? They will no longer be able to sign in.")) return;

    setDeleting(id);
    setError(null);

    try {
      const res = await fetch("/api/admin-users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to delete user.");

      await loadUsers();
    } catch (e: any) {
      setError(e.message || "Failed to delete user.");
    } finally {
      setDeleting(null);
    }
  }

  async function sendReset(email: string) {
    setSending(email);
    setError(null);

    try {
      const res = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to send reset email.");

      alert("Password reset email sent.");
    } catch (e: any) {
      setError(e.message || "Failed to send reset email.");
    } finally {
      setSending(null);
    }
  }

  return (
    <DashboardShell
      title="Admin Users"
      subtitle="Manage who can access the SSDT dashboard."
      activeTab="admin-users"
    >
      <div className="space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Dashboard access
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Add staff who should access the dashboard.
              </p>
            </div>
            <div className="flex flex-col items-start text-[11px] text-slate-500 sm:items-end">
              <span>{users.length} total users</span>
              <span>{totalAdmins} admins</span>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Users
              </p>
              <p className="mt-1 text-xs text-slate-500">
                These users can sign in at /login.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/40 hover:bg-sky-400"
            >
              + Add user
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-500">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-900">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 text-left">Email</th>
                    <th className="py-2 pr-4 text-left">Role</th>
                    <th className="py-2 pr-4 text-left">Created</th>
                    <th className="py-2 pr-0 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2 pr-4 text-xs text-slate-900">{u.email}</td>
                      <td className="py-2 pr-4 text-xs text-slate-700">{u.role ?? "admin"}</td>
                      <td className="py-2 pr-4 text-xs text-slate-700">{formatDateEST(u.created_at)}</td>
                      <td className="py-2 pr-0 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => void sendReset(u.email)}
                            disabled={sending === u.email}
                            className={cn(
                              "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100",
                              sending === u.email && "opacity-60"
                            )}
                          >
                            {sending === u.email ? "Sending…" : "Reset password"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDelete(u.id)}
                            disabled={deleting === u.id}
                            className={cn(
                              "rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100",
                              deleting === u.id && "opacity-60"
                            )}
                          >
                            {deleting === u.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {isEditing ? "Edit user" : "Add user"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                    placeholder="staff@yourvenue.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
                  >
                    <option value="admin">admin</option>
                    <option value="staff">staff</option>
                  </select>
                </div>

                <div className="mt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-sky-500/40 hover:bg-sky-400 disabled:opacity-60"
                  >
                    {saving ? "Saving…" : isEditing ? "Save changes" : "Create user"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
