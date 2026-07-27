import { createClient } from "@supabase/supabase-js";

/**
 * ⚠️ Next.js Data Cache — why every client here sets `cache: "no-store"`.
 *
 * supabase-js talks over plain `fetch`, and Next patches global fetch. In
 * patch-fetch the decision is:
 *
 *   autoNoCache = (authorization/cookie header || non-GET/HEAD method)
 *                 && staticGenerationStore.revalidate === 0
 *
 * supabase-js always sends `Authorization`, so the first half is always true —
 * but `revalidate === 0` is only set when the route exports a NON-static method
 * (POST/PUT/…) or when something called `cookies()`/`headers()`/`noStore()`
 * first. `export const dynamic = "force-dynamic"` does NOT set it (it only sets
 * forceDynamic). So inside a GET-only route handler that never touches cookies,
 * a service-role read is stored with `revalidate: false` — cached FOREVER, and
 * the Vercel Data Cache SURVIVES DEPLOYMENTS.
 *
 * That really happened (2026-07-14 → 2026-07-27): the poll's live counter
 * replayed a 13-day-old response, reporting 1 vote against a table holding 19.
 * Local dev never reproduces it — its Data Cache starts empty.
 *
 * The Cardcom callback (/api/billing/cardcom/indicator) is GET-only and reads
 * its idempotency guard through this client, so a cached "not processed yet"
 * could let a retried payment be processed twice. A service-role read is always
 * "what is true right now" — none of it may ever be cached. Keep the no-store
 * fetch on every client in this file.
 */
function noStoreFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: "no-store" });
}

const ADMIN_OPTS = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: noStoreFetch },
};

/** Service role - use only in trusted server contexts (never expose to client). */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, ADMIN_OPTS);
}

/**
 * Admin client - same as service role, throws if env vars are missing.
 * Used by billing API routes that must never fail silently.
 */
export async function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role credentials");
  return createClient(url, key, ADMIN_OPTS);
}
