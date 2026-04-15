/**
 * lib/billing.ts
 * Shared billing constants and helpers for mioshy subscriptions.
 */

export type Plan = "weekly" | "monthly" | "annual"

/** Amount in ILS per plan (VAT inclusive) */
export const PLAN_AMOUNTS_ILS: Record<Plan, number> = {
  weekly:  9,
  monthly: 37,
  annual:  369,
}

/** Amount in USD per plan */
export const PLAN_AMOUNTS_USD: Record<Plan, number> = {
  weekly:  3,
  monthly: 9,
  annual:  123,
}

/**
 * Return plan price info based on the user's country.
 * Israeli users pay ILS (CoinId=1), others pay USD (CoinId=2).
 *
 * If NEXT_PUBLIC_BILLING_TEST_PRICE is set (e.g. "1"), overrides all amounts to
 * that value — useful for testing real Cardcom charges without paying full price.
 */
export function getPlanPrice(plan: Plan, isIsraeli: boolean) {
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
    ? { amount: PLAN_AMOUNTS_ILS[plan], currency: "ILS", coinId: 1 }
    : { amount: PLAN_AMOUNTS_USD[plan], currency: "USD", coinId: 2 }
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
 */
export function addPlanPeriod(from: Date, plan: Plan): Date {
  const d = new Date(from.getTime())
  switch (plan) {
    case "weekly":
      d.setDate(d.getDate() + 7)
      return d
    case "monthly":
      d.setMonth(d.getMonth() + 1)
      return d
    case "annual":
      d.setFullYear(d.getFullYear() + 1)
      return d
  }
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
