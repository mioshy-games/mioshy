/**
 * lib/entitlements/adults-monthly.ts
 *
 * "Adults game-of-the-month" eligibility for Journey subscribers.
 *
 * Subscription rule (post-purchase spec §8.4): an active Journey
 * subscription bundles ONE Adults-pillar game unlock per calendar month.
 * The redemption stamp lives on `subscriptions.adults_monthly_used_at`
 * (added in migration 047). This file is the single source of truth for
 * "can the user pick a free Adults game right now?".
 *
 * Why a dedicated helper instead of inlining the check:
 *   - It's used by both the /my/adults page (display) and the redeem
 *     server action (write). Centralising the date math prevents the
 *     two from drifting (we'd been bitten by month-boundary bugs).
 *   - The "did the stamp roll over to a new month yet?" comparison is
 *     subtle. Tested once, here.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface AdultsMonthlyStatus {
  /** True when the subscription bundles a monthly slot AND that slot
   *  hasn't been used yet this calendar month. */
  available: boolean;
  /** Set when the slot is currently CONSUMED. ISO string. */
  used_at: string | null;
  /** First moment the slot becomes available again — always the 1st of
   *  the next month. UI shows "available on Jun 1" using this. */
  next_available_at: string | null;
  /** True when the user has the Journey subscription that bundles the
   *  slot. Used by the page to decide whether to surface this section
   *  at all (a games-only subscriber doesn't get the monthly free). */
  has_bundle_subscription: boolean;
}

/** First moment of the current calendar month, in UTC. */
function startOfCurrentMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
}

/** First moment of the NEXT calendar month — when a consumed slot
 *  flips back to available. */
function startOfNextMonthUtc(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0),
  );
}

/**
 * Reads the active Journey subscription for the user and computes the
 * monthly-bundle availability. Returns sentinel `{ has_bundle_subscription:
 * false }` shape when no Journey subscription exists; callers should
 * branch on that flag before showing any "free this month" UI.
 */
export async function getAdultsMonthlyStatus(
  userId: string,
): Promise<AdultsMonthlyStatus> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      available: false,
      used_at: null,
      next_available_at: null,
      has_bundle_subscription: false,
    };
  }

  // The bundle attaches to the Journey product specifically. A user
  // could in theory hold both a Journey AND a Games subscription; only
  // Journey grants the Adults slot.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, status, product, adults_monthly_used_at")
    .eq("user_id", userId)
    .eq("product", "journey")
    .eq("status", "active")
    .maybeSingle();

  if (!sub) {
    return {
      available: false,
      used_at: null,
      next_available_at: null,
      has_bundle_subscription: false,
    };
  }

  const usedAt = sub.adults_monthly_used_at as string | null;
  const monthStart = startOfCurrentMonthUtc();

  // Slot is available if either (a) it's never been used or (b) the
  // last use happened in a previous calendar month.
  const available = !usedAt || new Date(usedAt) < monthStart;

  return {
    available,
    used_at: usedAt,
    next_available_at: available
      ? null
      : startOfNextMonthUtc().toISOString(),
    has_bundle_subscription: true,
  };
}

/**
 * Marks the user's monthly slot as consumed. Callers MUST verify the
 * slot is currently available before invoking this — the function
 * intentionally does not re-check, so a misuse (double-consume in the
 * same month) is loud.
 *
 * Returns true on success, false if the subscription couldn't be found
 * or the update failed.
 */
export async function consumeAdultsMonthlySlot(
  userId: string,
): Promise<boolean> {
  const admin = createServiceRoleClient();
  if (!admin) return false;

  const { error } = await admin
    .from("subscriptions")
    .update({ adults_monthly_used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("product", "journey")
    .eq("status", "active");

  if (error) {
    console.error("[adults-monthly] consume failed", error);
    return false;
  }
  return true;
}
