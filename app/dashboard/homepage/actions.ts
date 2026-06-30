"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import type { HomepageSettingsPayload } from "./constants";

function nullIfEmpty(v: string | null | undefined): string | null {
  if (!v || v.trim() === "") return null;
  return v.trim();
}

export async function saveHomepageSettings(payload: HomepageSettingsPayload) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("site_settings")
    .update({
      home_hero_bg_type: payload.home_hero_bg_type,
      home_hero_bg_value: payload.home_hero_bg_value || "default",
      expert_photo_url: nullIfEmpty(payload.expert_photo_url),

      home_article_img_0: nullIfEmpty(payload.home_article_img_0),
      home_article_img_1: nullIfEmpty(payload.home_article_img_1),
      home_article_img_2: nullIfEmpty(payload.home_article_img_2),

      hero_headline_he: nullIfEmpty(payload.hero_headline_he),
      hero_headline_en: nullIfEmpty(payload.hero_headline_en),
      hero_sub_he: nullIfEmpty(payload.hero_sub_he),
      hero_sub_en: nullIfEmpty(payload.hero_sub_en),

      cta_primary_text_he: nullIfEmpty(payload.cta_primary_text_he),
      cta_primary_text_en: nullIfEmpty(payload.cta_primary_text_en),
      cta_primary_href: payload.cta_primary_href || "/games/truth-or-dare",
      cta_primary_style: payload.cta_primary_style || "gradient",

      cta_secondary_text_he: nullIfEmpty(payload.cta_secondary_text_he),
      cta_secondary_text_en: nullIfEmpty(payload.cta_secondary_text_en),
      cta_secondary_href: payload.cta_secondary_href || "#games",

      social_proof_couples_count: Number(payload.social_proof_couples_count) || 0,
      rating_value: Number(payload.rating_value) || 4.9,
      rating_count: Number(payload.rating_count) || 0,

      hero_template:
        payload.hero_template === "light-gradient" ? "light-gradient" : "classic-dark",
      hero_side_image_url: nullIfEmpty(payload.hero_side_image_url),
    })
    .eq("id", 1);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/en");
  revalidatePath("/he");
  revalidatePath("/dashboard/homepage");
  return { ok: true as const };
}

export async function clearImageField(
  field: keyof Pick<
    HomepageSettingsPayload,
    | "expert_photo_url"
    | "home_article_img_0"
    | "home_article_img_1"
    | "home_article_img_2"
    | "home_hero_bg_value"
    | "hero_side_image_url"
  >,
) {
  const { supabase } = await requireAdmin();

  // If clearing the hero background, reset to gradient mode
  const patch: Record<string, unknown> =
    field === "home_hero_bg_value"
      ? { home_hero_bg_type: "gradient", home_hero_bg_value: "default" }
      : { [field]: null };

  const { error } = await supabase
    .from("site_settings")
    .update(patch)
    .eq("id", 1);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/en");
  revalidatePath("/he");
  revalidatePath("/dashboard/homepage");
  return { ok: true as const };
}
