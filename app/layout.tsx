import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: " Dashboard",
  description: "Internal VIP & Fan Wall dashboard for ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

