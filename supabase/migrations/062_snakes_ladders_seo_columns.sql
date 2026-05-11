-- 062_snakes_ladders_seo_columns.sql
--
-- Add SEO + game-identity columns to snakes_ladders_config.
--
-- Why: the admin form in /dashboard/snakes already exposes Slug, Game name
-- (HE/EN), Meta title (HE/EN), and Meta description (HE/EN), and the
-- `updateSnakesConfig` server action writes them - but the matching
-- columns were never added to the table (it was created in migration
-- 014 with only the play-mechanic fields). Saving fails with:
--   "Could not find the 'game_name_en' column of 'snakes_ladders_config'
--    in the schema cache"
-- This migration aligns the schema with the existing UI + action.
--
-- Per Itzik 2026-05-06: pre-launch, no backwards-compat fallbacks
-- needed. All columns are nullable so existing rows (if any) keep
-- working until an admin fills them in.

BEGIN;

ALTER TABLE public.snakes_ladders_config
  ADD COLUMN IF NOT EXISTS slug                TEXT,
  ADD COLUMN IF NOT EXISTS game_name_he        TEXT,
  ADD COLUMN IF NOT EXISTS game_name_en        TEXT,
  ADD COLUMN IF NOT EXISTS meta_title_he       TEXT,
  ADD COLUMN IF NOT EXISTS meta_title_en       TEXT,
  ADD COLUMN IF NOT EXISTS meta_description_he TEXT,
  ADD COLUMN IF NOT EXISTS meta_description_en TEXT;

-- Slug uniqueness (partial index - only enforced when set, so multiple
-- legacy rows without a slug don't collide).
CREATE UNIQUE INDEX IF NOT EXISTS snakes_ladders_config_slug_unique
  ON public.snakes_ladders_config (slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN public.snakes_ladders_config.slug IS
  'URL path segment under /games/<slug> for the snakes & ladders variant. Lowercase, hyphens. Unique when set.';
COMMENT ON COLUMN public.snakes_ladders_config.game_name_he IS
  'Hebrew display name for this snakes-and-ladders variant.';
COMMENT ON COLUMN public.snakes_ladders_config.game_name_en IS
  'English display name for this snakes-and-ladders variant.';
COMMENT ON COLUMN public.snakes_ladders_config.meta_title_he IS
  'Hebrew SEO meta title (max ~70 chars). Empty → falls back to game_name_he.';
COMMENT ON COLUMN public.snakes_ladders_config.meta_title_en IS
  'English SEO meta title (max ~70 chars). Empty → falls back to game_name_en.';
COMMENT ON COLUMN public.snakes_ladders_config.meta_description_he IS
  'Hebrew SEO meta description (max ~180 chars).';
COMMENT ON COLUMN public.snakes_ladders_config.meta_description_en IS
  'English SEO meta description (max ~180 chars).';

COMMIT;
