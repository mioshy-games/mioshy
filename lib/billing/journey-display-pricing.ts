// ============================================================
// lib/billing/journey-display-pricing.ts
//
// Read-only helper that assembles the THREE numbers the homepage
// Stage-3 price block (components/marketing/v2/JourneyStages.tsx)
// renders, from their live sources of truth. Server-only.
//
// Source mapping (decided with Itzik 2026-06-30, after probing the
// live prod schema — the weekly cadence row is DISABLED and carries a
// stale figure, so it is intentionally NOT used):
//
//   • weekly headline (big number) = round(monthly ÷ 4.345)
//       — derived from the actually-sold monthly cadence so the headline
//         and the "billed …/month" line stay arithmetically consistent.
//   • billed monthly               = subscription_prices(journey, monthly).price_ils
//   • anchor (strikethrough)       = site_settings.journey_anchor_price_ils
//
// Every field is null-safe: a missing/failed value stays null so the
// <CmsPrice> consumer renders the existing CMS literal verbatim (zero
// regression on a transient DB hiccup or before the anchor column ships).
// ============================================================
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSubscriptionPrice } from "@/lib/billing/pricing-queries";

/**
 * Average weeks per month. Mirrors the constant the admin pricing editor
 * uses (app/dashboard/settings/pricing/page.tsx → WEEKS.monthly = 4.345) so
 * the weekly headline derived here matches the admin's own monthly⇄weekly maths.
 */
const WEEKS_PER_MONTH = 4.345;

export interface JourneyDisplayPricing {
  /** Big weekly headline figure, derived from the live monthly price. null ⇒ CMS fallback. */
  weeklyHeadlineIls: number | null;
  /** Live monthly charge — drives the "מחויב ₪X/חודש" line. null ⇒ CMS fallback. */
  monthlyIls: number | null;
  /** Marketing strikethrough anchor (site_settings). null ⇒ CMS fallback. */
  anchorIls: number | null;
}

export const getJourneyDisplayPricing = cache(
  async function getJourneyDisplayPricingImpl(): Promise<JourneyDisplayPricing> {
    const monthly = await getSubscriptionPrice("journey", "monthly");
    const monthlyIls = monthly ? monthly.price_ils : null;
    const weeklyHeadlineIls =
      monthlyIls != null ? Math.round(monthlyIls / WEEKS_PER_MONTH) : null;

    let anchorIls: number | null = null;
    try {
      const supabase = await createServerSupabaseClient();
      const { data } = await supabase
        .from("site_settings")
        .select("journey_anchor_price_ils")
        .eq("id", 1)
        .maybeSingle();
      // The supabase client is untyped here, and numeric(…) arrives from
      // PostgREST as a string — coerce, treating null/undefined as "unset".
      const raw = (
        data as { journey_anchor_price_ils?: number | string | null } | null
      )?.journey_anchor_price_ils;
      anchorIls = raw == null ? null : Number(raw);
    } catch {
      anchorIls = null;
    }

    return { weeklyHeadlineIls, monthlyIls, anchorIls };
  },
);
