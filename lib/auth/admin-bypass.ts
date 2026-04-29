/**
 * Admin payment bypass — for end-to-end testing without real Cardcom charges.
 *
 * Whitelisted user emails are allowed to skip the Cardcom checkout entirely.
 * Their server-side purchase action grants the same entitlement / subscription
 * row that a successful indicator callback would write, tagged with a
 * distinct `source = 'admin_bypass'` so the audit trail stays honest.
 *
 * Default whitelist: mioshyoffice@gmail.com — the team's shared admin login.
 * Override via env var `MIOSHY_TEST_BYPASS_EMAILS` (comma-separated) when
 * you need to onboard another tester without a code change.
 *
 * SECURITY NOTES
 * ──────────────
 * 1. The check is server-only — never trust a client-supplied "I am admin"
 *    flag. Always read `auth.user.email` from the server Supabase client.
 * 2. The whitelist is a small, fixed set. Production Cardcom credentials
 *    still get loaded normally — the bypass is purely behavioural; no env
 *    is unset.
 * 3. Bypassed entitlements are visually identical to real ones to the user
 *    (same /play access, same pair code, same partner inheritance) so we
 *    can replay the full journey end-to-end. The only DB difference is
 *    `source = 'admin_bypass'` — useful for filtering analytics.
 */

const DEFAULT_BYPASS_EMAILS = ["mioshyoffice@gmail.com"];

function getBypassEmails(): string[] {
  const raw = process.env.MIOSHY_TEST_BYPASS_EMAILS?.trim();
  if (!raw) return DEFAULT_BYPASS_EMAILS.map((e) => e.toLowerCase());
  const list = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_BYPASS_EMAILS.map((e) => e.toLowerCase());
}

/**
 * Returns true when the email belongs to a payment-bypass tester.
 * Case-insensitive. Null / undefined / empty = false.
 */
export function isAdminBypassEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return getBypassEmails().includes(email.toLowerCase());
}

/**
 * Convenience helper for callers that already hold a Supabase user object.
 * Equivalent to `isAdminBypassEmail(user?.email)`.
 */
export function isAdminBypassUser(
  user: { email?: string | null } | null | undefined,
): boolean {
  return isAdminBypassEmail(user?.email);
}

/**
 * Source string written to entitlement / subscription rows when a purchase
 * was bypassed. Constants live here so we can grep the value across the
 * codebase and so analytics filters use the same literal everywhere.
 */
export const BYPASS_ENTITLEMENT_SOURCE = "admin_bypass" as const;
