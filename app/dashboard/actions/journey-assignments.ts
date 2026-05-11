"use server";

// ============================================================
// Server actions for Journey Assignments (admin) - create / cancel /
// re-materialize, plus propagation plan+apply for catalog changes.
//
// All writes go through the admin client (service role) because the
// migration 035 RLS policies intentionally grant SELECT-only.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  journeyAssignmentSchema,
  type JourneyAssignmentFormValues,
} from "@/lib/journey-content/validations";
import { parseOwnerKey } from "@/lib/journey-content/owner";
import { resolveAnchorDate } from "@/lib/journey-content/schedule";
import {
  materializeAssignment,
  expandSourceToItems,
} from "@/lib/journey-content/materialize";
import {
  planPropagateItemAdded,
  planPropagateItemOffsetChanged,
  planPropagateItemRemoved,
  applyPropagateItemAdded,
  applyPropagateItemOffsetChanged,
  type PropagationPlan,
} from "@/lib/journey-content/propagate";
import type { JourneyAssignment, JourneyItem } from "@/lib/journey-content/types";

// ------------------------------------------------------------
// Shared result shape
// ------------------------------------------------------------

type Result<T = string> =
  | { ok: true; id: T; inserted?: number }
  | { ok: false; error: Record<string, string[] | undefined> };

async function adminDb() {
  await requireAdmin();
  return createAdminClient();
}

function revalidateJourney(ownerKey?: string) {
  revalidatePath("/dashboard/journey", "layout");
  if (ownerKey) {
    revalidatePath(`/dashboard/journey/clients/${ownerKey}`, "layout");
  }
  // User-facing paths pick up via /my route below.
  revalidatePath("/", "layout");
}

// ============================================================
// Assignments - create + materialize
// ============================================================

/**
 * Create an assignment and materialize its scheduled_items in one admin
 * action. The two inserts are NOT transactional at the DB level; if the
 * materializer throws, the assignment row is still there so a retry can
 * pick it up cleanly (the unique index on (assignment_id, item_id) makes
 * that retry idempotent).
 */
export async function createJourneyAssignment(
  raw: unknown,
): Promise<Result<string>> {
  const parsed = journeyAssignmentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const v: JourneyAssignmentFormValues = parsed.data;

  const owner = parseOwnerKey(v.owner_key);
  if (!owner) {
    return { ok: false, error: { owner_key: ["Invalid owner key"] } };
  }

  const supabase = await adminDb();

  // Resolve the anchor once on the server so the timeline and the admin
  // preview agree. 'purchase' origin is supported but the real anchor is
  // computed from the purchase hook - for manual admin creation we treat
  // it the same as 'assignment' if no date is supplied.
  const anchorDate = resolveAnchorDate({
    anchorKind: v.anchor_kind,
    fixedAt: v.anchor_date || null,
    purchaseAt: null,
  });

  const notes = v.notes.trim().length > 0 ? v.notes.trim() : null;
  const row = {
    user_id: owner.kind === "user" ? owner.userId : null,
    couple_id: owner.kind === "couple" ? owner.coupleId : null,
    source_kind: v.source_kind,
    source_id: v.source_id,
    anchor_kind: v.anchor_kind,
    anchor_date: anchorDate,
    origin: v.origin,
    origin_ref: null,
    notes,
    is_active: true,
  };

  const { data, error } = await supabase
    .from("journey_assignments")
    .insert(row)
    .select("*")
    .single();
  if (error || !data) {
    return {
      ok: false,
      error: { _root: [error?.message ?? "Insert failed"] },
    };
  }
  const assignment = data as JourneyAssignment;

  // Materialize - idempotent, so re-running on retry is safe.
  const { inserted } = await materializeAssignment({
    assignment,
    supabase,
    // Admin manual creation → user sees "hand-picked by your coach"
    // (see migration 066, slug 'manual_assignment').
    defaultRuleSlug: "manual_assignment",
  });

  revalidateJourney(v.owner_key);
  return { ok: true, id: assignment.id, inserted };
}

export async function cancelJourneyAssignment(assignmentId: string) {
  if (!assignmentId) return { ok: false as const, error: "missing assignmentId" };
  const supabase = await adminDb();
  const { error } = await supabase
    .from("journey_assignments")
    .update({ is_active: false })
    .eq("id", assignmentId);
  if (error) return { ok: false as const, error: error.message };
  revalidateJourney();
  return { ok: true as const };
}

export async function reactivateJourneyAssignment(assignmentId: string) {
  if (!assignmentId) return { ok: false as const, error: "missing assignmentId" };
  const supabase = await adminDb();
  const { error } = await supabase
    .from("journey_assignments")
    .update({ is_active: true })
    .eq("id", assignmentId);
  if (error) return { ok: false as const, error: error.message };
  revalidateJourney();
  return { ok: true as const };
}

export async function deleteJourneyAssignment(assignmentId: string) {
  if (!assignmentId) return { ok: false as const, error: "missing assignmentId" };
  const supabase = await adminDb();
  const { error } = await supabase
    .from("journey_assignments")
    .delete()
    .eq("id", assignmentId);
  if (error) return { ok: false as const, error: error.message };
  revalidateJourney();
  return { ok: true as const };
}

/**
 * Re-run the materializer for an existing assignment - useful when the
 * admin has added items to the source program/category after the
 * assignment was created. Safe to call repeatedly (upsert semantics).
 */
export async function rematerializeJourneyAssignment(assignmentId: string) {
  if (!assignmentId) {
    return { ok: false as const, error: "missing assignmentId" };
  }
  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("journey_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false as const, error: error?.message ?? "not found" };
  }

  const { inserted } = await materializeAssignment({
    assignment: data as JourneyAssignment,
    supabase,
    // Re-materialize re-attaches the same rule the original used. The
    // existing rows aren't touched (UPSERT with ignoreDuplicates), so
    // this only affects newly-added items in the source.
    defaultRuleSlug:
      (data as JourneyAssignment).origin === "purchase"
        ? "default_program_kickoff"
        : "manual_assignment",
  });
  revalidateJourney();
  return { ok: true as const, inserted };
}

/**
 * Preview what a new assignment would materialize *before* creating it.
 * Used by the admin bulk-assign confirm step.
 */
export async function previewJourneyAssignment(
  raw: unknown,
): Promise<
  | { ok: true; items_count: number; anchor_date: string }
  | { ok: false; error: Record<string, string[] | undefined> }
> {
  const parsed = journeyAssignmentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const v = parsed.data;
  const supabase = await adminDb();

  const items = await expandSourceToItems({
    supabase,
    sourceKind: v.source_kind,
    sourceId: v.source_id,
  });

  const anchor = resolveAnchorDate({
    anchorKind: v.anchor_kind,
    fixedAt: v.anchor_date || null,
  });
  return { ok: true, items_count: items.length, anchor_date: anchor };
}

// ============================================================
// Propagation - plan + apply (used by PropagateConfirmDialog)
// ============================================================

async function loadItem(itemId: string): Promise<JourneyItem> {
  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("journey_items")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "item not found");
  return data as JourneyItem;
}

export async function planPropagateItemAddedAction(
  itemId: string,
): Promise<PropagationPlan> {
  const item = await loadItem(itemId);
  return planPropagateItemAdded({ item });
}

export async function applyPropagateItemAddedAction(
  itemId: string,
): Promise<{ ok: true; inserted: number } | { ok: false; error: string }> {
  try {
    const item = await loadItem(itemId);
    const { inserted } = await applyPropagateItemAdded({ item });
    revalidateJourney();
    return { ok: true, inserted };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function planPropagateItemOffsetAction(
  itemId: string,
  newOffsetDays: number,
): Promise<PropagationPlan> {
  await requireAdmin();
  return planPropagateItemOffsetChanged({ itemId, newOffsetDays });
}

export async function applyPropagateItemOffsetAction(
  itemId: string,
  newOffsetDays: number,
): Promise<
  | { ok: true; updated: number; skipped_override: number }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    const res = await applyPropagateItemOffsetChanged({
      itemId,
      newOffsetDays,
    });
    revalidateJourney();
    return { ok: true, ...res };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function planPropagateItemRemovedAction(
  itemId: string,
): Promise<PropagationPlan> {
  await requireAdmin();
  return planPropagateItemRemoved({ itemId });
}

// ============================================================
// Bulk-assign helper - server-action redirect from the list page
// ============================================================

export async function createAndRedirectNewAssignment() {
  await requireAdmin();
  redirect("/dashboard/journey/assignments/new");
}
