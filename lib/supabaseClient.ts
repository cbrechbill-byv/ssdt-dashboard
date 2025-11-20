"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// This client is used in client components (like the login page)
export function createBrowserSupabaseClient() {
  return createClientComponentClient();
}