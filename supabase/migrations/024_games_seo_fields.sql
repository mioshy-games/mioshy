-- Migration 024 — SEO fields on games
-- ----------------------------------------------------------------------------
-- The marketing lead asked for admin-level control over per-game search
-- metadata. The site-wide metadata already lives in `site_settings`, articles
-- already carry their own meta_title/meta_description/og_image, but the
-- `games` table was still relying on name_he / description_he as the only
-- source for page <title> and <meta description>. That forces a trade-off
-- between conversational copy on the product and tight, keyword-rich copy
-- optimized for Google.
--
-- This migration adds four admin-editable overrides per locale + an OG image
-- URL + a keyword array. Page code (app/[locale]/games/[slug]/page.tsx) will
-- prefer these when present and fall back to name_*/description_* otherwise,
-- so existing games continue to render exactly as they do today.
--
-- Idempotent: uses `ADD COLUMN IF NOT EXISTS` so it is safe to re-run.

BEGIN;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS meta_title_he text,
  ADD COLUMN IF NOT EXISTS meta_title_en text,
  ADD COLUMN IF NOT EXISTS meta_description_he text,
  ADD COLUMN IF NOT EXISTS meta_description_en text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Reasonable index: admin lists + sitemap queries sort by sort_order then
-- created_at. A small btree here is free and stops future sequential scans.
CREATE INDEX IF NOT EXISTS games_sort_order_idx
  ON public.games (sort_order ASC, created_at DESC)
  WHERE is_active = true;

COMMENT ON COLUMN public.games.meta_title_he IS
  'Hebrew <title> override for the game detail page. Falls back to name_he.';
COMMENT ON COLUMN public.games.meta_title_en IS
  'English <title> override for the game detail page. Falls back to name_en.';
COMMENT ON COLUMN public.games.meta_description_he IS
  'Hebrew <meta name=description> override. Falls back to description_he.';
COMMENT ON COLUMN public.games.meta_description_en IS
  'English <meta name=description> override. Falls back to description_en.';
COMMENT ON COLUMN public.games.og_image_url IS
  'Open Graph image for social previews. Falls back to thumbnail_url.';
COMMENT ON COLUMN public.games.keywords IS
  'Optional keyword tags (text[]) shown to admin for organization. Not rendered
   as meta keywords (deprecated) but used for internal search + related-games.';
COMMENT ON COLUMN public.games.sort_order IS
  'Admin-controlled ordering (lower = earlier). Ties break by created_at DESC.';

-- Refresh PostgREST schema cache so the new columns are immediately usable
-- from the app without having to restart the project.
NOTIFY pgrst, 'reload schema';

COMMIT;
