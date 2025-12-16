// app/help/page.tsx
// Path: /help
// Interactive dashboard help system (server wrapper)

import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/dashboardAuth";
import HelpClient from "./HelpClient";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const session = await getDashboardSession();

  if (!session) redirect("/login");

  return <HelpClient />;
}
