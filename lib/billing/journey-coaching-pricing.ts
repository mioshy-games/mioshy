// ============================================================
// lib/billing/journey-coaching-pricing.ts
//
// Stage-1 coaching add-on — the SINGLE source of truth for the journey
// purchase amount. Both the paywall data loader (display) and
// checkout/create (charge) resolve the amount through here, so the
// money guarantee "displayed == charged" holds by construction.
//
// Two-component model (per cadence, from subscription_prices):
//   content      = price_ils / price_usd           (existing)
//   coachingCost = coaching_cost_ils / _usd         (Stage-1, default 0)
//   amount       = content + (coaching ? coachingCost : 0)   ← pre-promo bundle
//
// The promo discount is applied to `amount` by the existing promo engine
// (lib/billing/promos.ts), filtered by the promo's coaching_scope. This
// module deliberately does NOT apply promos — it only resolves the
// pre-promo bundle so both surfaces start from the same number.
//
// Snapshot model (Itzik 2026-06-30): checkout persists this bundle as the
// checkout_sessions.amount; the indicator webhook stores it as
// subscriptions.plan_amount, so renewals charge the same bundle with no
// recompute. coachingCost default 0 keeps existing subscribers unchanged.
// ============================================================

import { getSubscriptionPrice, type Cadence } from "@/lib/billing/pricing-queries";
import { PLAN_AMOUNTS_ILS, PLAN_AMOUNTS_USD } from "@/lib/billing";

export interface JourneyResolvedAmount {
  /** Pre-promo bundle = content + (coaching ? coachingCost : 0). */
  amount: number;
  currency: "ILS" | "USD";
  coinId: 1 | 2;
  /** The content component alone (price_ils/usd). */
  contentAmount: number;
  /** The coaching component alone (0 when coaching=false or unpriced). */
  coachingCost: number;
}

/**
 * Resolve the journey purchase bundle for a (cadence, coaching, currency).
 *
 * Mirrors getPlanPrice()'s resilience posture:
 *   1. NEXT_PUBLIC_BILLING_TEST_PRICE overrides everything (coaching cost
 *      forced to 0 so test charges stay a single clean amount).
 *   2. Otherwise read subscription_prices; on a missing row / DB hiccup
 *      fall back to the hardcoded journey content price with 0 coaching.
 *
 * This is journey-only (coaching is a journey add-on); games keep using
 * getPlanPrice() directly.
 */
export async function resolveJourneyAmount(
  cadence: Cadence,
  isIsraeli: boolean,
  coaching: boolean,
): Promise<JourneyResolvedAmount> {
  const currency: "ILS" | "USD" = isIsraeli ? "ILS" : "USD";
  const coinId: 1 | 2 = isIsraeli ? 1 : 2;

  const testOverride = process.env.NEXT_PUBLIC_BILLING_TEST_PRICE;
  if (testOverride) {
    const amt = Number(testOverride);
    if (Number.isFinite(amt) && amt > 0) {
      return { amount: amt, currency, coinId, contentAmount: amt, coachingCost: 0 };
    }
  }

  const row = await getSubscriptionPrice("journey", cadence);
  const contentAmount = row
    ? isIsraeli
      ? row.price_ils
      : row.price_usd
    : isIsraeli
      ? PLAN_AMOUNTS_ILS.journey
      : PLAN_AMOUNTS_USD.journey;
  const coachingCost =
    row && coaching ? (isIsraeli ? row.coaching_cost_ils : row.coaching_cost_usd) : 0;

  return {
    amount: contentAmount + coachingCost,
    currency,
    coinId,
    contentAmount,
    coachingCost,
  };
}
