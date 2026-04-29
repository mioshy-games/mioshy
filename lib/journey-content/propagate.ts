// ============================================================
// Propagation planner for the Journey Content System.
//
// Body / title / media edits on journey_items propagate automatically —
// the timeline fetches content via a JOIN through scheduled_items.item_id,
// so nothing to plan. Structural changes are different:
//
//   1. Add an item to a category → existing assignments that reference
//      that category or its parent program don't yet have a
//      scheduled_items row for the new item. We have to INSERT into every
//      matching assignment (respecting its anchor_date).
//   2. Change an item's default_offset_days → existing scheduled rows
//      should have their unlock_at recomputed, unless
//      has_unlock_override is true (admin intentionally moved it).
//   3. Deactivate/delete an item → the timeline query filters by
//      journey_items.is_active, so deactivation is automatic. Deletion
//      CASCADES to scheduled_items via the FK.
//
// This module produces a *plan* (row counts + sample rows) for the admin
// confirm dialog, and a separate applier that executes the plan via the
// admin client. Plans are idempotent — running apply after a successful
// apply inserts zero rows thanks to the (assignment_id, item_id) unique
// index.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";
import type {
  JourneyAssignment,
  JourneyItem,
  JourneyScheduledItem,
} from "./types";
import { computeUnlockAt } from "./schedule";

// ------------------------------------------------------------
// Shared plan shape — the dialog renders whatever's in here
// ------------------------------------------------------------

export type PropagationKind =
  | "item_added"
  | "item_offset_changed"
  | "item_removed";

export interface PropagationAssignmentPreview {
  assignment_id: string;
  user_id: string | null;
  couple_id: string | null;
  /** What will change for THIS assignment — currently "insert" or "update". */
  change: "insert" | "update" | "delete";
  /** Resolved unlock_at for the preview row. */
  unlock_at: string;
  /** Whether this row will be skipped because of an admin override. */
  skipped_override?: boolean;
}

export interface PropagationPlan {
  kind: PropagationKind;
  itemId: string;
  summary: {
    affected_assignments: number;
    rows_to_insert: number;
    rows_to_update: number;
    rows_to_delete: number;
    rows_skipped_override: number;
  };
  /** Up to 50 rows for the preview list — never the full set. */
  preview: PropagationAssignmentPreview[];
}

function emptyPlan(kind: PropagationKind, itemId: string): PropagationPlan {
  return {
    kind,
    itemId,
    summary: {
      affected_assignments: 0,
      rows_to_insert: 0,
      rows_to_update: 0,
      rows_to_delete: 0,
      rows_skipped_override: 0,
    },
    preview: [],
  };
}

const PREVIEW_LIMIT = 50;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

async function assignmentsThatReferenceItem(
  supabase: SupabaseClient,
  item: Pick<JourneyItem, "id" | "category_id">,
): Promise<JourneyAssignment[]> {
  // An assignment can target the item itself, its category, or its
  // category's program. Gather the candidate source_ids once and do a
  // single IN() query so we don't fan out.
  const sourceIds: string[] = [item.id, item.category_id];

  const { data: catRow, error: catErr } = await supabase
    .from("journey_categories")
    .select("program_id")
    .eq("id", item.category_id)
    .maybeSingle();
  if (catErr) throw new Error(catErr.message);
  const programId = (catRow as { program_id: string | null } | null)?.program_id;
  if (programId) sourceIds.push(programId);

  const { data, error } = await supabase
    .from("journey_assignments")
    .select("*")
    .eq("is_active", true)
    .in("source_id", sourceIds);
  if (error) throw new Error(error.message);

  // Narrow by source_kind so a program_id never accidentally matches an
  // assignment whose source_kind is 'item' but whose source_id happens to
  // equal the program uuid (would require uuid collision — paranoid).
  return ((data ?? []) as JourneyAssignment[]).filter((a) => {
    if (a.source_kind === "item") return a.source_id === item.id;
    if (a.source_kind === "category") return a.source_id === item.category_id;
    if (a.source_kind === "program") return a.source_id === programId;
    return false;
  });
}

// ------------------------------------------------------------
// Plans
// ------------------------------------------------------------

/**
 * Plan: a new item was added to a category. Figure out which active
 * assignments reference that category (directly or via its program) and
 * don't yet have a scheduled_items row for this item.
 */
export async function planPropagateItemAdded(args: {
  item: JourneyItem;
  supabase?: SupabaseClient;
}): Promise<PropagationPlan> {
  const supabase = args.supabase ?? (await createAdminClient());
  const plan = emptyPlan("item_added", args.item.id);

  const assignments = await assignmentsThatReferenceItem(supabase, args.item);
  if (assignments.length === 0) return plan;

  const assignmentIds = assignments.map((a) => a.id);

  // Which of these already have a scheduled_items row for this item?
  const { data: existing, error: eErr } = await supabase
    .from("journey_scheduled_items")
    .select("assignment_id")
    .eq("item_id", args.item.id)
    .in("assignment_id", assignmentIds);
  if (eErr) throw new Error(eErr.message);
  const alreadyHas = new Set(
    ((existing ?? []) as { assignment_id: string }[]).map(
      (r) => r.assignment_id,
    ),
  );

  for (const a of assignments) {
    if (alreadyHas.has(a.id)) continue;
    plan.summary.affected_assignments += 1;
    plan.summary.rows_to_insert += 1;
    if (plan.preview.length < PREVIEW_LIMIT) {
      plan.preview.push({
        assignment_id: a.id,
        user_id: a.user_id,
        couple_id: a.couple_id,
        change: "insert",
        unlock_at: computeUnlockAt(a.anchor_date, args.item.default_offset_days),
      });
    }
  }
  return plan;
}

/**
 * Plan: an item's default_offset_days changed. Recompute unlock_at for
 * every scheduled row pointing at this item except those with
 * has_unlock_override = true.
 */
export async function planPropagateItemOffsetChanged(args: {
  itemId: string;
  newOffsetDays: number;
  supabase?: SupabaseClient;
}): Promise<PropagationPlan> {
  const supabase = args.supabase ?? (await createAdminClient());
  const plan = emptyPlan("item_offset_changed", args.itemId);

  const { data: rows, error } = await supabase
    .from("journey_scheduled_items")
    .select("id, assignment_id, has_unlock_override")
    .eq("item_id", args.itemId);
  if (error) throw new Error(error.message);
  const scheduled = (rows ?? []) as Pick<
    JourneyScheduledItem,
    "id" | "assignment_id" | "has_unlock_override"
  >[];
  if (scheduled.length === 0) return plan;

  const assignmentIds = Array.from(
    new Set(scheduled.map((s) => s.assignment_id)),
  );
  const { data: aRows, error: aErr } = await supabase
    .from("journey_assignments")
    .select("id, user_id, couple_id, anchor_date")
    .in("id", assignmentIds);
  if (aErr) throw new Error(aErr.message);
  const assignmentsById = new Map(
    ((aRows ?? []) as Pick<
      JourneyAssignment,
      "id" | "user_id" | "couple_id" | "anchor_date"
    >[]).map((a) => [a.id, a]),
  );

  for (const s of scheduled) {
    const a = assignmentsById.get(s.assignment_id);
    if (!a) continue;
    if (s.has_unlock_override) {
      plan.summary.rows_skipped_override += 1;
      continue;
    }
    plan.summary.affected_assignments += 1;
    plan.summary.rows_to_update += 1;
    if (plan.preview.length < PREVIEW_LIMIT) {
      plan.preview.push({
        assignment_id: a.id,
        user_id: a.user_id,
        couple_id: a.couple_id,
        change: "update",
        unlock_at: computeUnlockAt(a.anchor_date, args.newOffsetDays),
      });
    }
  }
  return plan;
}

/**
 * Plan: remove this item from every existing timeline. DELETE CASCADEs
 * through scheduled_items → completions → responses per the migration's
 * FK configuration, so the caller just needs to confirm the fallout.
 */
export async function planPropagateItemRemoved(args: {
  itemId: string;
  supabase?: SupabaseClient;
}): Promise<PropagationPlan> {
  const supabase = args.supabase ?? (await createAdminClient());
  const plan = emptyPlan("item_removed", args.itemId);

  const { data: rows, error } = await supabase
    .from("journey_scheduled_items")
    .select("id, assignment_id, unlock_at")
    .eq("item_id", args.itemId);
  if (error) throw new Error(error.message);
  const scheduled = (rows ?? []) as Pick<
    JourneyScheduledItem,
    "id" | "assignment_id" | "unlock_at"
  >[];
  if (scheduled.length === 0) return plan;

  const assignmentIds = Array.from(
    new Set(scheduled.map((s) => s.assignment_id)),
  );
  const { data: aRows, error: aErr } = await supabase
    .from("journey_assignments")
    .select("id, user_id, couple_id")
    .in("id", assignmentIds);
  if (aErr) throw new Error(aErr.message);
  const assignmentsById = new Map(
    ((aRows ?? []) as Pick<JourneyAssignment, "id" | "user_id" | "couple_id">[]).map(
      (a) => [a.id, a],
    ),
  );

  for (const s of scheduled) {
    const a = assignmentsById.get(s.assignment_id);
    if (!a) continue;
    plan.summary.affected_assignments += 1;
    plan.summary.rows_to_delete += 1;
    if (plan.preview.length < PREVIEW_LIMIT) {
      plan.preview.push({
        assignment_id: a.id,
        user_id: a.user_id,
        couple_id: a.couple_id,
        change: "delete",
        unlock_at: s.unlock_at,
      });
    }
  }
  return plan;
}

// ------------------------------------------------------------
// Appliers — execute the plan
// ------------------------------------------------------------

export async function applyPropagateItemAdded(args: {
  item: JourneyItem;
  supabase?: SupabaseClient;
}): Promise<{ inserted: number }> {
  const supabase = args.supabase ?? (await createAdminClient());
  const assignments = await assignmentsThatReferenceItem(supabase, args.item);
  if (assignments.length === 0) return { inserted: 0 };

  const assignmentIds = assignments.map((a) => a.id);
  const { data: existing } = await supabase
    .from("journey_scheduled_items")
    .select("assignment_id")
    .eq("item_id", args.item.id)
    .in("assignment_id", assignmentIds);
  const alreadyHas = new Set(
    ((existing ?? []) as { assignment_id: string }[]).map(
      (r) => r.assignment_id,
    ),
  );

  const rows = assignments
    .filter((a) => !alreadyHas.has(a.id))
    .map((a) => ({
      assignment_id: a.id,
      item_id: args.item.id,
      unlock_at: computeUnlockAt(a.anchor_date, args.item.default_offset_days),
      sort_order: args.item.sort_order,
      has_unlock_override: false,
      admin_notes: null,
    }));
  if (rows.length === 0) return { inserted: 0 };

  const { data: insertedRows, error } = await supabase
    .from("journey_scheduled_items")
    .upsert(rows, {
      onConflict: "assignment_id,item_id",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) throw new Error(error.message);
  return { inserted: (insertedRows ?? []).length };
}

export async function applyPropagateItemOffsetChanged(args: {
  itemId: string;
  newOffsetDays: number;
  supabase?: SupabaseClient;
}): Promise<{ updated: number; skipped_override: number }> {
  const supabase = args.supabase ?? (await createAdminClient());

  const { data: rows, error } = await supabase
    .from("journey_scheduled_items")
    .select("id, assignment_id, has_unlock_override")
    .eq("item_id", args.itemId);
  if (error) throw new Error(error.message);
  const scheduled = (rows ?? []) as Pick<
    JourneyScheduledItem,
    "id" | "assignment_id" | "has_unlock_override"
  >[];
  if (scheduled.length === 0) return { updated: 0, skipped_override: 0 };

  const eligible = scheduled.filter((s) => !s.has_unlock_override);
  const skipped = scheduled.length - eligible.length;
  if (eligible.length === 0) return { updated: 0, skipped_override: skipped };

  const assignmentIds = Array.from(new Set(eligible.map((s) => s.assignment_id)));
  const { data: aRows } = await supabase
    .from("journey_assignments")
    .select("id, anchor_date")
    .in("id", assignmentIds);
  const anchorById = new Map(
    ((aRows ?? []) as Pick<JourneyAssignment, "id" | "anchor_date">[]).map(
      (a) => [a.id, a.anchor_date],
    ),
  );

  // Group by desired unlock_at so we can do one UPDATE per bucket instead
  // of one per row. For most inputs this collapses to a single UPDATE.
  const buckets = new Map<string, string[]>();
  for (const s of eligible) {
    const anchor = anchorById.get(s.assignment_id);
    if (!anchor) continue;
    const newUnlock = computeUnlockAt(anchor, args.newOffsetDays);
    const ids = buckets.get(newUnlock) ?? [];
    ids.push(s.id);
    buckets.set(newUnlock, ids);
  }

  let updated = 0;
  for (const [newUnlock, ids] of Array.from(buckets.entries())) {
    const { data: updatedRows, error: uErr } = await supabase
      .from("journey_scheduled_items")
      .update({ unlock_at: newUnlock })
      .in("id", ids)
      .select("id");
    if (uErr) throw new Error(uErr.message);
    updated += (updatedRows ?? []).length;
  }
  return { updated, skipped_override: skipped };
}
