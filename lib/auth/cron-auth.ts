/**
 * Shared Bearer authentication for scheduled / operator-invoked routes.
 *
 * Audit 2026-08-05, H2.
 *
 * WHAT WAS WRONG
 * Every cron route rolled its own `authOk`, each accepting a different
 * `||` cascade of up to four secrets — JOURNEY_REMINDERS / JOURNEY_CADENCE /
 * JOURNEY_UNLOCK / JOURNEY_GRACE / JOURNEY_SCORES / MAILING_TEST /
 * CARDCOM_BILLING. Six distinct secrets floated across nineteen routes, and
 * the billing secret sat in the fallback chain of ten content routes, so a leak
 * of any one of them reached the money paths. Comparisons used `===`, which
 * exits on the first differing byte.
 *
 * HOW AUTHENTICATION ACTUALLY WORKS HERE
 * Vercel Cron attaches `Authorization: Bearer $CRON_SECRET` to every scheduled
 * invocation — that system variable is the real credential in production, and
 * the only reason the existing cascades authenticate at all is that the
 * JOURNEY_* variables were set to the same value as CRON_SECRET. See the note
 * in app/api/journey/marketing-sequence/route.ts recording that discovery.
 *
 * So each route now accepts exactly two values:
 *   · CRON_SECRET            — what Vercel sends on a schedule.
 *   · the scope's own secret — BILLING_CRON_SECRET or JOURNEY_CRON_SECRET,
 *                              for manual / external invocation.
 *
 * A billing route never accepts the journey secret, and vice versa.
 */

import { timingSafeEqual } from "node:crypto";

/** Billing routes move money; journey routes deliver content. Never shared. */
export type CronScope = "billing" | "journey";

/**
 * Constant-time string comparison.
 *
 * A plain `===` leaks how many leading bytes matched. Length is compared first
 * (timingSafeEqual throws on differing lengths), but we still run a comparison
 * in that branch so a wrong-length token costs the same as a wrong-value one.
 */
function constantTimeEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** The secrets a given scope will accept, in no particular order. */
function expectedSecrets(scope: CronScope): string[] {
  const dedicated =
    scope === "billing"
      ? process.env.BILLING_CRON_SECRET
      : process.env.JOURNEY_CRON_SECRET;
  return [dedicated, process.env.CRON_SECRET].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
}

/**
 * True when the request carries a Bearer token matching this scope.
 *
 * With nothing configured we fall back to the pre-existing behaviour: closed in
 * production, open on local/preview so development does not need secrets.
 */
export function isCronAuthorized(req: Request, scope: CronScope): boolean {
  const secrets = expectedSecrets(scope);
  if (secrets.length === 0) {
    return process.env.VERCEL_ENV !== "production";
  }

  const provided = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!provided) return false;

  // Every candidate is evaluated — no early exit — so the number of configured
  // secrets cannot be inferred from response timing.
  let ok = false;
  for (const secret of secrets) {
    if (constantTimeEquals(provided, secret)) ok = true;
  }
  return ok;
}
