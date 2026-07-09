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

const DAY_MS = 24 * 60 * 60 * 1000;

/** The reminder fires only inside the last 24h before the intro window expires:
 *  now < offer_expires_at <= now + 24h. (offer_expires_at = completion + 48h.) */
export function isInIntroReminderWindow(offerExpiresAtMs: number, nowMs: number): boolean {
  return offerExpiresAtMs > nowMs && offerExpiresAtMs <= nowMs + DAY_MS;
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
