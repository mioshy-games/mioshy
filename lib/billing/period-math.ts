/**
 * lib/billing/period-math.ts
 *
 * Pure billing-period date arithmetic. Extracted verbatim from lib/billing.ts
 * (Itzik 2026-07-30) with NO behaviour change: lib/billing re-exports
 * `addPlanPeriod` from here, so every existing call site is untouched.
 *
 * The reason for the split is testability. lib/billing imports
 * pricing-queries, which calls React's `cache()` at module scope — importing it
 * from a plain node test throws "cache is not a function", so the renewal date
 * math could not be unit-tested where it lives. This module has zero imports.
 */

// Structurally identical to `Plan` in lib/billing (which re-exports the type);
// declared here so this module stays import-free.
export type BillingPlan = "weekly" | "monthly" | "quarterly" | "yearly";

/**
 * Advance a date by one billing period for the given plan/cadence.
 * weekly = +7 days; monthly/quarterly/yearly advance by calendar months
 * (1 / 3 / 12).
 *
 * Month arithmetic clamps the day-of-month to the target month's last day so a
 * charge anchored on the 31st (or Jan-29/30/31) NEVER skips a month — the bug
 * in the pre-092 code, which used naive Date.setMonth(+1)/setFullYear(+1) and
 * rolled e.g. Jan-31 → Mar-3. All math is in UTC to match how
 * next_billing_date is stored (ISO/UTC).
 */
export function addPlanPeriod(from: Date, plan: BillingPlan = "weekly"): Date {
  if (plan === "weekly") return addDaysUTC(from, 7);
  const months = plan === "monthly" ? 1 : plan === "quarterly" ? 3 : 12;
  return addMonthsUTC(from, months);
}

/** Add whole days in UTC. */
function addDaysUTC(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Add whole calendar months in UTC, clamping the day to the target month's
 * last valid day (so the 31st never overflows into the next month). Preserves
 * the time-of-day.
 */
function addMonthsUTC(from: Date, months: number): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  // Day 0 of (month+1) = last day of the target month.
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(from.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}
