import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionPlan = "weekly" | "monthly" | "annual";
export type SubscriptionStatus = "active" | "cancelled" | "expired";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
};

export async function hasActiveSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;
  if (!data.current_period_end) return true;
  return new Date(data.current_period_end).getTime() > Date.now();
}

