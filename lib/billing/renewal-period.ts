/**
 * lib/billing/renewal-period.ts
 *
 * The billing period a renewal charge covers, and how a user-initiated pause
 * shifts it (Itzik 2026-07-30).
 *
 * Rule: a customer does not pay for time they were paused. The period is
 * normally anchored to `current_period_end` — so a charge that lands a few days
 * late does not cost the customer those days. But when a pause outlasts the
 * period, that anchor is in the past: the old code would charge for a window
 * that had already elapsed and then set next_billing_date to a moment that was
 * ALSO already past, so the very next cron tick charged again — two charges
 * hours apart.
 *
 * With a pause, the period therefore restarts at the moment the customer
 * actually came back, and the next charge is one full plan period after that.
 *
 * Pure functions, no I/O — the renewal cron and tests/billing/pause-renewal
 * import the same code so the arithmetic can never drift between them.
 */

import { addPlanPeriod, type BillingPlan as Plan } from "@/lib/billing/period-math";

/** The shape the cron reads out of `subscription_pauses`. */
export interface PauseRow {
  paused_until: string;
  resumed_at: string | null;
}

/**
 * When the customer is (or was) back: an explicit early resume wins over the
 * scheduled end, because that is when they actually returned.
 */
export function pauseReturnAt(pause: PauseRow): Date {
  return new Date(pause.resumed_at ?? pause.paused_until);
}

/** A pause still running at `now` — the subscription must not be charged. */
export function isPauseActive(pause: PauseRow, now: Date): boolean {
  return pauseReturnAt(pause).getTime() > now.getTime();
}

export interface RenewalPeriod {
  periodStart: Date;
  periodEnd: Date;
  /** True when the pause pushed the period forward off `current_period_end`. */
  shiftedByPause: boolean;
}

/**
 * The period a charge taken at `now` should cover.
 *
 * @param currentPeriodEnd the subscription's `current_period_end` (the anchor)
 * @param pause the most recent pause for this user, if any (expired or resumed)
 */
export function computeRenewalPeriod({
  currentPeriodEnd,
  plan,
  pause,
  now,
}: {
  currentPeriodEnd: string | Date | null;
  plan: Plan;
  pause?: PauseRow | null;
  now: Date;
}): RenewalPeriod {
  const anchor = currentPeriodEnd ? new Date(currentPeriodEnd) : now;
  let periodStart = anchor;
  let shiftedByPause = false;

  if (pause) {
    const back = pauseReturnAt(pause);
    // Only a pause that outlasted the paid period moves the anchor. A pause
    // that ended while the customer was still paid up changes nothing.
    if (back.getTime() > anchor.getTime()) {
      periodStart = back;
      shiftedByPause = true;
    }
  }

  return { periodStart, periodEnd: addPlanPeriod(periodStart, plan), shiftedByPause };
}
