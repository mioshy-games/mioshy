-- 061_games_thumbnail_per_locale.sql
--
-- Per-locale thumbnails for the games catalogue.
--
-- Why: the catalogue thumbnails carry baked-in copy (e.g. the game's name
-- written into the artwork), so a single asset cannot serve both Hebrew
-- and English visitors - they need their own image. Per Itzik 2026-05-06,
-- pre-launch and the new catalogue isn't fully marketed yet, so we make
-- the schema clean instead of stacking a third nullable column on top of
-- the legacy field:
--
--   • Add  thumbnail_url_he TEXT NULL
--   • Add  thumbnail_url_en TEXT NULL
--   • Backfill BOTH new columns from the existing thumbnail_url so any
--     game that already had artwork keeps a working image in both locales
--     until the team uploads a localised version.
--   • Drop the legacy thumbnail_url column once the data is moved.
--
-- All call sites (admin form, AdminThumbnailEdit overlay, /games rendering,
-- /my/games gallery, /[locale] homepage, /games/[slug] OG image, sitemap
-- alternates) are updated in the same change set; there is no period where
-- the column is missing but code still references it.
--
-- Idempotency: ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS used so the
-- migration can be re-applied safely against an already-migrated DB.

BEGIN;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS thumbnail_url_he TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url_en TEXT;

-- Backfill: copy the legacy thumbnail into BOTH locale-specific columns so
-- existing games keep showing artwork until a per-locale upload replaces
-- them. Only fill where the new columns are still empty (idempotent re-run).
UPDATE public.games
   SET thumbnail_url_he = COALESCE(thumbnail_url_he, thumbnail_url),
       thumbnail_url_en = COALESCE(thumbnail_url_en, thumbnail_url)
 WHERE thumbnail_url IS NOT NULL
   AND (thumbnail_url_he IS NULL OR thumbnail_url_en IS NULL);

ALTER TABLE public.games
  DROP COLUMN IF EXISTS thumbnail_url;

COMMENT ON COLUMN public.games.thumbnail_url_he IS
  'Hebrew-locale catalogue thumbnail (typically carries baked-in Hebrew copy). Falls back to thumbnail_url_en if missing.';
COMMENT ON COLUMN public.games.thumbnail_url_en IS
  'English-locale catalogue thumbnail (typically carries baked-in English copy). Falls back to thumbnail_url_he if missing.';

COMMIT;
