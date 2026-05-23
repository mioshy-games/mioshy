/**
 * lib/entitlements/adults-monthly.ts
 *
 * @deprecated 2026-05-22 — the "one adults game per month" model was
 * replaced by full adults access for any active Journey subscriber.
 * See getUserEntitlements.ts where `journey === active → adults = true`.
 *
 * The exported helpers are kept as thin no-op shims so legacy call sites
 * compile while the UI is migrated. They will be removed once the last
 * import disappears.
 *
 * The `subscriptions.adults_monthly_used_at` column still exists in the
 * database (migration 047) but is no longer read or written. We leave it
 * in place to preserve historical data; a future migration can drop it.
 *
 * --- Historical contract (pre-2026-05-22) ---
 *
 * "Adults game-of-the-month" eligibility for Journey subscribers.
 * Subscription rule (post-purchase spec §8.4): an active Journey
 * subscription bundles ONE Adults-pillar game unlock per calendar month.
 */

export interface AdultsMonthlyStatus {
  /** Always false post-2026-05-22 — the monthly-slot UI is dead. */
  available: boolean;
  /** Always null post-2026-05-22. */
  used_at: string | null;
  /** Always null post-2026-05-22. */
  next_available_at: string | null;
  /** Always false post-2026-05-22 — bundle is no longer a slot. */
  has_bundle_subscription: boolean;
}

/**
 * @deprecated Always returns "no bundle subscription" since 2026-05-22.
 * Journey subscribers now have unrestricted adults access; check
 * `getUserEntitlements().adults` instead.
 *
 * Retained only so legacy import sites compile until they're refactored
 * to read `getUserEntitlements().adults`.
 */
export async function getAdultsMonthlyStatus(
  _userId: string,
): Promise<AdultsMonthlyStatus> {
  return {
    available: false,
    used_at: null,
    next_available_at: null,
    has_bundle_subscription: false,
  };
}

/**
 * @deprecated No-op since 2026-05-22. The monthly slot is gone.
 * Kept only so the legacy server action `adults-redeem-monthly` still
 * compiles while we migrate the UI off it.
 */
export async function consumeAdultsMonthlySlot(
  _userId: string,
): Promise<boolean> {
  return false;
}
