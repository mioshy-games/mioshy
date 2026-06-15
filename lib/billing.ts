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
 *
 * C1 2026-06-13 — prices moved to the DB table `subscription_prices`
 * (migration 112), edited live from the admin. getPlanPrice() reads it;
 * the PLAN_AMOUNTS_* constants below remain only as a resilience fallback.
 */

import { getSubscriptionPrice, type Cadence } from "@/lib/billing/pricing-queries"

// C2 (2026-06-14): the plan IS the billing cadence. Display to the
// customer stays weekly; the actual charge interval follows this value.
// Structurally identical to `Cadence` in pricing-queries — kept as its
// own exported name for the many `Plan`-typed call sites.
export type Plan = "weekly" | "monthly" | "quarterly" | "yearly"
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
 * Return plan price info based on product, plan/cadence, and country.
 * Israeli users pay ILS (CoinId=1), others pay USD (CoinId=2).
 *
 * C1 (2026-06-13): prices now live in the DB table `subscription_prices`
 * (migration 112), edited live from the admin. The `plan` argument is the
 * cadence to price; today the only enabled cadence is "weekly". We read
 * that row and, if the read fails or the row is missing, fall back to the
 * PLAN_AMOUNTS_* constants below so a transient DB issue never blocks a
 * checkout.
 *
 * If NEXT_PUBLIC_BILLING_TEST_PRICE is set (e.g. "1"), it overrides the
 * amount — useful for testing real Cardcom charges without paying full
 * price. (Checked first, before any DB read.)
 */
export async function getPlanPrice(
  plan: Plan,
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

  // Settings-driven: read the DB price for this product + cadence.
  // `plan` is the cadence string (currently always "weekly").
  const dbPrice = await getSubscriptionPrice(product, plan as Cadence)
  if (dbPrice) {
    return isIsraeli
      ? { amount: dbPrice.price_ils, currency: "ILS", coinId: 1 }
      : { amount: dbPrice.price_usd, currency: "USD", coinId: 2 }
  }

  // Fallback: hardcoded constants (DB read failed / row missing).
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
 * Calculate the next billing period end from a given start date, by
 * cadence. weekly = +7 days; monthly/quarterly/yearly advance by
 * calendar months (1 / 3 / 12).
 *
 * Month arithmetic clamps the day-of-month to the target month's last
 * day so a charge anchored on the 31st (or Jan-29/30/31) NEVER skips a
 * month — the bug in the pre-092 code, which used naive
 * Date.setMonth(+1)/setFullYear(+1) and rolled e.g. Jan-31 → Mar-3.
 * All math is in UTC to match how next_billing_date is stored (ISO/UTC).
 */
export function addPlanPeriod(from: Date, plan: Plan = "weekly"): Date {
  if (plan === "weekly") return addDaysUTC(from, 7)
  const months = plan === "monthly" ? 1 : plan === "quarterly" ? 3 : 12
  return addMonthsUTC(from, months)
}

/** Add whole days in UTC. */
function addDaysUTC(from: Date, days: number): Date {
  const d = new Date(from.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

/**
 * Add whole calendar months in UTC, clamping the day to the target
 * month's last valid day (so the 31st never overflows into the next
 * month). Preserves the time-of-day.
 */
function addMonthsUTC(from: Date, months: number): Date {
  const year  = from.getUTCFullYear()
  const month = from.getUTCMonth() + months
  const targetYear  = year + Math.floor(month / 12)
  const targetMonth = ((month % 12) + 12) % 12
  // Day 0 of (month+1) = last day of the target month.
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const day = Math.min(from.getUTCDate(), lastDay)
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    day,
    from.getUTCHours(),
    from.getUTCMinutes(),
    from.getUTCSeconds(),
    from.getUTCMilliseconds(),
  ))
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
