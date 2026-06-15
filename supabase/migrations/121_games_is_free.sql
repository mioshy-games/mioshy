-- 121_games_is_free.sql
-- =============================================================================
-- H (g-h-launch): mark a couples wheel game as FULLY FREE — unlimited plays for
-- a registered user (the spin/paywall cap is bypassed in TruthOrDareClient when
-- is_free && logged-in). Guests still get the 3-spin teaser → RegistrationModal.
--
-- Additive + idempotent. DEFAULT false → every existing game keeps its current
-- spins→paywall behavior unchanged. Which game is free is fully configurable in
-- the DB by flipping `is_free`. We seed the flagship "כנות ואתגר" (matched by
-- Hebrew name so it works regardless of the row's slug — candidates seen in code
-- are 'honesty-or-challenge' and 'truth-or-dare') to true. The UPDATE is a
-- harmless no-op if no such row exists yet (games are created at runtime).
-- =============================================================================

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.games.is_free IS
  'When true, registered users play this game with no spin cap (free game). Guests still get the standard free-spin teaser then RegistrationModal. Default false keeps all other games on the subscription paywall.';

-- Confirmed free game: slug 'honesty-or-challenge' ("כנות ואתגר"). name_he kept
-- as a belt-and-suspenders match. Adjust in the DB to move the free flag.
UPDATE public.games
   SET is_free = true
 WHERE slug = 'honesty-or-challenge'
    OR name_he = 'כנות ואתגר';
