-- 129_games_alt_text.sql
-- =============================================================================
-- a11y (M5, accessibility-audit-2026-06-16) — admin-editable image alt text.
--
-- Adds a nullable alt_text to BOTH game catalogues so an admin can give each
-- game's cover/thumbnail a proper text alternative (WCAG 1.1.1). When empty,
-- the UI falls back to the game's name (the code fallback already in place), so
-- this is purely additive — existing rows keep working.
--   · public.games            — /games wheel catalogue
--   · public.experience_games — /mioshy-sex catalogue
-- =============================================================================

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS alt_text text;

ALTER TABLE public.experience_games
  ADD COLUMN IF NOT EXISTS alt_text text;

COMMENT ON COLUMN public.games.alt_text IS
  'Admin-set image alt text (a11y M5). NULL/empty → UI falls back to the game name.';
COMMENT ON COLUMN public.experience_games.alt_text IS
  'Admin-set image alt text (a11y M5). NULL/empty → UI falls back to the game title.';
