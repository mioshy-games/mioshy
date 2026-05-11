"use server";

// ============================================================
// Server actions for Journey Content admin CRUD.
//
// Migration 035 installs SELECT-only RLS policies intentionally - writes
// MUST route through the admin/service-role client (see
// feedback: supabase-ssr-rls-pattern memory). Reads stay on the session
// client so we still enforce admin identity via requireAdmin().
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  journeyProgramSchema,
  journeyCategorySchema,
  journeySubtopicSchema,
  journeyItemSchema,
  type JourneyProgramFormValues,
  type JourneyCategoryFormValues,
  type JourneySubtopicFormValues,
  type JourneyItemFormValues,
} from "@/lib/journey-content/validations";

type Result<T = string> =
  | { ok: true; id: T }
  | { ok: false; error: Record<string, string[] | undefined> };

function normalizeOptional(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

async function adminDb() {
  // Identity check first (session), then service-role client for writes.
  await requireAdmin();
  return createAdminClient();
}

function revalidateJourney() {
  revalidatePath("/dashboard/journey", "layout");
  revalidatePath("/", "layout");
}

// ============================================================
// Programs
// ============================================================

export async function saveJourneyProgram(
  programId: string | null,
  raw: unknown,
): Promise<Result<string>> {
  const parsed = journeyProgramSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const v: JourneyProgramFormValues = parsed.data;
  const supabase = await adminDb();

  const row = {
    slug: v.slug,
    name_he: v.name_he,
    name_en: normalizeOptional(v.name_en),
    description_he: normalizeOptional(v.description_he),
    description_en: normalizeOptional(v.description_en),
    cover_image_url: normalizeOptional(v.cover_image_url),
    default_anchor: v.default_anchor,
    // Empty-string form sentinel → NULL so the partial unique index
    // (migration 036) only sees real slugs.
    product_slug: v.product_slug && v.product_slug.length > 0 ? v.product_slug : null,
    is_active: v.is_active,
    sort_weight: v.sort_weight,
  };

  let savedId = programId;
  if (programId) {
    const { error } = await supabase
      .from("journey_programs")
      .update(row)
      .eq("id", programId);
    if (error) return { ok: false, error: { _root: [error.message] } };
  } else {
    const { data, error } = await supabase
      .from("journey_programs")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: { _root: [error?.message ?? "Insert failed"] },
      };
    }
    savedId = data.id as string;
  }

  revalidateJourney();
  return { ok: true, id: savedId! };
}

export async function deleteJourneyProgram(programId: string) {
  if (!programId) return { ok: false as const, error: "missing programId" };
  const supabase = await adminDb();
  const { error } = await supabase
    .from("journey_programs")
    .delete()
    .eq("id", programId);
  if (error) return { ok: false as const, error: error.message };
  revalidateJourney();
  return { ok: true as const };
}

export async function createAndRedirectNewProgram() {
  const supabase = await adminDb();
  const slug = `new-program-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("journey_programs")
    .insert({
      slug,
      name_he: "מסלול חדש",
      name_en: "New Program",
      default_anchor: "assignment",
      is_active: false,
      sort_weight: 0,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  redirect(`/dashboard/journey/programs/${data.id}`);
}

// ============================================================
// Categories
// ============================================================

export async function saveJourneyCategory(
  categoryId: string | null,
  raw: unknown,
): Promise<Result<string>> {
  console.log("[saveJourneyCategory] called", { categoryId, raw });
  const parsed = journeyCategorySchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors as Record<
      string,
      string[] | undefined
    >;
    console.warn("[saveJourneyCategory] zod validation failed", errors);
    return { ok: false, error: errors };
  }
  const v: JourneyCategoryFormValues = parsed.data;
  const supabase = await adminDb();

  const row = {
    program_id: v.program_id ?? null,
    slug: v.slug,
    name_he: v.name_he,
    name_en: normalizeOptional(v.name_en),
    description_he: normalizeOptional(v.description_he),
    description_en: normalizeOptional(v.description_en),
    sort_order: v.sort_order,
    is_active: v.is_active,
  };

  let savedId = categoryId;
  if (categoryId) {
    const { error } = await supabase
      .from("journey_categories")
      .update(row)
      .eq("id", categoryId);
    if (error) {
      console.error("[saveJourneyCategory] update failed", error);
      return { ok: false, error: { _root: [error.message] } };
    }
  } else {
    const { data, error } = await supabase
      .from("journey_categories")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      console.error("[saveJourneyCategory] insert failed", error);
      return {
        ok: false,
        error: { _root: [error?.message ?? "Insert failed"] },
      };
    }
    savedId = data.id as string;
  }

  console.log("[saveJourneyCategory] saved OK", { id: savedId });
  revalidateJourney();
  return { ok: true, id: savedId! };
}

export async function deleteJourneyCategory(categoryId: string) {
  if (!categoryId) return { ok: false as const, error: "missing categoryId" };
  const supabase = await adminDb();
  const { error } = await supabase
    .from("journey_categories")
    .delete()
    .eq("id", categoryId);
  if (error) return { ok: false as const, error: error.message };
  revalidateJourney();
  return { ok: true as const };
}

export async function createAndRedirectNewCategory(programId?: string | null) {
  const supabase = await adminDb();
  const slug = `new-category-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("journey_categories")
    .insert({
      program_id: programId ?? null,
      slug,
      name_he: "קטגוריה חדשה",
      name_en: "New Category",
      sort_order: 0,
      is_active: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  redirect(`/dashboard/journey/categories/${data.id}`);
}

// ============================================================
// Subtopics (v3 slice 2)
// ============================================================

export async function saveJourneySubtopic(
  subtopicId: string | null,
  raw: unknown,
): Promise<Result<string>> {
  const parsed = journeySubtopicSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const v: JourneySubtopicFormValues = parsed.data;
  const supabase = await adminDb();

  const row = {
    category_id: v.category_id,
    slug: v.slug,
    name_he: v.name_he,
    name_en: normalizeOptional(v.name_en),
    description_he: normalizeOptional(v.description_he),
    description_en: normalizeOptional(v.description_en),
    sort_order: v.sort_order,
    is_active: v.is_active,
  };

  let savedId = subtopicId;
  if (subtopicId) {
    const { error } = await supabase
      .from("journey_subtopics")
      .update(row)
      .eq("id", subtopicId);
    if (error) return { ok: false, error: { _root: [error.message] } };
  } else {
    const { data, error } = await supabase
      .from("journey_subtopics")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: { _root: [error?.message ?? "Insert failed"] },
      };
    }
    savedId = data.id as string;
  }
  revalidateJourney();
  return { ok: true, id: savedId! };
}

export async function deleteJourneySubtopic(subtopicId: string) {
  if (!subtopicId) return { ok: false as const, error: "missing subtopicId" };
  const supabase = await adminDb();
  const { error } = await supabase
    .from("journey_subtopics")
    .delete()
    .eq("id", subtopicId);
  if (error) return { ok: false as const, error: error.message };
  revalidateJourney();
  return { ok: true as const };
}

export async function createAndRedirectNewSubtopic(categoryId: string) {
  if (!categoryId) throw new Error("categoryId is required");
  const supabase = await adminDb();
  // New subtopics go to the end of the list - pick max(sort_order) + 1000.
  const { data: maxRow } = await supabase
    .from("journey_subtopics")
    .select("sort_order")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRow?.sort_order as number | undefined) ?? 0) + 1000;
  const slug = `new-subtopic-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("journey_subtopics")
    .insert({
      category_id: categoryId,
      slug,
      name_he: "תת-נושא חדש",
      name_en: "New Subtopic",
      sort_order: nextOrder,
      is_active: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  redirect(`/dashboard/journey/categories/${categoryId}/subtopics/${data.id}`);
}

// ============================================================
// Reorder (v3 slice 2)
// ------------------------------------------------------------
// Sparse sort_order: we rewrite EVERY row in the parent list to
// multiples of 1000 on each drag. Caller passes the full ordered list
// of child IDs; the action validates that exactly those children
// belong to the parent (no missing, no extras), then issues per-row
// updates via the service-role client. Atomicity isn't critical since
// any partial state still represents a valid total ordering - re-
// triggering the reorder fixes drift.
// ============================================================

export type ReorderChildKind = "subtopic" | "item";

export async function reorderJourneyChildren(input: {
  parentKind: "category" | "subtopic";
  parentId: string;
  childKind: ReorderChildKind;
  /** Items inside a category that have NO subtopic (subtopic_id IS NULL).
   *  Only meaningful when parentKind='category' and childKind='item'. */
  scope?: "direct" | "all";
  orderedIds: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.parentId) return { ok: false, error: "missing parentId" };
  if (!Array.isArray(input.orderedIds) || input.orderedIds.length === 0) {
    return { ok: false, error: "orderedIds is empty" };
  }
  const supabase = await adminDb();

  // Resolve the table + parent column we're updating.
  let table: string;
  let parentColumn: string;
  let extraFilter: { column: string; value: string | null } | null = null;
  if (input.childKind === "subtopic") {
    if (input.parentKind !== "category") {
      return { ok: false, error: "subtopics live under categories only" };
    }
    table = "journey_subtopics";
    parentColumn = "category_id";
  } else {
    table = "journey_items";
    if (input.parentKind === "subtopic") {
      parentColumn = "subtopic_id";
    } else {
      // parentKind === 'category'
      parentColumn = "category_id";
      // Items in a category split into "direct" (no subtopic) and "all".
      // The category-detail page reorders the direct group; subtopic
      // detail pages reorder by subtopic_id. Default 'direct'.
      if ((input.scope ?? "direct") === "direct") {
        extraFilter = { column: "subtopic_id", value: null };
      }
    }
  }

  // Validate ownership: every orderedId must currently belong to the
  // parent (and match the extra filter, if any). Reject otherwise so a
  // stale UI can't accidentally reparent rows.
  let q = supabase
    .from(table)
    .select("id")
    .eq(parentColumn, input.parentId);
  if (extraFilter) {
    q =
      extraFilter.value === null
        ? q.is(extraFilter.column, null)
        : q.eq(extraFilter.column, extraFilter.value);
  }
  const { data: existing, error: readErr } = await q;
  if (readErr) return { ok: false, error: readErr.message };
  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  for (const id of input.orderedIds) {
    if (!existingIds.has(id)) {
      return {
        ok: false,
        error: `child ${id} does not belong to ${input.parentKind} ${input.parentId}`,
      };
    }
  }
  if (input.orderedIds.length !== existingIds.size) {
    return {
      ok: false,
      error: `orderedIds length ${input.orderedIds.length} differs from current children count ${existingIds.size}`,
    };
  }

  // Rewrite every child to a multiple-of-1000 sort_order in the new
  // order. Sparse spacing leaves room for in-place inserts later if we
  // ever support delta-only reorders.
  const STEP = 1000;
  const updates = input.orderedIds.map((id, idx) => ({
    id,
    sort_order: (idx + 1) * STEP,
  }));

  for (const u of updates) {
    const { error } = await supabase
      .from(table)
      .update({ sort_order: u.sort_order })
      .eq("id", u.id);
    if (error) {
      console.error("[reorderJourneyChildren] update failed", {
        table,
        id: u.id,
        error,
      });
      return { ok: false, error: error.message };
    }
  }

  revalidateJourney();
  return { ok: true };
}

// ============================================================
// Items
// ============================================================

export async function saveJourneyItem(
  itemId: string | null,
  raw: unknown,
): Promise<Result<string>> {
  console.log("[saveJourneyItem] called", { itemId, raw });
  const parsed = journeyItemSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors as Record<
      string,
      string[] | undefined
    >;
    console.warn("[saveJourneyItem] zod validation failed", errors);
    return { ok: false, error: errors };
  }
  const v: JourneyItemFormValues = parsed.data;
  const supabase = await adminDb();

  const row = {
    category_id: v.category_id,
    // Empty-string sentinel from the form → NULL (item hangs directly
    // off the category). The DB trigger journey_items_subtopic_consistency
    // will reject any subtopic that doesn't belong to category_id.
    subtopic_id: v.subtopic_id && v.subtopic_id.length > 0 ? v.subtopic_id : null,
    slug: v.slug,
    title_he: v.title_he,
    title_en: normalizeOptional(v.title_en),
    body_he: v.body_he,
    body_en: normalizeOptional(v.body_en),
    task_he: normalizeOptional(v.task_he),
    task_en: normalizeOptional(v.task_en),
    challenge_he: normalizeOptional(v.challenge_he),
    challenge_en: normalizeOptional(v.challenge_en),
    video_url: normalizeOptional(v.video_url),
    image_url: normalizeOptional(v.image_url),
    sort_order: v.sort_order,
    default_offset_days: v.default_offset_days,
    is_active: v.is_active,
    audience: v.audience,

    // Lesson blocks (migration 077). 0 / empty string sentinels → NULL.
    stage: v.stage > 0 ? v.stage : null,
    source_attribution_he: normalizeOptional(v.source_attribution_he),
    source_attribution_en: normalizeOptional(v.source_attribution_en),
    expert_insight_he: normalizeOptional(v.expert_insight_he),
    expert_insight_en: normalizeOptional(v.expert_insight_en),
    common_mistakes_he: normalizeOptional(v.common_mistakes_he),
    common_mistakes_en: normalizeOptional(v.common_mistakes_en),
    metaphor_he: normalizeOptional(v.metaphor_he),
    metaphor_en: normalizeOptional(v.metaphor_en),
    measurement_he: normalizeOptional(v.measurement_he),
    measurement_en: normalizeOptional(v.measurement_en),
    do_this_week_he: normalizeOptional(v.do_this_week_he),
    do_this_week_en: normalizeOptional(v.do_this_week_en),
    dont_this_week_he: normalizeOptional(v.dont_this_week_he),
    dont_this_week_en: normalizeOptional(v.dont_this_week_en),
    progress_marker_he: normalizeOptional(v.progress_marker_he),
    progress_marker_en: normalizeOptional(v.progress_marker_en),
  };

  let savedId = itemId;
  if (itemId) {
    const { error } = await supabase
      .from("journey_items")
      .update(row)
      .eq("id", itemId);
    if (error) {
      console.error("[saveJourneyItem] update failed", error);
      return { ok: false, error: { _root: [error.message] } };
    }
  } else {
    const { data, error } = await supabase
      .from("journey_items")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      console.error("[saveJourneyItem] insert failed", error);
      return {
        ok: false,
        error: { _root: [error?.message ?? "Insert failed"] },
      };
    }
    savedId = data.id as string;
  }

  console.log("[saveJourneyItem] saved OK", { id: savedId });
  revalidateJourney();
  return { ok: true, id: savedId! };
}

export async function deleteJourneyItem(itemId: string) {
  if (!itemId) return { ok: false as const, error: "missing itemId" };
  const supabase = await adminDb();
  const { error } = await supabase
    .from("journey_items")
    .delete()
    .eq("id", itemId);
  if (error) return { ok: false as const, error: error.message };
  revalidateJourney();
  return { ok: true as const };
}

export async function createAndRedirectNewItem(
  categoryId: string,
  subtopicId?: string | null,
) {
  if (!categoryId) throw new Error("categoryId is required");
  const supabase = await adminDb();

  // If subtopicId is provided, validate it belongs to this category before
  // we hand it off to the trigger (better error message than the SQL
  // raise from journey_items_subtopic_consistency).
  if (subtopicId) {
    const { data: sub } = await supabase
      .from("journey_subtopics")
      .select("category_id")
      .eq("id", subtopicId)
      .maybeSingle();
    if (!sub || sub.category_id !== categoryId) {
      throw new Error(
        "subtopicId does not belong to the given category",
      );
    }
  }

  // Sparse sort_order: place at end of the appropriate list (direct or
  // inside the subtopic) by reading current max + 1000.
  let maxQuery = supabase
    .from("journey_items")
    .select("sort_order")
    .eq("category_id", categoryId);
  if (subtopicId) {
    maxQuery = maxQuery.eq("subtopic_id", subtopicId);
  } else {
    maxQuery = maxQuery.is("subtopic_id", null);
  }
  const { data: maxRow } = await maxQuery
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRow?.sort_order as number | undefined) ?? 0) + 1000;

  const slug = `new-item-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("journey_items")
    .insert({
      category_id: categoryId,
      subtopic_id: subtopicId ?? null,
      slug,
      title_he: "פריט חדש",
      title_en: "New Item",
      body_he: "טיוטה - מלאו את התוכן ושמרו",
      sort_order: nextOrder,
      default_offset_days: 0,
      is_active: false,
      audience: "both",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  redirect(`/dashboard/journey/items/${data.id}`);
}
