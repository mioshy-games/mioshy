// ============================================================
// TypeScript types for the "Adults Only" / "למבוגרים בלבד" section
// (internal codename "between-us" is kept in folder/function names for stability)
// Mirrors the schema defined in supabase/migrations/029_*.sql
// ============================================================

export type ExperienceLevel = "מרגש" | "מעורר" | "ללא_גבולות";

export const EXPERIENCE_LEVELS: { value: ExperienceLevel; labelHe: string; labelEn: string }[] = [
  { value: "מרגש", labelHe: "מרגש", labelEn: "Touching" },
  { value: "מעורר", labelHe: "מעורר", labelEn: "Stirring" },
  { value: "ללא_גבולות", labelHe: "ללא גבולות", labelEn: "No Limits (18+)" },
];

export type EntitlementSource =
  | "purchase"
  | "promo_gift"
  | "subscription_pick"
  | "admin_grant";

export type PromotionType = "buy_x_get_y" | "percent_off" | "amount_off";

export type PromotionScope = "between_us" | "wheel" | "snakes" | "all";

/**
 * Pricing plan tiers for the Adults pillar.
 *
 *  - `single`  — one-time purchase of a specific game (couple-owned, lifetime).
 *  - `monthly` — recurring membership; content drip + access to the catalogue.
 *  - `annual`  — recurring membership; same as monthly + one rotating Games-pillar
 *                game unlocked for 30 days at a time, swappable at period end.
 */
export type AdultsPlanTier = "single" | "monthly" | "annual";

// ------------------------------------------------------------
// Row shapes (as returned from Supabase)
// ------------------------------------------------------------

export interface BetweenUsSettings {
  id: 1;
  section_slug: string;
  section_name_he: string;
  section_name_en: string;
  section_tagline_he: string;
  section_tagline_en: string;
  single_purchase_enabled: boolean;
  monthly_enabled: boolean;
  annual_enabled: boolean;
  buy_x_get_x_enabled: boolean;
  single_price_ils: number;
  single_price_usd: number;
  monthly_price_ils: number;
  monthly_price_usd: number;
  annual_price_ils: number;
  annual_price_usd: number;
  buy_x_get_x_tiers: { buy: number; get: number }[];
  default_intimacy_badge_url: string | null;
  default_communication_badge_url: string | null;
  default_heat_badge_url: string | null;
  preview_cards_count: number;
  show_empty_state_cta: boolean;
  updated_at: string;
}

export interface ExperienceGame {
  id: string;
  slug: string;
  title_he: string;
  title_en: string;
  short_desc_he: string;
  short_desc_en: string;
  full_desc_he: string;
  full_desc_en: string;
  meta_title_he: string | null;
  meta_title_en: string | null;
  meta_description_he: string | null;
  meta_description_en: string | null;
  benefits_he: string[];
  benefits_en: string[];
  target_audience_he: string[];
  target_audience_en: string[];
  // Optional "play questions" — only used by games that need a reference
  // list of in-game prompts (e.g. card-draw or board-event triggers). When
  // empty, the play page hides the whole section.
  play_questions_intro_he: string;
  play_questions_intro_en: string;
  play_questions_he: string[];
  play_questions_en: string[];
  cover_image_url: string | null;
  gallery: string[];
  intimacy_badge_url: string | null;
  communication_badge_url: string | null;
  heat_badge_url: string | null;
  intimacy_level: number;
  communication_level: number;
  heat_level: number;
  price_ils: number | null;
  price_usd: number | null;
  is_new: boolean;
  is_popular: boolean;
  is_subscription_eligible: boolean;
  is_active: boolean;
  sort_weight: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExperienceGameCategory {
  id: string;
  slug: string;
  name_he: string;
  name_en: string;
  description_he: string;
  description_en: string;
  icon_url: string | null;
  color_hex: string | null;
  sort_weight: number;
  is_active: boolean;
}

export interface ExperienceGameTag {
  id: string;
  slug: string;
  name_he: string;
  name_en: string;
  color_hex: string | null;
  is_active: boolean;
}

export interface ExperienceGameContent {
  id: string;
  game_id: string;
  level: ExperienceLevel;
  order_index: number;
  title_he: string;
  title_en: string;
  body_he: string;
  body_en: string;
  is_preview: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Couple {
  id: string;
  pair_code: string;
  created_by: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CoupleEntitlement {
  id: string;
  couple_id: string;
  game_id: string;
  source: EntitlementSource;
  acquired_at: string;
  price_paid: number | null;
  currency: string | null;
}

export interface Promotion {
  id: string;
  code: string | null;
  name_he: string;
  name_en: string;
  description_he: string;
  description_en: string;
  type: PromotionType;
  buy_qty: number;
  get_qty: number;
  max_tiers: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  applies_to_scope: PromotionScope;
  stacking_allowed: boolean;
}
