// ============================================================
// Materializer for the Journey Content System.
//
// When an assignment is created, its source (program / category / item)
// is expanded into a concrete set of scheduled_items rows, each with its
// own unlock_at computed from the anchor_date + item.default_offset_days.
//
// The scheduled_items rows are pure FKs - they never copy item content,
// so future edits to journey_items propagate automatically via JOIN.
// See migration 035 and the Phase 2 smoke test.
//
// This module is split into:
//   1. A pure planner (planMaterializeAssignment) that builds the row
//      shapes from plain inputs - testable without a DB.
//   2. An applier (materializeAssignment) that takes an assignment id,
//      resolves the catalog side via the admin client, and bulk-inserts.
//      Returns the inserted ids for revalidation or follow-up navigation.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";
import type {
  AssignmentSourceKind,
  JourneyAssignment,
  JourneyCategory,
  JourneyItem,
} from "./types";
import { computeUnlockAt } from "./schedule";

// ------------------------------------------------------------
// Pure planner
// ------------------------------------------------------------

export interface PlannedScheduledRow {
  /** Not yet persisted - the applier fills this in from the INSERT response. */
  id?: string;
  assignment_id: string;
  item_id: string;
  unlock_at: string;
  sort_order: number;
  has_unlock_override: false;
  admin_notes: null;
  /** Copied from journey_items.audience at materialization time so per-item
   * tweaks AFTER materialization don't silently re-route who sees what. The
   * expert can override this row by editing the per-couple CSV. */
  audience: "both" | "owner" | "partner";
}

export interface PlanMaterializeInput {
  assignmentId: string;
  anchorDate: string;
  /** Only the fields we actually need for planning. */
  items: Pick<
    JourneyItem,
    "id" | "default_offset_days" | "sort_order" | "audience"
  >[];
}

/**
 * Build the scheduled_items rows for an assignment without hitting the DB.
 * Kept pure so the admin preview ("this will materialize N rows") and the
 * insert path share the same arithmetic.
 */
export function planMaterializeAssignment(
  input: PlanMaterializeInput,
): PlannedScheduledRow[] {
  return input.items.map((item) => ({
    assignment_id: input.assignmentId,
    item_id: item.id,
    unlock_at: computeUnlockAt(input.anchorDate, item.default_offset_days),
    sort_order: item.sort_order,
    has_unlock_override: false as const,
    admin_notes: null,
    audience: item.audience ?? "both",
  }));
}

// ------------------------------------------------------------
// Catalog expansion
// ------------------------------------------------------------

/**
 * Resolve a source (program|category|item) into the concrete list of
 * active items that should be materialized. Admin-client ignores RLS so
 * inactive content is excluded here explicitly - we never pipe draft
 * content into a user's timeline.
 */
export async function expandSourceToItems(args: {
  supabase: SupabaseClient;
  sourceKind: AssignmentSourceKind;
  sourceId: string;
}): Promise<JourneyItem[]> {
  const { supabase, sourceKind, sourceId } = args;

  if (sourceKind === "item") {
    const { data, error } = await supabase
      .from("journey_items")
      .select("*")
      .eq("id", sourceId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? [data as JourneyItem] : [];
  }

  if (sourceKind === "category") {
    const { data, error } = await supabase
      .from("journey_items")
      .select("*")
      .eq("category_id", sourceId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as JourneyItem[];
  }

  // program - find all active categories, then their active items
  const { data: categories, error: cErr } = await supabase
    .from("journey_categories")
    .select("id")
    .eq("program_id", sourceId)
    .eq("is_active", true);
  if (cErr) throw new Error(cErr.message);
  const categoryIds = ((categories ?? []) as Pick<JourneyCategory, "id">[]).map(
    (c) => c.id,
  );
  if (categoryIds.length === 0) return [];

  const { data: items, error: iErr } = await supabase
    .from("journey_items")
    .select("*")
    .in("category_id", categoryIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (iErr) throw new Error(iErr.message);
  return (items ?? []) as JourneyItem[];
}

// ------------------------------------------------------------
// Applier
// ------------------------------------------------------------

export interface MaterializeResult {
  /** Number of rows inserted. */
  inserted: number;
  /** The assignment we materialized against. */
  assignmentId: string;
  /** The items that expanded from the source (for preview/logging). */
  items: JourneyItem[];
}

/**
 * Materialize one assignment - idempotent by composite PK
 * (assignment_id, item_id) which was declared in migration 035. If the
 * scheduled rows already exist, we skip them silently instead of erroring.
 */
export async function materializeAssignment(args: {
  assignment: JourneyAssignment;
  supabase?: SupabaseClient;
}): Promise<MaterializeResult> {
  const supabase = args.supabase ?? (await createAdminClient());
  const { assignment } = args;

  const items = await expandSourceToItems({
    supabase,
    sourceKind: assignment.source_kind,
    sourceId: assignment.source_id,
  });

  if (items.length === 0) {
    return { inserted: 0, assignmentId: assignment.id, items: [] };
  }

  const rows = planMaterializeAssignment({
    assignmentId: assignment.id,
    anchorDate: assignment.anchor_date,
    items: items.map((i) => ({
      id: i.id,
      default_offset_days: i.default_offset_days,
      sort_order: i.sort_order,
      audience: i.audience,
    })),
  });

  // Upsert on (assignment_id, item_id) - the table's PK. ignoreDuplicates
  // keeps subsequent "re-materialize" clicks safe; callers that want to
  // actually recompute unlock_at should use the propagation planner instead.
  const { data: inserted, error } = await supabase
    .from("journey_scheduled_items")
    .upsert(rows, {
      onConflict: "assignment_id,item_id",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) throw new Error(error.message);

  return {
    inserted: (inserted ?? []).length,
    assignmentId: assignment.id,
    items,
  };
}
