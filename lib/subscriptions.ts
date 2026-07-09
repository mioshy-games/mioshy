import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionPlan = "weekly" | "monthly" | "annual";
export type SubscriptionStatus =
  | "active"
  | "trialing"
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
 * Returns true when the user has an access-granting subscription that has not
 * yet reached its deadline. Frozen, cancelled, expired, past_due, and blocked
 * subscriptions all gate access - business rule 5 from product.
 *
 * A3 (task 26, bug ג — Itzik 2026-07-03): 'trialing' grants FULL access for the
 * whole 7-day window, exactly like 'active'. The trial deadline lives in
 * trial_ends_at (current_period_end mirrors it), so a live trial passes here.
 * The renewals cron flips trialing → active (keep access) or → past_due (drop)
 * when the trial ends. Without this, games (the only product gated on this
 * helper rather than getUserEntitlements) stayed locked for trial members.
 *
 * `product` (optional): when given, scopes the check to that pillar
 * (games/journey/adults) — subscriptions carry a `product` column (migration
 * 032). Omitted → any active subscription counts (the original behavior; the
 * games UIs rely on it). The journey marketing sequence passes "journey" so a
 * games/adults-only buyer is NOT treated as a journey subscriber.
 *
 * past_due within grace window is handled by a separate flag on the account
 * page; the renewal cron will transition to "blocked" once grace expires.
 */
export async function hasActiveSubscription(
  supabase: SupabaseClient,
  userId: string,
  product?: "games" | "journey" | "adults",
): Promise<boolean> {
  let query = supabase
    .from("subscriptions")
    .select("status, current_period_end, grace_until, trial_ends_at")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"]);
  if (product) query = query.eq("product", product);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;
  if (data.status === "trialing") {
    if (!data.trial_ends_at) return true;
    return new Date(data.trial_ends_at as string).getTime() > Date.now();
  }
  if (!data.current_period_end) return true;
  return new Date(data.current_period_end).getTime() > Date.now();
}
