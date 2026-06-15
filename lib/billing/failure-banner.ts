// ============================================================
// lib/billing/failure-banner.ts
//
// Display-only helper for the global subscription billing banner.
// DELIBERATELY SEPARATE from getUserEntitlements — it must NEVER feed
// back into access decisions. Access stays exactly as today: past_due
// and blocked already cut access in getUserEntitlements (they're not in
// its active/grace query). This helper only answers "should we show the
// 'payment failed' bar, and which variant?".
//
// It scans ALL of the user's own subscription rows (not limit(1)), so a
// past_due/blocked on any pillar surfaces the banner — which also closes
// the /account latest-sub-only gap (bug #4). Reads only the caller's own
// rows (RLS subscriptions_select_own), so a partner never sees the
// owner's "update your card" prompt.
// ============================================================
import { cache } from "react";
import { getRequestUser } from "@/lib/auth/getRequestUser";

export type BillingBannerState = "past_due" | "blocked";

/**
 * Returns the most-severe billing-failure state across the signed-in
 * user's own subscriptions, or null when there's nothing to show
 * (not signed in, no failing subs, or a query error — fail silent).
 * blocked outranks past_due (fully cut + renewals have stopped retrying).
 */
export const getBillingBannerState = cache(
  async function getBillingBannerStateImpl(): Promise<BillingBannerState | null> {
    const { user, supabase } = await getRequestUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .in("status", ["past_due", "blocked"]);

    if (error || !data || data.length === 0) return null;
    if (data.some((r) => r.status === "blocked")) return "blocked";
    return "past_due";
  },
);
