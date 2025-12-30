// components/ResponsiveTable.tsx
// Path: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\components\ResponsiveTable.tsx
// Purpose:
// - Mobile-safe table wrapper
// - Prevents layout breakage on small screens
// - No visual changes on desktop

import { ReactNode } from "react";

export default function ResponsiveTable({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="
        w-full
        overflow-x-auto
        overscroll-x-contain
        rounded-md
      "
    >
      {/* 
        min-w ensures columns don’t collapse on mobile
        adjust if needed per table
      */}
      <div className="min-w-[640px]">
        {children}
      </div>
    </div>
  );
}
