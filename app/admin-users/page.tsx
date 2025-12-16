// app/admin-users/page.tsx
// Path: /admin-users
// SSDT Dashboard — Admin Users (server-protected)

import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/dashboardAuth";
import AdminUsersClient from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getDashboardSession();

  if (!session) redirect("/login");
  if ((session.role ?? "admin") !== "admin") redirect("/dashboard");

  return <AdminUsersClient />;
}
