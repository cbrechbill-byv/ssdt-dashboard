// app/layout.tsx
// Path: C:\Users\cbrec\Desktop\SSDT_Fresh\ssdt-dashboard\app\layout.tsx
// Purpose: Global dashboard layout shell
// Notes:
// - Improves mobile usability without changing desktop UI
// - Enforces safe scrolling and viewport behavior
// - Prevents horizontal overflow from tables on small screens

import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Internal VIP & Fan Wall dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Mobile-safe viewport enforcement */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>

      <body
        className="
          h-full
          bg-slate-100
          text-slate-900
          antialiased
          overflow-x-hidden
        "
      >
        {/* 
          Wrapper ensures:
          - Vertical scrolling works on mobile
          - Horizontal overflow is contained
          - Desktop behavior is unchanged
        */}
        <div className="min-h-screen w-full overflow-x-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
