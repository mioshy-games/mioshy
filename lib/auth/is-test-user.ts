import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when the user's profile is flagged `is_test_user` (re-engagement spec
 * §A). Used to exclude test accounts from marketing-sequence sends and from
 * Brevo contact sync — now and for any account flagged in the future.
 *
 * Fails OPEN (returns false) on a missing row or any error, so a transient DB
 * issue never blocks a real user's send/sync. The flag is a belt-and-suspenders
 * exclusion; the authoritative test-account list lives in `profiles.is_test_user`.
 *
 * Pass the service-role client (profiles is RLS-locked). A null/undefined
 * userId (e.g. a signed-out lead) is treated as non-test.
 */
export async function isTestUser(
  admin: SupabaseClient,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await admin
    .from("profiles")
    .select("is_test_user")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return (data as { is_test_user?: boolean | null }).is_test_user === true;
}
