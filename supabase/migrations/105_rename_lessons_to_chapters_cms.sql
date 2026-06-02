-- ============================================================
-- Migration 105 — rename "שיעור" → "פרק" in CMS strings
-- ============================================================
-- Itzik 2026-06-02: the journey content unit is now called a "פרק"
-- (chapter) across the product, not a "שיעור" (lesson). Migrations
-- 098 / 100 seeded the CMS with the old wording. The codebase + new
-- messages/he.json default already say פרק; this migration flips the
-- live DB rows to match.
--
-- Scope: he_text on cms_texts rows under page='app-shell' that still
-- contain שיעור. English copy stays "lesson" (Hebrew-only rename per
-- Itzik — the audiobook-style "chapter" metaphor lands in Hebrew).
--
-- Idempotent: REPLACE() is a no-op once שיעור is gone, and the WHERE
-- clause prevents touching rows that don't need it. updated_at is
-- bumped automatically by the cms_texts_touch_updated_at trigger.
--
-- Why a fresh migration instead of editing 098 / 100: those already
-- ran in prod and are no-ops on re-apply. New migration is the only
-- way the change reaches production CMS rows.
-- ============================================================

BEGIN;

UPDATE public.cms_texts
SET he_text = REPLACE(he_text, 'שיעור', 'פרק')
WHERE page = 'app-shell'
  AND he_text ILIKE '%שיעור%';

-- Diagnostic — confirm no app-shell row still contains שיעור.
DO $$
DECLARE
  v_remaining BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM public.cms_texts
  WHERE page = 'app-shell'
    AND he_text ILIKE '%שיעור%';

  RAISE NOTICE 'After rename → app-shell rows still containing שיעור: %',
    v_remaining;

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'Rename failed — % rows still contain שיעור',
      v_remaining;
  END IF;
END;
$$;

COMMIT;
