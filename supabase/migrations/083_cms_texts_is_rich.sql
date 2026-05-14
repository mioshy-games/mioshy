-- 083_cms_texts_is_rich.sql
--
-- Sprint 4 #1 follow-up — flag each CMS row as plain text vs rich
-- text so the admin UI and the sanitiser can behave differently per
-- row.
--
-- Without this column, every row got the rich-text treatment in the
-- editor (em / strong / br / p / ul / li / s toolbar) but only ~30
-- rows actually contain markup. Worse, a plain-text key like
-- homeV2.hero.tag rendered via `{useCmsText(key).text}` would
-- display admin-inserted <em> tags as literal angle brackets on the
-- public site — there's no dangerouslySetInnerHTML in the rendering
-- path for those keys.
--
-- Net behaviour after this migration:
--   is_rich = false  →  toolbar hidden, sanitiser rejects ANY tag
--                       on save, renderer outputs as plain text
--   is_rich = true   →  toolbar visible, sanitiser accepts the
--                       7-tag allow-list (em/strong/br/p/ul/li/s),
--                       renderer outputs via dangerouslySetInnerHTML
--
-- The cms_text_history table gets the same column so a restore
-- brings back the right mode along with the text.
--
-- Idempotent on re-run.

BEGIN;

-- ── 1. Column + default ──────────────────────────────────────────────

ALTER TABLE public.cms_texts
  ADD COLUMN IF NOT EXISTS is_rich BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.cms_text_history
  ADD COLUMN IF NOT EXISTS is_rich BOOLEAN;

COMMENT ON COLUMN public.cms_texts.is_rich IS
  'Sprint 4 #1 — true when the value may contain inline HTML markup (em / strong / br / p / ul / li / s). false (default) means plain text only; the sanitiser rejects ANY tag on save and the public site renders the value as a text node, not via dangerouslySetInnerHTML.';

COMMENT ON COLUMN public.cms_text_history.is_rich IS
  'Snapshot of cms_texts.is_rich at the time of the change. Lets a "restore this version" reset both the text AND its rich/plain mode together.';

-- ── 2. Flag rows that already contain markup ─────────────────────────
-- 31 keys total. `WHERE is_rich = false` makes this a no-op on a
-- second run — only flips rows that haven't been flagged yet.

UPDATE public.cms_texts
SET is_rich = true
WHERE is_rich = false
  AND key IN (
    'homeV2.adultGames.closer',
    'homeV2.adultGames.headline',
    'homeV2.adultGames.lead',
    'homeV2.authority.narrative',
    'homeV2.education.body',
    'homeV2.education.headline',
    'homeV2.faq.headline',
    'homeV2.faq.item1A',
    'homeV2.faq.item2A',
    'homeV2.faq.item3A',
    'homeV2.faq.item4A',
    'homeV2.faq.item5A',
    'homeV2.faq.item6A',
    'homeV2.faq.item7A',
    'homeV2.faq.item8A',
    'homeV2.faq.item9A',
    'homeV2.faq.item10A',
    'homeV2.faq.item11A',
    'homeV2.finalCta.headline',
    'homeV2.founder.headline',
    'homeV2.founder.lead',
    'homeV2.hero.headline',
    'homeV2.hero.priceFromLabel',
    'homeV2.journey.headline',
    'homeV2.media.headline',
    'homeV2.pricing.card1Original',
    'homeV2.pricing.card2Original',
    'homeV2.pricing.card3Original',
    'homeV2.pricing.headline',
    'homeV2.problem.headline',
    'homeV2.problem.item1Body'
  );

-- ── 3. Cleanup — strip the stray "1" Itzik typed while testing ──────
-- This was left over from Sprint 4 baseline testing on hero.headline.
-- Only updates if the current value still contains "1" — idempotent.

UPDATE public.cms_texts
SET he_text = 'זוגיות - רק עם קצת יותר <em>פלפל</em>.'
WHERE key = 'homeV2.hero.headline'
  AND he_text LIKE '%יותר1%';

COMMIT;

NOTIFY pgrst, 'reload schema';
