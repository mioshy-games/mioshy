// ============================================================
// Viewer-scoped status lookup for the Journey pillar.
//
// This helper answers a single, opinionated question: "what should the
// routing layer do for this viewer when they click 'Journey'?"
//
// It returns three disjoint signals:
//   - hasActiveAssignments      → owner has at least one active journey
//                                 assignment (route to /journey/timeline)
//   - hasInProgressAssessment   → user has an in-progress journey
//                                 assessment (route to /journey with
//                                 Resume CTA)
//   - neither                   → marketing page / assessment CTA
//
// The helper is polymorphic on owner (couple > user). We read via the
// session client so RLS (migration 035) is honored — the journey_*
// policies already let the current user see their own assignments by
// user_id or couple membership.
// ============================================================

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { preferCoupleOwner } from "./owner";
import type { JourneyOwner } from "./types";

export interface OwnerJourneyStatus {
  owner: JourneyOwner;
  hasActiveAssignments: boolean;
  hasInProgressAssessment: boolean;
}

/**
 * Look up the viewer's Journey pillar status. Caller supplies the user
 * id and optional couple id — we prefer the couple owner when present
 * (matches `preferCoupleOwner()` and every other Journey query).
 *
 * Never throws; on error we return "no active content" so the routing
 * layer degrades gracefully into the marketing page.
 */
export async function getOwnerJourneyStatus(args: {
  userId: string;
  coupleId: string | null | undefined;
}): Promise<OwnerJourneyStatus> {
  const owner = preferCoupleOwner(args.userId, args.coupleId ?? null);
  const supabase = await createServerSupabaseClient();

  // 1. Active assignment existence — cheap existence check (head + limit 1).
  const assignmentQuery = supabase
    .from("journey_assignments")
    .select("id", { head: true, count: "exact" })
    .eq("is_active", true)
    .limit(1);

  const scopedAssignmentQuery =
    owner.kind === "couple"
      ? assignmentQuery.eq("couple_id", owner.coupleId)
      : assignmentQuery.eq("user_id", owner.userId);

  // 2. In-progress assessment — the legacy `journeys` table predates the
  //    content system. Any row that isn't "completed" counts as resumable.
  const assessmentQuery = supabase
    .from("journeys")
    .select("status", { head: false })
    .eq("user_id", args.userId)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [assignmentRes, assessmentRes] = await Promise.all([
    scopedAssignmentQuery,
    assessmentQuery,
  ]);

  const hasActiveAssignments =
    !assignmentRes.error && (assignmentRes.count ?? 0) > 0;

  const assessmentRow = assessmentRes.data as { status: string } | null;
  const hasInProgressAssessment =
    !assessmentRes.error &&
    !!assessmentRow &&
    assessmentRow.status !== "completed";

  return { owner, hasActiveAssignments, hasInProgressAssessment };
}
