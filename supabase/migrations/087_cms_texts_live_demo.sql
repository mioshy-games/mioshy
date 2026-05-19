-- 087_cms_texts_live_demo.sql
--
-- Seeds the `homeV2.liveDemo.*` CMS keys so the LiveDemoHero label
-- (the wheel hero on /games and on the homepage) shows up in
-- /admin/content as an editable row.
--
-- Currently only the post-spin "Continue" CTA label is wired through
-- CMS — added 2026-05-19 per Itzik:
--   "מעבר למשחק כנות / אתגר" / "Play Honesty / Challenge"
--
-- Page bucket: `homepage` (matches where the wheel hero is rendered).
-- Section:     `liveDemo` (groups any future LiveDemoHero keys).
--
-- ON CONFLICT (key) DO NOTHING — safe to re-run; never clobbers
-- admin edits that have already happened in the DB. Same pattern as
-- migrations 085 (about founder) and 086 (intimacy).

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich)
VALUES
  ('homeV2.liveDemo.ctaSettledPlay',
   'homepage', 'liveDemo',
   'מעבר למשחק כנות / אתגר',
   'Play Honesty / Challenge',
   false)
ON CONFLICT (key) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
