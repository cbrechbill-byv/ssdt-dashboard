"use client";

import React, { useMemo } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import HelpNav from "@/components/help/HelpNav";
import HelpSection from "@/components/help/HelpSection";
import { useDashboardUser } from "@/lib/useDashboardUser";

import { HELP_SECTIONS } from "./helpContent";

export type HelpRole = "staff" | "admin";

export type HelpItem = {
  id: string;
  title: string;
  roles?: HelpRole[];
  keywords?: string[];
  content: React.ReactNode;
};

export default function HelpClient() {
  const { role } = useDashboardUser();

  const visibleSections = useMemo(() => {
    const currentRole = (role === "admin" ? "admin" : "staff") as HelpRole;
    return HELP_SECTIONS.filter(
      (s) => !s.roles || s.roles.includes(currentRole)
    );
  }, [role]);

  return (
    <DashboardShell
      title="Help & Documentation"
      subtitle="How to use the Sugarshack Downtown Dashboard"
      activeTab="help"
    >
      <div className="flex gap-6">
        <HelpNav sections={visibleSections} />

        <div className="flex-1 space-y-10">
          {visibleSections.map((section) => (
            <HelpSection key={section.id} section={section} />
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
