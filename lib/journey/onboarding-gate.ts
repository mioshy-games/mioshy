/**
 * lib/journey/onboarding-gate.ts
 *
 * C.2 (work-order 2026-06-15) — the "complete your setup" gate.
 *
 * A journey subscriber who finished the SHORT assessment still has two things
 * left before the journey is fully set up:
 *   1. Connect their partner   (couple partner_count >= 2)
 *   2. Complete the FULL (long) assessment   (!isFullAssessmentPending)
 *
 * Until BOTH are done, the setup checklist page (/my/setup) becomes the main
 * surface: the journey landing + the journey area redirect to it. The moment
 * both are done this returns `gated: false` forever (it is recomputed live from
 * partner_count + the full-assessment derivation — there is no sticky flag to
 * un-set), so the gate disappears and never returns.
 *
 * This is the SAME source of truth the (now-superseded) non-blocking
 * OnboardingReminderCard used on /my — partner_count for item 1,
 * isFullAssessmentPending() for item 2 — just promoted to a blocking gate. We
 * reuse the cached getCurrentCoupleContext + getUserEntitlements reads, so
 * calling this inside a page that already resolved them is effectively free.
 *
 * Scope: journey entitlement only. A games/adults-only buyer is never gated
 * (the gate asks for the *journey* assessment, which they don't have). Callers
 * that impersonate (coach "view-as") must skip the gate themselves.
 */

import "server-only";

import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { isFullAssessmentPending } from "@/lib/journey/full-assessment-pending";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface OnboardingGateState {
  /** True while EITHER task is outstanding — the user must see /my/setup. */
  gated: boolean;
  /** item 1 ✓ — the partner has joined (partner_count >= 2). */
  partnerConnected: boolean;
  /** item 2 driver — true while the full assessment is still pending. */
  fullAssessmentPending: boolean;
  /** The couple's pair_code — needed by the invite widget on /my/setup. */
  pairCode: string | null;
  userId: string | null;
  coupleId: string | null;
}

const NOT_GATED: OnboardingGateState = {
  gated: false,
  partnerConnected: true,
  fullAssessmentPending: false,
  pairCode: null,
  userId: null,
  coupleId: null,
};

export async function getOnboardingGate(): Promise<OnboardingGateState> {
  const [ctx, entitlements] = await Promise.all([
    getCurrentCoupleContext(),
    getUserEntitlements(),
  ]);

  // Not logged in / no couple / no entitlements → nothing to gate here (auth
  // is enforced by the page/layout, not by this helper).
  if (!ctx || !entitlements) return NOT_GATED;

  const base = {
    pairCode: ctx.pair_code ?? null,
    userId: ctx.user_id,
    coupleId: ctx.couple_id ?? null,
  };

  // Journey-only gate. Owner-swapped entitlement, so a partner with free
  // journey access reads as entitled too.
  if (!entitlements.journey) {
    return { ...NOT_GATED, ...base };
  }

  const needsPartner = (ctx.partner_count ?? 0) < 2;

  let fullAssessmentPending = false;
  try {
    const admin = createServiceRoleClient();
    if (admin) {
      fullAssessmentPending = await isFullAssessmentPending(admin, ctx.user_id);
    }
  } catch {
    // Fail-open: a transient read error must never trap a user behind the gate.
    fullAssessmentPending = false;
  }

  return {
    ...base,
    gated: needsPartner || fullAssessmentPending,
    partnerConnected: !needsPartner,
    fullAssessmentPending,
  };
}
