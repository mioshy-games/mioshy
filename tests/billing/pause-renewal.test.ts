/**
 * tests/billing/pause-renewal.test.ts
 *
 * Dry-run of the renewal period arithmetic against the REAL production row for
 * t6102622@gmail.com (Tzachi Liv), read from the DB on 2026-07-30:
 *
 *   subscriptions      a7c2ba44-c95f-4ddd-84b1-2c4c24f72721
 *     status              grace
 *     plan                monthly, 69.00 ILS
 *     current_period_end  2026-07-30 07:45:51.096+00
 *   subscription_pauses
 *     paused_at           2026-07-05 04:33:55.343+00
 *     paused_until        2026-08-30 04:33:55.274+00   (8 weeks, "too_busy")
 *     resumed_at          null
 *
 * The bug this locks down: with the period anchored to current_period_end, a
 * charge taken when the pause expires covers 30.7 → 30.8 07:45 — a window that
 * has already elapsed — and sets next_billing_date to 30.8 07:45, which is
 * ALSO already past. The next hourly tick then charges again. Two charges,
 * three hours apart, for a customer who asked for a break.
 */

import { describe, expect, it } from "vitest";
import {
  computeRenewalPeriod,
  isPauseActive,
  pauseReturnAt,
  type PauseRow,
} from "@/lib/billing/renewal-period";
import { addPlanPeriod } from "@/lib/billing/period-math";

const SUB = {
  currentPeriodEnd: "2026-07-30T07:45:51.096+00:00",
  plan: "monthly" as const,
};

const PAUSE: PauseRow = {
  paused_until: "2026-08-30T04:33:55.274+00:00",
  resumed_at: null,
};

/** The first hourly cron tick after the pause expires (04:33) is 05:00. */
const FIRST_TICK_AFTER_PAUSE = new Date("2026-08-30T05:00:00.000Z");
/** The tick that used to produce the second charge. */
const LATER_SAME_DAY = new Date("2026-08-30T08:00:00.000Z");

describe("paused subscription is not charged while the pause runs", () => {
  it("is active for every tick before the pause ends", () => {
    expect(isPauseActive(PAUSE, new Date("2026-07-30T06:00:00Z"))).toBe(true);
    expect(isPauseActive(PAUSE, new Date("2026-08-29T23:00:00Z"))).toBe(true);
    expect(isPauseActive(PAUSE, new Date("2026-08-30T04:33:55.273Z"))).toBe(true);
  });

  it("is over from the moment paused_until passes", () => {
    expect(isPauseActive(PAUSE, FIRST_TICK_AFTER_PAUSE)).toBe(false);
  });

  it("treats an early manual resume as the real return moment", () => {
    const resumed: PauseRow = { ...PAUSE, resumed_at: "2026-08-10T09:00:00.000Z" };
    expect(isPauseActive(resumed, new Date("2026-08-11T00:00:00Z"))).toBe(false);
    expect(pauseReturnAt(resumed).toISOString()).toBe("2026-08-10T09:00:00.000Z");
  });
});

describe("the period restarts at the return, not at the stale anchor", () => {
  it("bills 30.8 → 30.9 and never the month the customer was paused for", () => {
    const { periodStart, periodEnd, shiftedByPause } = computeRenewalPeriod({
      currentPeriodEnd: SUB.currentPeriodEnd,
      plan: SUB.plan,
      pause: PAUSE,
      now: FIRST_TICK_AFTER_PAUSE,
    });

    expect(shiftedByPause).toBe(true);
    // Starts when he came back — NOT 2026-07-30T07:45:51 (the stale anchor).
    expect(periodStart.toISOString()).toBe("2026-08-30T04:33:55.274Z");
    // One month forward from the return.
    expect(periodEnd.toISOString()).toBe("2026-09-30T04:33:55.274Z");
    // The paused month is never billed.
    expect(periodStart.getTime()).toBeGreaterThan(new Date(SUB.currentPeriodEnd).getTime());
  });

  it("puts next_billing_date in the FUTURE, which is what kills the second charge", () => {
    const { periodEnd } = computeRenewalPeriod({
      currentPeriodEnd: SUB.currentPeriodEnd,
      plan: SUB.plan,
      pause: PAUSE,
      now: FIRST_TICK_AFTER_PAUSE,
    });
    // next_billing_date := periodEnd (see the success branch of the cron).
    expect(periodEnd.getTime()).toBeGreaterThan(LATER_SAME_DAY.getTime());
    const daysAhead = (periodEnd.getTime() - FIRST_TICK_AFTER_PAUSE.getTime()) / 86_400_000;
    expect(daysAhead).toBeGreaterThan(30);
  });

  it("so the 08:00 tick on the same day finds nothing due", () => {
    const { periodEnd } = computeRenewalPeriod({
      currentPeriodEnd: SUB.currentPeriodEnd,
      plan: SUB.plan,
      pause: PAUSE,
      now: FIRST_TICK_AFTER_PAUSE,
    });
    // The cron's due filter is next_billing_date <= now.
    const isDueAgain = periodEnd.getTime() <= LATER_SAME_DAY.getTime();
    expect(isDueAgain).toBe(false);
  });
});

describe("regression: the old anchor-only arithmetic double-charged", () => {
  it("would have billed an elapsed month and come due again three hours later", () => {
    // Exactly what the code did before: periodStart = current_period_end.
    const oldStart = new Date(SUB.currentPeriodEnd);
    const oldEnd = addPlanPeriod(oldStart, SUB.plan);

    expect(oldEnd.toISOString()).toBe("2026-08-30T07:45:51.096Z");
    // Charge #1 at 05:00 covers a window that already ended.
    expect(oldStart.getTime()).toBeLessThan(FIRST_TICK_AFTER_PAUSE.getTime());
    // …and next_billing_date lands BEFORE the 08:00 tick → charge #2 same day.
    expect(oldEnd.getTime()).toBeLessThanOrEqual(LATER_SAME_DAY.getTime());
  });
});

describe("an ordinary late renewal is untouched", () => {
  it("keeps its anchor when there is no pause", () => {
    const { periodStart, periodEnd, shiftedByPause } = computeRenewalPeriod({
      currentPeriodEnd: "2026-07-30T07:45:51.096+00:00",
      plan: "monthly",
      pause: null,
      now: new Date("2026-08-02T06:00:00Z"), // three days late
    });
    expect(shiftedByPause).toBe(false);
    expect(periodStart.toISOString()).toBe("2026-07-30T07:45:51.096Z");
    expect(periodEnd.toISOString()).toBe("2026-08-30T07:45:51.096Z");
  });

  it("ignores a pause that ended while the customer was still paid up", () => {
    const shortPause: PauseRow = {
      paused_until: "2026-07-20T00:00:00.000Z", // before current_period_end
      resumed_at: null,
    };
    const { periodStart, shiftedByPause } = computeRenewalPeriod({
      currentPeriodEnd: "2026-07-30T07:45:51.096+00:00",
      plan: "monthly",
      pause: shortPause,
      now: new Date("2026-07-30T08:00:00Z"),
    });
    expect(shiftedByPause).toBe(false);
    expect(periodStart.toISOString()).toBe("2026-07-30T07:45:51.096Z");
  });
});
