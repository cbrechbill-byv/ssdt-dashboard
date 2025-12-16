// app/reset-password/page.tsx
// Path: /reset-password
// Fix: Wrap client useSearchParams() usage in a Suspense boundary to satisfy Next.js prerender rules.

import React, { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordClient />
    </Suspense>
  );
}

function ResetPasswordLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white shadow-xl rounded-2xl p-10 max-w-md w-full text-center border border-slate-200">
        <p className="text-slate-700 text-sm font-medium">Loading…</p>
        <p className="text-slate-500 text-xs mt-2">
          Preparing your password reset form.
        </p>
      </div>
    </div>
  );
}
