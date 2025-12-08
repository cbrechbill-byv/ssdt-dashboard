// app/page.tsx
import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/dashboardAuth";

export default async function RootPage() {
  // Server-side check for dashboard session
  const session = await getDashboardSession();

  // If no session, force login
  if (!session) {
    redirect("/login");
  }

  // If logged in, send them to the main dashboard
  redirect("/dashboard");
}
