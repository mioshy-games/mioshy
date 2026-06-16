/**
 * lib/journey/setup-landing.ts
 *
 * C (work-order 2026-06-15, revised concept) — the /my/setup LANDING page.
 *
 * NOT a gate anymore. /my/setup is a non-blocking landing surface: it shows up
 * as the post-login landing only while the user's assessment is still pending,
 * and the user is free to navigate anywhere from it. The SOLE condition for the
 * page to appear / keep being the login landing is the assessment — partner
 * connection never affects it.
 *
 * Source of truth for "assessment pending" = the existing isFullAssessmentPending
 * (subscriber who saw the SHORT report but hasn't finished the FULL one). NOTE:
 * this only fires for users with an active subscription AND a 'short' journey
 * report — i.e. the journey funnel. Free / non-journey users have no
 * "assessment pending" state in the data, so they do not land here. Broadening
 * to them would require a new signal and is deliberately NOT invented here.
 *
 * Partner-invite presentation (never mandatory):
 *   · "task"     — journey buyer: connecting a partner is a recommended (not
 *                  required) step. Page appearance never depends on it.
 *   · "optional" — bought another product (games / adults) but not journey: the
 *                  invite is shown as an optional recommendation.
 *   · "disabled" — no purchase: the row is visible but greyed and inert.
 */

import "server-only";

import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import { isFullAssessmentPending } from "@/lib/journey/full-assessment-pending";
import { createServiceRoleClient } from "@/lib/supabase-admin";

/** How the partner-invite row is presented. It is never a blocking task. */
export type PartnerInviteMode = "task" | "optional" | "disabled";

export interface SetupLandingState {
  /** The ONLY driver of page appearance: the assessment is still pending. */
  pending: boolean;
  /** The partner has joined (couple partner_count >= 2). */
  partnerConnected: boolean;
  /** How to present the partner-invite row (never mandatory). */
  partnerMode: PartnerInviteMode;
  /** The couple's pair_code — needed by the invite widget. */
  pairCode: string | null;
}

const DEFAULT_STATE: SetupLandingState = {
  pending: false,
  partnerConnected: true,
  partnerMode: "disabled",
  pairCode: null,
};

export async function getSetupLandingState(): Promise<SetupLandingState> {
  const [ctx, entitlements] = await Promise.all([
    getCurrentCoupleContext(),
    getUserEntitlements(),
  ]);

  if (!ctx || !entitlements) return DEFAULT_STATE;

  // Partner-invite presentation, derived purely from what the user owns —
  // never a gate on the page.
  const partnerMode: PartnerInviteMode = entitlements.journey
    ? "task"
    : entitlements.pillarCount > 0
      ? "optional"
      : "disabled";

  let pending = false;
  try {
    const admin = createServiceRoleClient();
    if (admin) {
      pending = await isFullAssessmentPending(admin, ctx.user_id);
    }
  } catch {
    // Fail-closed on appearance: a transient read error should not trap the
    // user on the landing — treat as "not pending" so they flow to /my/lessons.
    pending = false;
  }

  return {
    pending,
    partnerConnected: (ctx.partner_count ?? 0) >= 2,
    partnerMode,
    pairCode: ctx.pair_code ?? null,
  };
}
