// ============================================================
// Adults pillar - pricing resolver
//
// Converts the admin-controlled `between_us_settings` + per-game overrides
// into a stable shape the UI (marketing pages, game detail pricing panel,
// admin previews) can consume without having to reason about defaults or
// locale-specific currency formatting every time.
//
// Three tiers:
//   - single  (per-game, lifetime, owned by couple)
//   - monthly (couple membership, renews monthly)
//   - annual  (couple membership, renews yearly, includes Games-pillar slot)
// ============================================================
import type { BetweenUsSettings, ExperienceGame, AdultsPlanTier } from "@/lib/between-us/types";

export interface TierPrice {
  tier: AdultsPlanTier;
  enabled: boolean;
  /** Raw ILS amount (₪). */
  priceIls: number;
  /** Raw USD amount ($). */
  priceUsd: number;
  /** Pre-formatted amount for the requested locale. */
  displayPrice: string;
  /** Optional per-period suffix, e.g. `/mo`, `/yr`. Empty for `single`. */
  periodLabel: string;
}

export interface AdultsPricing {
  single: TierPrice;
  monthly: TierPrice;
  annual: TierPrice;
  /** Buy-X-Get-X tiers applied on top of `single` purchases, if enabled. */
  bundleTiers: { buy: number; get: number }[];
  currency: "ILS" | "USD";
}

function formatAmount(amount: number, currency: "ILS" | "USD"): string {
  // Amounts are whole-number-friendly in settings; drop trailing .00 for cleaner UI.
  const whole = Math.round(amount) === amount;
  const body = whole ? amount.toFixed(0) : amount.toFixed(2);
  const symbol = currency === "ILS" ? "₪" : "$";
  // Per design spec: currency symbol always sits at the visual LEFT of the
  // number with one space between them ("₪ 127", not "₪127" or "127₪").
  // We wrap in U+2066 LRI (Left-to-Right Isolate) + U+2069 PDI (Pop Directional
  // Isolate) so the symbol-then-number ordering is preserved regardless of
  // surrounding paragraph direction - i.e. even inside RTL Hebrew copy, the
  // price reads "₪ 127" left-to-right and the symbol stays on the left.
  return `⁦${symbol} ${body}⁩`;
}

/**
 * Resolve the pricing surface for the Adults pillar.
 *
 * @param settings    Admin-controlled global settings singleton.
 * @param locale      UI locale; drives ILS vs USD and the period suffix language.
 * @param game        Optional per-game override for single-purchase pricing.
 *                    When omitted (catalogue/marketing context), `settings.single_price_*`
 *                    is used as the representative single price.
 */
export function resolveAdultsPricing(
  settings: Pick<
    BetweenUsSettings,
    | "single_purchase_enabled"
    | "monthly_enabled"
    | "annual_enabled"
    | "single_price_ils"
    | "single_price_usd"
    | "monthly_price_ils"
    | "monthly_price_usd"
    | "annual_price_ils"
    | "annual_price_usd"
    | "buy_x_get_x_enabled"
    | "buy_x_get_x_tiers"
  >,
  locale: string,
  game?: Pick<ExperienceGame, "price_ils" | "price_usd"> | null,
): AdultsPricing {
  const isHe = locale === "he";
  const currency: "ILS" | "USD" = isHe ? "ILS" : "USD";

  const pick = (ils: number, usd: number) =>
    currency === "ILS" ? Number(ils) : Number(usd);

  // Single: prefer per-game override, fall back to settings default.
  const singleIls = Number(game?.price_ils ?? settings.single_price_ils);
  const singleUsd = Number(game?.price_usd ?? settings.single_price_usd);

  const monthlyIls = Number(settings.monthly_price_ils);
  const monthlyUsd = Number(settings.monthly_price_usd);
  const annualIls = Number(settings.annual_price_ils);
  const annualUsd = Number(settings.annual_price_usd);

  const perMo = isHe ? "/חודש" : "/mo";
  const perYr = isHe ? "/שנה" : "/yr";

  return {
    currency,
    single: {
      tier: "single",
      enabled: settings.single_purchase_enabled,
      priceIls: singleIls,
      priceUsd: singleUsd,
      displayPrice: formatAmount(pick(singleIls, singleUsd), currency),
      periodLabel: "",
    },
    // 2026-05-22 — the Adults pillar is one-time only. The admin
    // toggles for monthly/annual on `between_us_settings` are kept on
    // the row so we don't drop historical configuration, but the
    // resolver hard-overrides `enabled = false` here so the marketing
    // and detail surfaces stop offering tiers the checkout API will
    // refuse. (See checkout/create: product='adults' + subscription
    // returns INVALID_PRODUCT.)
    monthly: {
      tier: "monthly",
      enabled: false,
      priceIls: monthlyIls,
      priceUsd: monthlyUsd,
      displayPrice: formatAmount(pick(monthlyIls, monthlyUsd), currency),
      periodLabel: perMo,
    },
    annual: {
      tier: "annual",
      enabled: false,
      priceIls: annualIls,
      priceUsd: annualUsd,
      displayPrice: formatAmount(pick(annualIls, annualUsd), currency),
      periodLabel: perYr,
    },
    bundleTiers: settings.buy_x_get_x_enabled ? settings.buy_x_get_x_tiers : [],
  };
}

/**
 * Annualized cost of the monthly tier - useful for marketing the annual tier
 * ("save vs paying monthly"). Returns a formatted string in the pricing currency.
 */
export function annualizedMonthlyCost(pricing: AdultsPricing): string {
  const amount =
    pricing.currency === "ILS"
      ? pricing.monthly.priceIls * 12
      : pricing.monthly.priceUsd * 12;
  return formatAmount(amount, pricing.currency);
}

/**
 * Savings (monthly×12 − annual) as a formatted string. Returns null when the
 * annual tier is more expensive than 12× monthly (shouldn't happen in practice).
 */
export function annualSavings(pricing: AdultsPricing): string | null {
  const monthly12 =
    pricing.currency === "ILS"
      ? pricing.monthly.priceIls * 12
      : pricing.monthly.priceUsd * 12;
  const annual =
    pricing.currency === "ILS"
      ? pricing.annual.priceIls
      : pricing.annual.priceUsd;
  const diff = monthly12 - annual;
  if (diff <= 0) return null;
  return formatAmount(diff, pricing.currency);
}
