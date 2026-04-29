import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionPlan = "weekly" | "monthly" | "annual";
export type SubscriptionStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "past_due"
  | "blocked"
  | "frozen";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
};

/**
 * Returns true only when the user has an "active" subscription that has not
 * yet reached current_period_end. Frozen, cancelled, expired, past_due, and
 * blocked subscriptions all gate access — business rule 5 from product.
 *
 * past_due within grace window is handled by a separate flag on the account
 * page; the renewal cron will transition to "blocked" once grace expires.
 */
export async function hasActiveSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, grace_until")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;
  if (!data.current_period_end) return true;
  return new Date(data.current_period_end).getTime() > Date.now();
}
