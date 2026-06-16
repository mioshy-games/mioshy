// ============================================================
// Zod schemas for the Between Us admin forms
// ============================================================
import { z } from "zod";

const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be lowercase kebab-case");

const hexColorSchema = z
  .union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.literal(""), z.null()])
  .optional();
const urlOrEmptySchema = z
  .union([z.string().url(), z.literal(""), z.null()])
  .optional();

// ------------------------------------------------------------
// between_us_settings
// ------------------------------------------------------------
export const betweenUsSettingsSchema = z.object({
  section_slug: z.string().min(2).max(40),
  section_name_he: z.string().min(1).max(60),
  section_name_en: z.string().min(1).max(60),
  section_tagline_he: z.string().max(160),
  section_tagline_en: z.string().max(160),

  single_purchase_enabled: z.boolean(),
  monthly_enabled: z.boolean(),
  annual_enabled: z.boolean(),
  buy_x_get_x_enabled: z.boolean(),

  single_price_ils: z.number().min(0).max(9999),
  single_price_usd: z.number().min(0).max(9999),
  monthly_price_ils: z.number().min(0).max(9999),
  monthly_price_usd: z.number().min(0).max(9999),
  annual_price_ils: z.number().min(0).max(9999),
  annual_price_usd: z.number().min(0).max(9999),

  buy_x_get_x_tiers: z
    .array(
      z.object({
        buy: z.number().int().min(1).max(10),
        get: z.number().int().min(1).max(10),
      }),
    )
    .max(6),

  default_intimacy_badge_url: urlOrEmptySchema,
  default_communication_badge_url: urlOrEmptySchema,
  default_heat_badge_url: urlOrEmptySchema,

  preview_cards_count: z.number().int().min(0).max(10),
  show_empty_state_cta: z.boolean(),
});

export type BetweenUsSettingsFormValues = z.infer<typeof betweenUsSettingsSchema>;

// ------------------------------------------------------------
// experience_games
// ------------------------------------------------------------
export const experienceGameSchema = z.object({
  slug: slugSchema,

  title_he: z.string().min(1).max(120),
  title_en: z.string().max(120),
  // Short description - used as the marketing-card subtitle and the
  // detail-page lede. Kept unbounded on purpose: the public surfaces
  // already use `line-clamp-2`/`line-clamp-3` so longer copy is
  // gracefully truncated in the UI without breaking layout.
  short_desc_he: z.string(),
  short_desc_en: z.string(),
  full_desc_he: z.string().max(4000),
  full_desc_en: z.string().max(4000),

  meta_title_he: z.string().max(70).nullable().optional(),
  meta_title_en: z.string().max(70).nullable().optional(),
  meta_description_he: z.string().max(160).nullable().optional(),
  meta_description_en: z.string().max(160).nullable().optional(),

  benefits_he: z.array(z.string().max(140)).max(10),
  benefits_en: z.array(z.string().max(140)).max(10),
  target_audience_he: z.array(z.string().max(140)).max(10),
  target_audience_en: z.array(z.string().max(140)).max(10),

  // Optional in-game reference: a list of questions players can read
  // when a physical-game trigger occurs (drew a card, landed on a tile,
  // etc.). Display-only on the post-purchase /play page.
  // Empty arrays = section hidden on the play page.
  play_questions_intro_he: z.string().max(280),
  play_questions_intro_en: z.string().max(280),
  play_questions_he: z.array(z.string().max(280)).max(30),
  play_questions_en: z.array(z.string().max(280)).max(30),

  cover_image_url: urlOrEmptySchema,
  gallery: z.array(z.string().url()).max(12),
  intimacy_badge_url: urlOrEmptySchema,
  communication_badge_url: urlOrEmptySchema,
  heat_badge_url: urlOrEmptySchema,

  intimacy_level: z.number().int().min(1).max(5),
  communication_level: z.number().int().min(1).max(5),
  heat_level: z.number().int().min(1).max(5),

  price_ils: z.number().min(0).max(9999).nullable().optional(),
  price_usd: z.number().min(0).max(9999).nullable().optional(),

  is_new: z.boolean(),
  is_popular: z.boolean(),
  is_subscription_eligible: z.boolean(),
  is_active: z.boolean(),

  sort_weight: z.number().int().min(0).max(9999),

  // D — scheduled "Coming Soon" open time. ISO string, or null = immediate.
  opens_at: z.string().nullable().optional(),

  // a11y M5 — admin-set image alt text. Empty → fall back to the game title.
  alt_text: z.string().optional().nullable(),

  category_ids: z.array(z.string().uuid()),
  tag_ids: z.array(z.string().uuid()),
});

export type ExperienceGameFormValues = z.infer<typeof experienceGameSchema>;

// ------------------------------------------------------------
// experience_game_categories
// ------------------------------------------------------------
export const experienceGameCategorySchema = z.object({
  slug: slugSchema,
  name_he: z.string().min(1).max(60),
  name_en: z.string().max(60),
  description_he: z.string().max(280),
  description_en: z.string().max(280),
  icon_url: urlOrEmptySchema,
  color_hex: hexColorSchema,
  sort_weight: z.number().int().min(0).max(9999),
  is_active: z.boolean(),
});
export type ExperienceGameCategoryFormValues = z.infer<typeof experienceGameCategorySchema>;

// ------------------------------------------------------------
// experience_game_tags
// ------------------------------------------------------------
export const experienceGameTagSchema = z.object({
  slug: slugSchema,
  name_he: z.string().min(1).max(40),
  name_en: z.string().max(40),
  color_hex: hexColorSchema,
  is_active: z.boolean(),
});
export type ExperienceGameTagFormValues = z.infer<typeof experienceGameTagSchema>;

// ------------------------------------------------------------
// experience_game_content
// ------------------------------------------------------------
export const experienceGameContentSchema = z.object({
  game_id: z.string().uuid(),
  level: z.enum(["מרגש", "מעורר", "ללא_גבולות"]),
  order_index: z.number().int().min(0).max(9999),
  title_he: z.string().max(120),
  title_en: z.string().max(120),
  body_he: z.string().max(4000),
  body_en: z.string().max(4000),
  is_preview: z.boolean(),
  is_active: z.boolean(),
});
export type ExperienceGameContentFormValues = z.infer<typeof experienceGameContentSchema>;

// ------------------------------------------------------------
// promotions
// ------------------------------------------------------------
export const promotionSchema = z.object({
  code: z.string().min(2).max(40).nullable().optional(),
  name_he: z.string().min(1).max(80),
  name_en: z.string().max(80),
  description_he: z.string().max(280),
  description_en: z.string().max(280),
  type: z.enum(["buy_x_get_y", "percent_off", "amount_off"]),
  buy_qty: z.number().int().min(1).max(10),
  get_qty: z.number().int().min(0).max(10),
  max_tiers: z.number().int().min(1).max(10),
  is_active: z.boolean(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  applies_to_scope: z.enum(["between_us", "wheel", "snakes", "all"]),
  stacking_allowed: z.boolean(),
});
export type PromotionFormValues = z.infer<typeof promotionSchema>;
