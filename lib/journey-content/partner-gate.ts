import "server-only";

import { journeyOwnerForUser } from "@/lib/journey-content/owner";
import { getOwnerJourneyStatus } from "@/lib/journey-content/owner-status";
import { getActiveViewAs } from "@/lib/journey/view-as";

/**
 * Shared-content gate state (journey shared-content spec, step 3) — the SINGLE
 * source of truth for "must this viewer be blocked from the subscription
 * owner's shared chapters until they finish their OWN full assessment?".
 *
 * Extracted into one helper on purpose: the logic first lived inline in
 * /my/journey only, and an independent security review found THREE other
 * owner-content surfaces that showed the owner's chapters to a not-yet-assessed
 * partner. Every owner-content surface now calls this so the gate can't drift
 * again.
 *
 * `blocked` is true iff:
 *   - the viewer is a PARTNER deferred to someone else's queue
 *     (journeyOwnerForUser resolved a different user — step 1), AND
 *   - the viewer has NOT completed their own full assessment
 *     (journeys.status !== 'complete' via getOwnerJourneyStatus
 *     .hasCompletedAssessment — the existing completion signal; NOT
 *     subscription-gated, so it fires for an entitlement-inheriting partner).
 *
 * owner / solo / not-a-deferred-partner → blocked:false. Under view-as (coach
 * impersonation) → blocked:false so a coach can inspect the partner's state.
 * Never throws into a render: the underlying helpers degrade to self/false.
 */
export async function partnerAssessmentGateState(
  effectiveUserId: string,
): Promise<{ blocked: boolean }> {
  // Coach impersonation must never be blocked.
  const viewAs = await getActiveViewAs();
  if (viewAs) return { blocked: false };

  const owner = await journeyOwnerForUser(effectiveUserId);
  const isDeferredPartner =
    owner.kind === "user" && owner.userId !== effectiveUserId;
  if (!isDeferredPartner) return { blocked: false };

  const status = await getOwnerJourneyStatus({
    userId: effectiveUserId,
    coupleId: null,
  });
  return { blocked: !status.hasCompletedAssessment };
}
