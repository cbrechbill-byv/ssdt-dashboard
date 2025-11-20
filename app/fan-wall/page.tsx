import React from "react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { FanWallModeration } from "../../components/fanwall/FanWallModeration";

const FanWallPage = () => {
  return (
    <DashboardShell
      title="Sugarshack Downtown Fan Wall"
    >
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
        <FanWallModeration />
      </div>
    </DashboardShell>
  );
};

export default FanWallPage;

