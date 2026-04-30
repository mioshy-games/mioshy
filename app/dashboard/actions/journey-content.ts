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
  journeyItemSchema,
  type JourneyProgramFormValues,
  type JourneyCategoryFormValues,
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

export async function createAndRedirectNewItem(categoryId: string) {
  if (!categoryId) throw new Error("categoryId is required");
  const supabase = await adminDb();
  const slug = `new-item-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("journey_items")
    .insert({
      category_id: categoryId,
      slug,
      title_he: "פריט חדש",
      title_en: "New Item",
      body_he: "טיוטה — מלאו את התוכן ושמרו",
      sort_order: 0,
      default_offset_days: 0,
      is_active: false,
      audience: "both",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  redirect(`/dashboard/journey/items/${data.id}`);
}
