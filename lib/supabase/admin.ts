import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client - ONLY use in server-side code (Server Actions,
 * Route Handlers, Server Components).  Never expose to the browser.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in env (not the anon key).
 */
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    // Never let Next's Data Cache serve a service-role read — it caches
    // GET/HEAD forever inside GET-only route handlers and survives deployments.
    // Full explanation in lib/supabase-admin.ts.
    global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
