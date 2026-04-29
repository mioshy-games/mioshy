"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  promotionSchema,
  type PromotionFormValues,
} from "@/lib/between-us/validations";

type PromotionResult<T extends string> =
  | { ok: true; id: T }
  | { ok: false; error: Record<string, string[] | undefined> };

export async function savePromotion(
  promotionId: string | null,
  raw: unknown,
): Promise<PromotionResult<string>> {
  const parsed = promotionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const v: PromotionFormValues = parsed.data;
  const { supabase } = await requireAdmin();

  const row = {
    code: v.code?.trim() ? v.code.trim() : null,
    name_he: v.name_he,
    name_en: v.name_en,
    description_he: v.description_he,
    description_en: v.description_en,
    type: v.type,
    buy_qty: v.buy_qty,
    get_qty: v.get_qty,
    max_tiers: v.max_tiers,
    is_active: v.is_active,
    starts_at: v.starts_at || null,
    ends_at: v.ends_at || null,
    applies_to_scope: v.applies_to_scope,
    stacking_allowed: v.stacking_allowed,
  };

  let savedId = promotionId;
  if (promotionId) {
    const { error } = await supabase
      .from("promotions")
      .update(row)
      .eq("id", promotionId);
    if (error) return { ok: false, error: { _root: [error.message] } };
  } else {
    const { data, error } = await supabase
      .from("promotions")
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

  revalidatePath("/dashboard/adults/promotions");
  revalidatePath("/dashboard/adults");
  revalidatePath("/", "layout");
  return { ok: true, id: savedId! };
}

export async function deletePromotion(promotionId: string) {
  if (!promotionId) return { ok: false as const, error: "missing promotionId" };
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("promotions")
    .delete()
    .eq("id", promotionId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/adults/promotions");
  return { ok: true as const };
}

export async function togglePromotionActive(
  promotionId: string,
  value: boolean,
) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("promotions")
    .update({ is_active: value })
    .eq("id", promotionId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/adults/promotions");
  return { ok: true as const };
}

export async function createAndRedirectNewPromotion() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("promotions")
    .insert({
      code: null,
      name_he: "מבצע חדש",
      name_en: "New promotion",
      description_he: "",
      description_en: "",
      type: "buy_x_get_y",
      buy_qty: 1,
      get_qty: 1,
      max_tiers: 2,
      is_active: false,
      applies_to_scope: "between_us",
      stacking_allowed: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  redirect(`/dashboard/adults/promotions/${data.id}/edit`);
}
