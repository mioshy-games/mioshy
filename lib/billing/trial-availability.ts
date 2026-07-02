/**
 * lib/billing/trial-availability.ts
 *
 * Shared resolver for "does this (product, coaching) package currently offer a
 * 7-day trial, and if so what is the post-trial charge?" (A3).
 *
 * Used by the trial-availability API route (client CTAs read it to decide
 * whether to render the trial offer). The authoritative eligibility + abuse +
 * pricing checks still run server-side in /api/billing/checkout/create-trial —
 * this is display-only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlanPrice } from "@/lib/billing";
import { resolveJourneyAmount } from "@/lib/billing/journey-coaching-pricing";
import { resolveCheckoutCadence } from "@/lib/billing/pricing-queries";
import { findActivePromo, applyDiscount } from "@/lib/billing/promos";

export interface TrialAvailability {
  enabled: boolean;
  /** Post-trial charge amount (promo-aware), for the "then ₪X" disclosure. */
  amount: number | null;
  currency: string | null;
}

const DISABLED: TrialAvailability = { enabled: false, amount: null, currency: null };

/**
 * Resolve trial availability + the post-trial (promo-aware) amount.
 * v1 is Israeli/ILS only — non-Israeli always resolves to disabled.
 *
 * `admin` must be a service-role or otherwise trial_settings-readable client.
 */
export async function getTrialAvailability(
  admin: SupabaseClient,
  args: {
    product: "games" | "journey";
    coaching: boolean;
    isIsraeli: boolean;
    /** Cadence hint from the calling surface, so the disclosed post-trial
     *  amount matches what create-trial will actually charge. Resolved the
     *  same way (requested cadence if enabled, else the product default). */
    plan?: string | null;
  },
): Promise<TrialAvailability> {
  const { product, coaching, isIsraeli } = args;

  // v1: Israeli/ILS only (matches create-trial's TRIAL_ILS_ONLY guard).
  if (!isIsraeli) return DISABLED;
  if (product === "games" && coaching) return DISABLED; // games has no coaching

  const { data: setting } = await admin
    .from("trial_settings")
    .select("enabled")
    .eq("product", product)
    .eq("coaching", coaching)
    .maybeSingle();
  if (!setting?.enabled) return DISABLED;

  // Resolve the post-trial charge exactly like create-trial does, so the
  // disclosure amount matches what will actually be charged on day 7. We pass
  // the same plan hint the surface will send to create-trial.
  const cadence = await resolveCheckoutCadence(product, args.plan ?? null);
  if (!cadence) return DISABLED;

  let amount: number;
  let currency: string;
  if (product === "journey") {
    const j = await resolveJourneyAmount(cadence, isIsraeli, coaching);
    amount = j.amount; currency = j.currency;
  } else {
    const p = await getPlanPrice(cadence, isIsraeli, "games");
    amount = p.amount; currency = p.currency;
  }

  try {
    const { promo } = await findActivePromo(admin, { product, cadence, coaching });
    if (promo) {
      const res = applyDiscount({ amount, currency: currency === "USD" ? "USD" : "ILS", promo });
      if (res.promoId) amount = res.discountedAmount;
    }
  } catch {
    // Display-only — fall back to full price on any promo error.
  }

  return { enabled: true, amount, currency };
}
