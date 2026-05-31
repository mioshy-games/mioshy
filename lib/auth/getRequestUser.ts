/**
 * Request-scoped `auth.getUser()` cache.
 *
 * `supabase.auth.getUser()` is a network round-trip to Supabase Auth on
 * every invocation. Multiple shell-side helpers each instantiate their
 * own server client and call it independently:
 *
 *   • `app/[locale]/layout.tsx`     (marketing header bell)
 *   • `lib/shell/getShellData.ts`   (shell identity gate)
 *   • `lib/entitlements/getUserEntitlements.ts`
 *   • `lib/between-us/couples.ts`
 *   • `lib/shell/settings/getSettingsData.ts`
 *
 * The outer functions are React.cache-wrapped, but each one was paying
 * its own getUser. On a /my/today render that meant 4-5 Supabase Auth
 * round-trips before any page data could resolve.
 *
 * This wrapper:
 *   • Wraps `createServerSupabaseClient + auth.getUser` once per request.
 *   • Returns `{ user, supabase }` so callers can reuse the *same* client
 *     for their follow-up queries (saves the cookies()/createServerClient
 *     overhead too).
 *   • Stays request-scoped via React.cache — no cross-request leakage.
 *
 * Added 2026-05-31 (Q9 of the shell perf pass).
 */

import "server-only";

import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface RequestUserContext {
  user: User | null;
  supabase: SupabaseClient;
}

export const getRequestUser = cache(_getRequestUser);

async function _getRequestUser(): Promise<RequestUserContext> {
  const supabase = await createServerSupabaseClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { user, supabase };
  } catch {
    return { user: null, supabase };
  }
}
