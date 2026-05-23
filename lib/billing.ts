/**
 * lib/billing.ts
 * Shared billing constants and helpers for mioshy subscriptions.
 *
 * Itzik 2026-05-22 — pricing simplification:
 *   • Subscriptions are weekly only. Monthly + annual plans are removed.
 *   • Games subscription: 9 ₪/week ($3/week).
 *   • Journey subscription: 57 ₪/week ($17/week).
 *   • Adults: one-time per game purchase (handled outside this file via
 *     experience_games.price_ils/usd).
 */

export type Plan = "weekly"
export type SubscriptionProduct = "games" | "journey"

/**
 * Per-product weekly subscription prices.
 *
 * Indexed by product so journey/games never charge the same amount.
 * (Historical: prior to 2026-05-22 this matrix had a weekly/monthly/annual
 * axis. Itzik consolidated to weekly-only — the monthly/annual entries
 * were never used in production.)
 */
export const PLAN_AMOUNTS_ILS: Record<SubscriptionProduct, number> = {
  games:    9,
  journey: 57,
}

export const PLAN_AMOUNTS_USD: Record<SubscriptionProduct, number> = {
  games:    3,
  journey: 17,
}

/**
 * Return plan price info based on product and country.
 * Israeli users pay ILS (CoinId=1), others pay USD (CoinId=2).
 *
 * If NEXT_PUBLIC_BILLING_TEST_PRICE is set (e.g. "1"), overrides the amount
 * to that value — useful for testing real Cardcom charges without paying
 * full price.
 *
 * The `_plan` parameter is kept in the signature for backwards-compatible
 * call sites but is ignored: there is now only one plan (weekly).
 */
export function getPlanPrice(
  _plan: Plan,
  isIsraeli: boolean,
  product: SubscriptionProduct = "journey",
) {
  const testOverride = process.env.NEXT_PUBLIC_BILLING_TEST_PRICE
  if (testOverride) {
    const amt = Number(testOverride)
    if (Number.isFinite(amt) && amt > 0) {
      return isIsraeli
        ? { amount: amt, currency: "ILS", coinId: 1 }
        : { amount: amt, currency: "USD", coinId: 2 }
    }
  }
  return isIsraeli
    ? { amount: PLAN_AMOUNTS_ILS[product], currency: "ILS", coinId: 1 }
    : { amount: PLAN_AMOUNTS_USD[product], currency: "USD", coinId: 2 }
}

/**
 * Cardcom page language for LowProfile form.
 * Hebrew for Israeli users, English for everyone else.
 */
export function getCardcomLanguage(locale: string, isIsraeli: boolean): string {
  if (locale === "he" || isIsraeli) return "he"
  return "en"
}

/**
 * Calculate the next billing period end from a given start date.
 * All subscriptions are weekly — always advance by 7 days.
 */
export function addPlanPeriod(from: Date, _plan: Plan = "weekly"): Date {
  const d = new Date(from.getTime())
  d.setDate(d.getDate() + 7)
  return d
}

/**
 * Generate a unique Cardcom asmachta (idempotency key) for a renewal charge.
 * Format: m:<first-12-chars-of-userId>:<YYYYMMDD>
 */
export function makeAsmachta(userId: string, forDate: Date): string {
  const ymd    = forDate.toISOString().slice(0, 10).replace(/-/g, "")
  const prefix = userId.replace(/-/g, "").slice(0, 12)
  return `m:${prefix}:${ymd}`
}

/** Grace period after a failed charge before subscription is blocked */
export const GRACE_PERIOD_DAYS = 7
