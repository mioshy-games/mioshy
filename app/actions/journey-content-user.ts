"use server";

// ============================================================
// User-facing server actions for the Journey Content System.
//
// Migration 035 installs SELECT-only RLS on all journey_* tables, so every
// write here uses this pattern:
//
//   1. Resolve the current user identity via the SESSION client
//      (createServerSupabaseClient) - honours RLS, uses the signed-in
//      cookie. Also runs the profile-complete gate so anonymous or
//      half-onboarded users cannot trigger writes.
//   2. Resolve authorization by loading the scheduled_item + its
//      assignment through the admin client and checking that either
//      assignment.user_id === me.id, or assignment.couple_id is one of
//      my couple memberships.
//   3. Perform the write through the ADMIN client (service role).
//
// This matches the project-wide rule we distilled in the Supabase SSR
// memory - session-for-identity, admin-for-writes - because the
// @supabase/ssr JWT handshake to PostgREST is flaky and we've been bitten
// by RLS-denied inserts under load. For reads inside user surfaces we
// still use the session client (see getTimelineForOwner).
// ============================================================

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireCompleteProfile } from "@/lib/auth/profile-gate";
import { viewerIsPartnerOfOwner } from "@/lib/journey-content/owner";
import { logActivity } from "@/lib/journey/activity";
import type {
  JourneyAssignment,
  JourneyItemResponse,
  JourneyScheduledItem,
} from "@/lib/journey-content/types";

// A plain unit success, and an extended success carrying a payload. We
// split these because `Record<string, never>` collapses under the
// intersection `{ ok: true } & T` and TS rejects the default.
type OkUnit = { ok: true };
type Ok<T extends Record<string, unknown>> = { ok: true } & T;
type Err = { ok: false; error: string };

// ------------------------------------------------------------
// Shared guards
// ------------------------------------------------------------

async function resolveViewer(): Promise<
  | { ok: true; userId: string; coupleIds: string[] }
  | { ok: false; error: string }
> {
  const gate = await requireCompleteProfile();
  if (!gate.ok) return { ok: false, error: gate.error };
  const userId = gate.gate.user_id;

  // Every couple the user is currently a member of - usually 0 or 1, but
  // we don't assume the RPC has enforced that invariant.
  const session = await createServerSupabaseClient();
  const { data: memberships, error } = await session
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  const coupleIds = (memberships ?? [])
    .map((m) => m.couple_id as string)
    .filter(Boolean);

  return { ok: true, userId, coupleIds };
}

async function loadScheduledForViewer(args: {
  scheduledItemId: string;
  userId: string;
  coupleIds: string[];
}): Promise<
  | { ok: true; scheduled: JourneyScheduledItem; assignment: JourneyAssignment }
  | { ok: false; error: string }
> {
  const admin = await createAdminClient();
  const { data: scheduledRow, error: sErr } = await admin
    .from("journey_scheduled_items")
    .select("*")
    .eq("id", args.scheduledItemId)
    .maybeSingle();
  if (sErr) return { ok: false, error: sErr.message };
  if (!scheduledRow) return { ok: false, error: "not_found" };
  const scheduled = scheduledRow as JourneyScheduledItem;

  const { data: assignmentRow, error: aErr } = await admin
    .from("journey_assignments")
    .select("*")
    .eq("id", scheduled.assignment_id)
    .maybeSingle();
  if (aErr) return { ok: false, error: aErr.message };
  if (!assignmentRow) return { ok: false, error: "not_found" };
  const assignment = assignmentRow as JourneyAssignment;

  if (!assignment.is_active) {
    return { ok: false, error: "assignment_inactive" };
  }

  let ownedByMe: boolean =
    (!!assignment.user_id && assignment.user_id === args.userId) ||
    (!!assignment.couple_id && args.coupleIds.includes(assignment.couple_id));

  // Shared-content (spec step 2): a PARTNER may act on the SUBSCRIPTION
  // OWNER's per-user cadence items — shared completions + responses. The
  // owner's cadence assignment is user-owned (couple_id NULL, user_id =
  // ownerId !== viewer), so the checks above miss it. Authorize via
  // couple_members (admin, never trust the client): the viewer must be the
  // owner's partner in the same couple. Unrelated users still hit the
  // strict "forbidden" below. The deleteScheduledItemResponse author check
  // (resp.user_id !== viewer) is separate and unchanged.
  if (!ownedByMe && assignment.user_id) {
    ownedByMe = await viewerIsPartnerOfOwner(args.userId, assignment.user_id);
  }

  if (!ownedByMe) return { ok: false, error: "forbidden" };

  return { ok: true, scheduled, assignment };
}

/**
 * Prevent a user from "completing" a locked item via direct action. The
 * timeline UI already filters locked items out of the interactive surface
 * but server actions must not trust the client.
 */
function isUnlocked(scheduled: JourneyScheduledItem, now = new Date()): boolean {
  const unlock = new Date(scheduled.unlock_at).getTime();
  if (!Number.isFinite(unlock)) return false;
  return unlock <= now.getTime();
}

function revalidateTimeline() {
  // Both locales and the item detail + timeline shell.
  revalidatePath("/[locale]/journey/timeline", "layout");
  revalidatePath("/[locale]/my/journey", "page");
}

// ============================================================
// Completions - mark / unmark
// ============================================================

/**
 * Mark a scheduled item as completed. Completion is per-couple (or
 * per-user for solo journeys) rather than per-author, so we use
 * scheduled_item_id as the PK and let whoever-moves-first record the
 * completed_by. If either partner already marked it, the call is a no-op.
 */
export async function markScheduledItemComplete(
  scheduledItemId: string,
): Promise<Ok<{ completed_at: string }> | Err> {
  if (!scheduledItemId) return { ok: false, error: "missing_id" };

  const viewer = await resolveViewer();
  if (!viewer.ok) return viewer;

  const scope = await loadScheduledForViewer({
    scheduledItemId,
    userId: viewer.userId,
    coupleIds: viewer.coupleIds,
  });
  if (!scope.ok) return scope;

  if (!isUnlocked(scope.scheduled)) {
    return { ok: false, error: "locked" };
  }

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("journey_item_completions")
    .upsert(
      {
        scheduled_item_id: scheduledItemId,
        completed_by: viewer.userId,
      },
      { onConflict: "scheduled_item_id", ignoreDuplicates: false },
    )
    .select("completed_at")
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity({
    userId: viewer.userId,
    coupleId: scope.assignment.couple_id ?? null,
    scheduledItemId: scheduledItemId,
    verb: "item_completed",
  });

  // Layer-4 milestone detection. Best-effort: failure here doesn't
  // fail the completion. The unique index on milestone rows means
  // re-runs are free. Only fires for couple-owned assignments —
  // solo journeys don't get milestone reveals in this layer.
  if (scope.assignment.couple_id) {
    try {
      const { checkAndAwardMilestones } = await import(
        "@/lib/journey/milestones"
      );
      await checkAndAwardMilestones({
        coupleId: scope.assignment.couple_id,
      });
    } catch (err) {
      console.warn(
        "[markScheduledItemComplete] milestone check failed (non-fatal)",
        err,
      );
    }
  }

  revalidateTimeline();
  return {
    ok: true,
    completed_at: (data as { completed_at: string }).completed_at,
  };
}

export async function unmarkScheduledItemComplete(
  scheduledItemId: string,
): Promise<OkUnit | Err> {
  if (!scheduledItemId) return { ok: false, error: "missing_id" };

  const viewer = await resolveViewer();
  if (!viewer.ok) return viewer;

  const scope = await loadScheduledForViewer({
    scheduledItemId,
    userId: viewer.userId,
    coupleIds: viewer.coupleIds,
  });
  if (!scope.ok) return scope;

  const admin = await createAdminClient();
  const { error } = await admin
    .from("journey_item_completions")
    .delete()
    .eq("scheduled_item_id", scheduledItemId);

  if (error) return { ok: false, error: error.message };

  await logActivity({
    userId: viewer.userId,
    coupleId: scope.assignment.couple_id ?? null,
    scheduledItemId,
    verb: "item_uncompleted",
  });

  revalidateTimeline();
  return { ok: true };
}

// ============================================================
// Responses - add / delete own
// ============================================================

const RESPONSE_MAX_LEN = 4000;

export async function addScheduledItemResponse(args: {
  scheduledItemId: string;
  text: string;
  isPrivate: boolean;
}): Promise<Ok<{ response: JourneyItemResponse }> | Err> {
  const { scheduledItemId } = args;
  if (!scheduledItemId) return { ok: false, error: "missing_id" };

  const trimmed = (args.text ?? "").trim();
  if (trimmed.length === 0) return { ok: false, error: "empty_text" };
  if (trimmed.length > RESPONSE_MAX_LEN) {
    return { ok: false, error: "text_too_long" };
  }

  const viewer = await resolveViewer();
  if (!viewer.ok) return viewer;

  const scope = await loadScheduledForViewer({
    scheduledItemId,
    userId: viewer.userId,
    coupleIds: viewer.coupleIds,
  });
  if (!scope.ok) return scope;

  // Responding to a locked item makes no sense in the UI, but we block it
  // server-side too - otherwise a curious client could seed answers before
  // the item unlocks, which would surprise the partner.
  if (!isUnlocked(scope.scheduled)) {
    return { ok: false, error: "locked" };
  }

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("journey_item_responses")
    .insert({
      scheduled_item_id: scheduledItemId,
      user_id: viewer.userId,
      response_text: trimmed,
      is_private: !!args.isPrivate,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  await logActivity({
    userId: viewer.userId,
    coupleId: scope.assignment.couple_id ?? null,
    scheduledItemId,
    verb: "response_posted",
    payload: { is_private: !!args.isPrivate },
  });

  revalidateTimeline();
  return { ok: true, response: data as JourneyItemResponse };
}

/**
 * Delete a response - only the author may delete. We don't expose an
 * edit path yet; users who want to change wording should delete + repost
 * so the feed keeps append-only semantics for the partner.
 */
export async function deleteScheduledItemResponse(
  responseId: string,
): Promise<OkUnit | Err> {
  if (!responseId) return { ok: false, error: "missing_id" };

  const viewer = await resolveViewer();
  if (!viewer.ok) return viewer;

  const admin = await createAdminClient();
  const { data: row, error: rErr } = await admin
    .from("journey_item_responses")
    .select("id, user_id, scheduled_item_id")
    .eq("id", responseId)
    .maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  if (!row) return { ok: false, error: "not_found" };

  const resp = row as Pick<
    JourneyItemResponse,
    "id" | "user_id" | "scheduled_item_id"
  >;
  if (resp.user_id !== viewer.userId) {
    return { ok: false, error: "forbidden" };
  }

  // Also sanity-check scope - if the user was removed from the couple
  // since they posted, we shouldn't let them touch the row anymore.
  const scope = await loadScheduledForViewer({
    scheduledItemId: resp.scheduled_item_id,
    userId: viewer.userId,
    coupleIds: viewer.coupleIds,
  });
  if (!scope.ok) return scope;

  const { error } = await admin
    .from("journey_item_responses")
    .delete()
    .eq("id", responseId);

  if (error) return { ok: false, error: error.message };

  await logActivity({
    userId: viewer.userId,
    coupleId: scope.assignment.couple_id ?? null,
    scheduledItemId: resp.scheduled_item_id,
    verb: "response_deleted",
  });

  revalidateTimeline();
  return { ok: true };
}
