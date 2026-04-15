import { createClient } from "@supabase/supabase-js";

/** Service role — use only in trusted server contexts (never expose to client). */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Admin client — same as service role, throws if env vars are missing.
 * Used by billing API routes that must never fail silently.
 */
export async function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role credentials");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
