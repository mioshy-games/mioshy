import "server-only";

/**
 * Server-side pricing for the journey subscribe surface(s).
 *
 * Extracted verbatim from the journey/assessment page's pricing computation so
 * the NEW /journey/subscribe page shows EXACTLY what the assessment paywall
 * shows — and therefore exactly what Cardcom charges. It resolves prices via the
 * same primitives the checkout uses:
 *   • cadences   ← listAllPrices()   (subscription_prices table; never hardcoded)
 *   • promo/first-charge ← findActivePromo + applyDiscount (lib/billing/promos)
 * Any lookup/compute failure leaves the promo null (regular price) and never
 * throws — a broken promo must not break the page.
 *
 * MONEY invariant: display == charge. Do not add discount math here that the
 * checkout doesn't also apply. Keep this in lockstep with the assessment page's
 * inline block (app/[locale]/journey/assessment/page.tsx) and the checkout
 * resolver (lib/billing/journey-coaching-pricing.ts).
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getPromoMode, getUserOfferExpiresAt, promoDiscountEligible } from "@/lib/billing/promo-mode";
import { listAllPrices } from "@/lib/billing/pricing-queries";
import type { CadenceOption } from "@/lib/billing/pricing-validations";
import {
  findActivePromo,
  applyDiscount,
  promoAppliesToCadence,
  type SubscriptionPromo,
} from "@/lib/billing/promos";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import type { JourneyPromoSummary } from "@/components/journey/AnalysisSummary";

export interface JourneySubscribePricing {
  journeyCadences: CadenceOption[];
  activePromo: JourneyPromoSummary | null;
  offerExpiresAt: string | null;
  promoMode: "off" | "personal_window" | "campaign_timer";
  journeySubscribed: boolean;
}

export async function getJourneySubscribePricing(
  userId: string | null,
): Promise<JourneySubscribePricing> {
  // Enabled/disabled cadences from the DB (never hardcoded).
  const journeyCadences: CadenceOption[] = (await listAllPrices())
    .filter((p) => p.product === "journey")
    .map(
      ({
        cadence,
        price_ils,
        price_usd,
        coaching_cost_ils,
        coaching_cost_usd,
        enabled,
        is_default,
      }) => ({
        cadence,
        price_ils,
        price_usd,
        coaching_cost_ils,
        coaching_cost_usd,
        enabled,
        is_default,
      }),
    );

  let offerExpiresAt: string | null = null;
  let promoMode: "off" | "personal_window" | "campaign_timer" = "personal_window";
  let activePromo: JourneyPromoSummary | null = null;
  try {
    const promoClient = createServiceRoleClient();
    if (promoClient) {
      promoMode = await getPromoMode(promoClient);
      if (promoMode === "personal_window" && userId) {
        offerExpiresAt = await getUserOfferExpiresAt(promoClient, userId);
      }
      const discountEligible = promoDiscountEligible(promoMode, offerExpiresAt);
      if (discountEligible) {
        const ignoreEndsAt = promoMode === "personal_window";
        const [withRes, withoutRes] = await Promise.all([
          findActivePromo(promoClient, { product: "journey", coaching: true, ignoreEndsAt }),
          findActivePromo(promoClient, { product: "journey", coaching: false, ignoreEndsAt }),
        ]);
        if (withRes.warning) console.warn("[journey-subscribe] promo warning (with)", withRes.warning);
        if (withoutRes.warning) console.warn("[journey-subscribe] promo warning (without)", withoutRes.warning);

        const buildScope = (
          promo: SubscriptionPromo | null,
          withCoaching: boolean,
        ): JourneyPromoSummary["withCoaching"] => {
          if (!promo) return null;
          const firstChargeByCadence: Record<string, { ils: number; usd: number }> = {};
          const originalByCadence: Record<string, { ils: number; usd: number }> = {};
          for (const c of journeyCadences) {
            if (!c.enabled) continue;
            if (!promoAppliesToCadence(promo, c.cadence)) continue;
            const baseIls = c.price_ils + (withCoaching ? c.coaching_cost_ils : 0);
            const baseUsd = c.price_usd + (withCoaching ? c.coaching_cost_usd : 0);
            const ils = applyDiscount({ amount: baseIls, currency: "ILS", promo });
            const usd = applyDiscount({ amount: baseUsd, currency: "USD", promo });
            if (ils.promoId || usd.promoId) {
              firstChargeByCadence[c.cadence] = { ils: ils.discountedAmount, usd: usd.discountedAmount };
              originalByCadence[c.cadence] = { ils: ils.originalAmount, usd: usd.originalAmount };
            }
          }
          if (Object.keys(firstChargeByCadence).length === 0) return null;
          return { endsAt: promo.ends_at ?? null, firstChargeByCadence, originalByCadence };
        };

        const withCoaching = buildScope(withRes.promo, true);
        const withoutCoaching = buildScope(withoutRes.promo, false);
        if (withCoaching || withoutCoaching) {
          activePromo = { withCoaching, withoutCoaching };
        }
      }
    }
  } catch (err) {
    console.error("[journey-subscribe] active promo lookup failed — no banner", err);
  }

  let journeySubscribed = false;
  if (userId) {
    try {
      const entitlements = await getUserEntitlements(userId);
      journeySubscribed = !!entitlements?.journey;
    } catch {
      /* default false */
    }
  }

  return { journeyCadences, activePromo, offerExpiresAt, promoMode, journeySubscribed };
}
