"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Carries the live Stage-3 price figures from a server parent down to the
 * client <JourneyStages /> tree, mirroring the CmsTextProvider pattern.
 *
 * Why a provider instead of props: <JourneyStages /> renders on two pages and,
 * on the homepage, sits deep inside the client <HomepageV2 />. Threading props
 * through HomepageV2 would touch unrelated code; a context set at the page level
 * (above CmsTextProvider's subtree) reaches JourneyStages without that churn and
 * keeps its hook order untouched.
 *
 * A missing provider entirely — or a null monthlyIls — makes the Stage-3 block
 * in JourneyStages fall back to the CMS literal, i.e. the pre-existing
 * behaviour. So this is always safe to read.
 *
 * Shape mirrors lib/billing/journey-display-pricing.ts (monthly + promo).
 */
export interface JourneyPricingValue {
  monthlyIls: number | null;
  firstChargeIls: number | null;
  hasPromo: boolean;
}

const JourneyPricingContext = createContext<JourneyPricingValue | null>(null);

export function JourneyPricingProvider({
  value,
  children,
}: {
  value: JourneyPricingValue;
  children: ReactNode;
}) {
  return (
    <JourneyPricingContext.Provider value={value}>
      {children}
    </JourneyPricingContext.Provider>
  );
}

/**
 * Live Stage-3 pricing numbers, or null when no provider wraps the tree.
 * A null return (or a null monthlyIls) is the signal for the Stage-3 block to
 * render the CMS literal.
 */
export function useJourneyPricing(): JourneyPricingValue | null {
  return useContext(JourneyPricingContext);
}
