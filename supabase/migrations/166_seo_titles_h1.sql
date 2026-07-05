-- ───────────────────────────────────────────────────────────────────────────
-- 166_seo_titles_h1.sql
--
-- SEO on-page copy for the Hebrew visibility push (docs/seo-stage4-findings-
-- 2026-07-05.md). Approved by Itzik 2026-07-05.
--
--   B  gamesHub.title              — /games <title> keyword-aligned ("משחקי
--                                     זוגות אונליין", was "משחקי זוגיות ...").
--   D  gamesHub.h1                 — /games H1: keyword merged into the slogan.
--   D  couplesAssessment.hero.h1   — /couples-assessment H1: keyword merged in.
--
-- These three keys are admin-authored CMS overrides (they shadow the i18n
-- fallbacks), so the change has to land in cms_texts, not messages/*.json.
--
-- Idempotent. The DO UPDATE intentionally touches ONLY he_text + is_rich so a
-- re-run enforces the Hebrew copy (per the is_rich seed contract) WITHOUT
-- clobbering the existing English rows or the page/section routing.
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('gamesHub.title', 'games', 'meta',
   'משחקי זוגות אונליין · כל המשחקים של מיאושי',
   'Online couples games · all of Mioshy''s games', false),

  ('gamesHub.h1', 'games', 'hero',
   'משחקי זוגות אונליין: בילוי שמתחיל בצחוק ונגמר בחדר השינה',
   'Online couples games: fun that starts with laughter and ends in the bedroom', false),

  ('couplesAssessment.hero.h1', 'couples-assessment', 'hero',
   'אבחון זוגיות אונליין: איפה אתם היום, ולאן אפשר להגיע?',
   'Online couples assessment: where you are today, and where you can go', false)
ON CONFLICT (key) DO UPDATE
  SET he_text = EXCLUDED.he_text,
      is_rich = EXCLUDED.is_rich;
