"use client";

type Action = "create" | "update" | "delete";

export async function logDashboardEvent(params: {
  action: Action;
  entity: string;
  entityId?: string;
  details?: any;
}) {
  try {
    await fetch("/api/dashboard/audit-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (error) {
    console.error("[logDashboardEvent] failed:", error);
  }
}
