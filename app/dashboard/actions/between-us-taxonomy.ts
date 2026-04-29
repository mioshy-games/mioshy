"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  experienceGameCategorySchema,
  experienceGameTagSchema,
  type ExperienceGameCategoryFormValues,
  type ExperienceGameTagFormValues,
} from "@/lib/between-us/validations";

type TaxonomyResult<T extends string> =
  | { ok: true; id: T }
  | { ok: false; error: Record<string, string[] | undefined> };

// ============================================================
// Categories
// ============================================================
export async function saveCategory(
  categoryId: string | null,
  raw: unknown,
): Promise<TaxonomyResult<string>> {
  const parsed = experienceGameCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const v: ExperienceGameCategoryFormValues = parsed.data;
  const { supabase } = await requireAdmin();

  const row = {
    slug: v.slug,
    name_he: v.name_he,
    name_en: v.name_en,
    description_he: v.description_he,
    description_en: v.description_en,
    icon_url: v.icon_url || null,
    color_hex: v.color_hex || null,
    sort_weight: v.sort_weight,
    is_active: v.is_active,
  };

  let savedId = categoryId;
  if (categoryId) {
    const { error } = await supabase
      .from("experience_game_categories")
      .update(row)
      .eq("id", categoryId);
    if (error) return { ok: false, error: { _root: [error.message] } };
  } else {
    const { data, error } = await supabase
      .from("experience_game_categories")
      .insert(row)
      .select("id")
      .single();
    if (error || !data)
      return {
        ok: false,
        error: { _root: [error?.message ?? "Insert failed"] },
      };
    savedId = data.id as string;
  }

  revalidatePath("/dashboard/adults", "layout");
  revalidatePath("/", "layout");
  return { ok: true, id: savedId! };
}

export async function deleteCategory(categoryId: string) {
  if (!categoryId) return { ok: false as const, error: "missing categoryId" };
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("experience_game_categories")
    .delete()
    .eq("id", categoryId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/adults/categories");
  revalidatePath("/dashboard/adults");
  return { ok: true as const };
}

export async function createAndRedirectNewCategory() {
  const { supabase } = await requireAdmin();
  const slug = `new-category-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("experience_game_categories")
    .insert({
      slug,
      name_he: "קטגוריה חדשה",
      name_en: "New Category",
      description_he: "",
      description_en: "",
      sort_weight: 0,
      is_active: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  redirect(`/dashboard/adults/categories/${data.id}/edit`);
}

// ============================================================
// Tags
// ============================================================
export async function saveTag(
  tagId: string | null,
  raw: unknown,
): Promise<TaxonomyResult<string>> {
  const parsed = experienceGameTagSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const v: ExperienceGameTagFormValues = parsed.data;
  const { supabase } = await requireAdmin();

  const row = {
    slug: v.slug,
    name_he: v.name_he,
    name_en: v.name_en,
    color_hex: v.color_hex || null,
    is_active: v.is_active,
  };

  let savedId = tagId;
  if (tagId) {
    const { error } = await supabase
      .from("experience_game_tags")
      .update(row)
      .eq("id", tagId);
    if (error) return { ok: false, error: { _root: [error.message] } };
  } else {
    const { data, error } = await supabase
      .from("experience_game_tags")
      .insert(row)
      .select("id")
      .single();
    if (error || !data)
      return {
        ok: false,
        error: { _root: [error?.message ?? "Insert failed"] },
      };
    savedId = data.id as string;
  }

  revalidatePath("/dashboard/adults", "layout");
  revalidatePath("/", "layout");
  return { ok: true, id: savedId! };
}

export async function deleteTag(tagId: string) {
  if (!tagId) return { ok: false as const, error: "missing tagId" };
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("experience_game_tags")
    .delete()
    .eq("id", tagId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/adults/tags");
  revalidatePath("/dashboard/adults");
  return { ok: true as const };
}

export async function createAndRedirectNewTag() {
  const { supabase } = await requireAdmin();
  const slug = `new-tag-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("experience_game_tags")
    .insert({
      slug,
      name_he: "תגית חדשה",
      name_en: "New Tag",
      is_active: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  redirect(`/dashboard/adults/tags/${data.id}/edit`);
}
