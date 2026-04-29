-- ============================================================
-- 028 — Homepage content management via admin
-- Adds editable columns to site_settings so the admin dashboard
-- can control hero text, CTA buttons/styles/links, and image slots
-- for the homepage (hero background, expert photo, article cards).
-- ============================================================

ALTER TABLE public.site_settings
  -- Hero headline & subtitle (overrides i18n when set)
  ADD COLUMN IF NOT EXISTS hero_headline_he  text,
  ADD COLUMN IF NOT EXISTS hero_headline_en  text,
  ADD COLUMN IF NOT EXISTS hero_sub_he       text,
  ADD COLUMN IF NOT EXISTS hero_sub_en       text,

  -- Primary CTA button
  ADD COLUMN IF NOT EXISTS cta_primary_text_he  text,
  ADD COLUMN IF NOT EXISTS cta_primary_text_en  text,
  ADD COLUMN IF NOT EXISTS cta_primary_href     text DEFAULT '/games/truth-or-dare',
  ADD COLUMN IF NOT EXISTS cta_primary_style    text DEFAULT 'gradient',

  -- Secondary CTA button
  ADD COLUMN IF NOT EXISTS cta_secondary_text_he  text,
  ADD COLUMN IF NOT EXISTS cta_secondary_text_en  text,
  ADD COLUMN IF NOT EXISTS cta_secondary_href      text DEFAULT '#games',

  -- Homepage article-card images (override the article thumbnails)
  ADD COLUMN IF NOT EXISTS home_article_img_0  text,
  ADD COLUMN IF NOT EXISTS home_article_img_1  text,
  ADD COLUMN IF NOT EXISTS home_article_img_2  text;

-- ── Storage bucket for site-wide assets ────────────────────
-- Reuse the existing "backgrounds" bucket with a "homepage/" prefix.
-- No new bucket needed.
