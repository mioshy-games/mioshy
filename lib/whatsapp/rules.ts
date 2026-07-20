/**
 * Pure decision rules for the WhatsApp campaigns — the four "iron rules",
 * extracted so they are unit-testable in isolation (see tests/whatsapp/).
 *
 *   1. A purchaser NEVER gets the intro-price reminder.
 *   2. A non-purchaser NEVER gets the coach welcome (coach fires only on a
 *      journey purchase).
 *   3. A purchase stops everything immediately — the reminder re-checks
 *      purchase state at send time, so a fresh purchaser is dropped.
 *   4. At most ONE outbound WhatsApp per user per 7 days.
 */

const MIN_MS = 60 * 1000;
// The intro window is now 60 min (offer_expires_at = completion + 60min). We
// remind once, when 15–20 min remain (= 40–45 min after completion). The strip
// is exactly 5 min wide and half-open, matching the every-5-min cron: a user's
// "remaining" decreases by 5 min between consecutive ticks, so exactly one tick
// lands in [15, 20)min — each user passes through the strip once. (The campaign
// idempotency/throttle layer is the backstop against any double-send.)
const REMINDER_MIN_REMAINING_MS = 15 * MIN_MS;
const REMINDER_MAX_REMAINING_MS = 20 * MIN_MS;

/** Fires only while 15–20 min remain before the intro window closes:
 *  now + 15min <= offer_expires_at < now + 20min. */
export function isInIntroReminderWindow(offerExpiresAtMs: number, nowMs: number): boolean {
  const remainingMs = offerExpiresAtMs - nowMs;
  return remainingMs >= REMINDER_MIN_REMAINING_MS && remainingMs < REMINDER_MAX_REMAINING_MS;
}

/** Rules 1 + 3: reminder-eligible only for a non-purchaser inside the window. */
export function isReminderEligible(args: {
  offerExpiresAtMs: number;
  nowMs: number;
  /** current journey access (active/grace/trial) — a purchaser */
  hasActiveJourney: boolean;
  /** any subscription row ever — a purchaser */
  hasAnySubscription: boolean;
}): boolean {
  if (!isInIntroReminderWindow(args.offerExpiresAtMs, args.nowMs)) return false;
  if (args.hasActiveJourney) return false;
  if (args.hasAnySubscription) return false;
  return true;
}

/** Rule 2: the coach welcome fires only on a JOURNEY purchase. */
export function coachWelcomeApplies(product: string): boolean {
  return product === "journey";
}

/** Rule 4: at most one outbound WhatsApp per 7 days (count = prior sends in 7d). */
export function throttlePassed(recentOutboundInWindow: number): boolean {
  return recentOutboundInWindow <= 0;
}
