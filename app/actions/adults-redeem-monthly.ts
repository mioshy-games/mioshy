"use server";

/**
 * app/actions/adults-redeem-monthly.ts
 *
 * @deprecated 2026-05-22 — the "redeem one Adults game per month from
 * your Journey subscription" flow was removed. Journey subscribers now
 * have full access to every Adults game directly via
 * `getUserEntitlements().adults === true`.
 *
 * This stub is preserved so any lingering UI imports compile, but it
 * always returns `{ ok: false, error: "deprecated_use_journey_access" }`.
 * Once the call sites are removed, delete this file.
 */

export type RedeemResult =
  | { ok: true; entitlement_id: string }
  | { ok: false; error: string };

export async function redeemAdultsMonthly(
  _raw: { game_id: string },
): Promise<RedeemResult> {
  return {
    ok: false,
    error: "deprecated_use_journey_access",
  };
}
