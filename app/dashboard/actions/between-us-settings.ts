"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import {
  betweenUsSettingsSchema,
  type BetweenUsSettingsFormValues,
} from "@/lib/between-us/validations";

export async function saveBetweenUsSettings(raw: unknown) {
  const parsed = betweenUsSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }
  const v: BetweenUsSettingsFormValues = parsed.data;

  const { supabase, user } = await requireAdmin();

  const { error } = await supabase
    .from("between_us_settings")
    .update({
      section_slug: v.section_slug,
      section_name_he: v.section_name_he,
      section_name_en: v.section_name_en,
      section_tagline_he: v.section_tagline_he,
      section_tagline_en: v.section_tagline_en,
      single_purchase_enabled: v.single_purchase_enabled,
      monthly_enabled: v.monthly_enabled,
      annual_enabled: v.annual_enabled,
      buy_x_get_x_enabled: v.buy_x_get_x_enabled,
      single_price_ils: v.single_price_ils,
      single_price_usd: v.single_price_usd,
      monthly_price_ils: v.monthly_price_ils,
      monthly_price_usd: v.monthly_price_usd,
      annual_price_ils: v.annual_price_ils,
      annual_price_usd: v.annual_price_usd,
      buy_x_get_x_tiers: v.buy_x_get_x_tiers,
      default_intimacy_badge_url: v.default_intimacy_badge_url,
      default_communication_badge_url: v.default_communication_badge_url,
      default_heat_badge_url: v.default_heat_badge_url,
      preview_cards_count: v.preview_cards_count,
      show_empty_state_cta: v.show_empty_state_cta,
      updated_by: user.id,
    })
    .eq("id", 1);

  if (error) {
    return { ok: false as const, error: { _root: [error.message] } };
  }

  revalidatePath("/dashboard/adults", "layout");
  revalidatePath("/", "layout");
  return { ok: true as const };
}
