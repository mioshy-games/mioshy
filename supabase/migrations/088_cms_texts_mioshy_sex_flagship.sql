-- 088_cms_texts_mioshy_sex_flagship.sql
--
-- Seeds the `mioshySexPage.heroFlagshipLabel` CMS key so the small
-- "המוצר הדגל" / "The flagship" eyebrow label that sits above the
-- hero headline on /mioshy-sex shows up in /admin/content as an
-- editable row.
--
-- Current source of truth (JSON fallback):
--   messages/he.json line 1802 — "רב מכר"
--   messages/en.json line 1804 — "Best seller"
-- (Earlier values were "המוצר הדגל" / "The flagship"; changed to
--  "רב מכר" / "Best seller" per Itzik 2026-05-20.)
--
-- The label is rendered by AdultsMarketingHero.tsx line 193:
--   <CmsText cmsKey="mioshySexPage.heroFlagshipLabel" />
--
-- Once this migration runs, the CMS row takes precedence over the
-- JSON value, so admins can rephrase it without a deploy.
--
-- Page bucket: `mioshy-sex` (matches the route).
-- Section:     `hero` (groups all the hero copy keys on that page).
--
-- ON CONFLICT (key) DO NOTHING — safe to re-run; never clobbers any
-- admin edit already in the DB. Same pattern as 085 / 086 / 087.

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich)
VALUES
  ('mioshySexPage.heroFlagshipLabel',
   'mioshy-sex', 'hero',
   'רב מכר',
   'Best seller',
   false)
ON CONFLICT (key) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
