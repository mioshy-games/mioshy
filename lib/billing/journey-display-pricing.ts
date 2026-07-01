// ============================================================
// lib/billing/journey-display-pricing.ts
//
// Read-only helper that assembles the figures the homepage Stage-3
// price block (components/marketing/v2/JourneyStages.tsx) renders, from
// the SAME sources the /journey/assessment results page and the checkout
// use — so what we show equals what Cardcom charges (money guarantee).
// Server-only.
//
// Monthly framing (decided with Itzik 2026-06-30, rev 2):
//   • current price = the monthly price AFTER the active promo's first
//     charge — findActivePromo('journey', cadence:'monthly') + applyDiscount
//     on subscription_prices(journey, monthly).price_ils. Shown as
//     "לחודש הראשון".
//   • original (strikethrough) = the regular monthly price (applyDiscount's
//     originalAmount).
//   • no active promo ⇒ firstChargeIls === monthlyIls and hasPromo=false →
//     the block shows the regular monthly price only, no strikethrough.
//
// The promo lookup matches checkout exactly: same findActivePromo + cadence
// ('monthly', the journey default) + applyDiscount. Every field is null-safe:
// a missing base price or a promo lookup/compute failure leaves monthlyIls
// null (or no discount), and the consumer falls back to the CMS literal /
// regular price — a DB hiccup never breaks the page.
// ============================================================
import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getSubscriptionPrice } from "@/lib/billing/pricing-queries";
import { findActivePromo, applyDiscount } from "@/lib/billing/promos";

export interface JourneyDisplayPricing {
  /** Regular monthly price (strikethrough when a promo is active). null ⇒ CMS fallback. */
  monthlyIls: number | null;
  /** Monthly price for the first charge — discounted under an active promo, else === monthlyIls. */
  firstChargeIls: number | null;
  /** True when an active promo actually discounts the monthly first charge. */
  hasPromo: boolean;
}

const EMPTY: JourneyDisplayPricing = {
  monthlyIls: null,
  firstChargeIls: null,
  hasPromo: false,
};

export const getJourneyDisplayPricing = cache(
  async function getJourneyDisplayPricingImpl(): Promise<JourneyDisplayPricing> {
    const monthly = await getSubscriptionPrice("journey", "monthly");
    const monthlyIls = monthly ? monthly.price_ils : null;
    if (monthlyIls == null) return EMPTY;

    // Promo lookup mirrors checkout (app/api/billing/checkout/create): same
    // findActivePromo for the monthly cadence + applyDiscount on the ILS price.
    // Service-role client because subscription_promos is RLS-locked to it. Any
    // failure ⇒ regular price, no promo (never break the homepage).
    let firstChargeIls = monthlyIls;
    let hasPromo = false;
    try {
      const admin = createServiceRoleClient();
      if (admin) {
        const { promo } = await findActivePromo(admin, {
          product: "journey",
          cadence: "monthly",
          // Stage-3 is the logged-out ENTRY price = the WITHOUT-coaching option
          // (base here is the content-only price_ils, no coaching_cost). Pass
          // coaching:false so a coaching-scoped 'with' promo — meant for the
          // higher content+coaching bundle — is never applied to this
          // content-only base. Without this filter, selectActivePromo would pick
          // whichever scoped promo was created latest; a 'with' ₪100-off on a ₪67
          // base clamps to MIN_CHARGE (→ "1 ₪"). 'without'/'all' promos still
          // apply, matching what a without-coaching checkout actually charges.
          coaching: false,
        });
        if (promo) {
          const res = applyDiscount({
            amount: monthlyIls,
            currency: "ILS",
            promo,
          });
          if (res.promoId) {
            firstChargeIls = res.discountedAmount;
            hasPromo = res.discountedAmount < res.originalAmount;
          }
        }
      }
    } catch {
      firstChargeIls = monthlyIls;
      hasPromo = false;
    }

    return { monthlyIls, firstChargeIls, hasPromo };
  },
);
