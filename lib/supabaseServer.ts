// lib/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";

// IMPORTANT:
// This uses the SERVICE ROLE KEY — only safe on the server (API routes, never in the client)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});
