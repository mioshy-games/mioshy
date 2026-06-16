-- 127_games_opens_at.sql
-- =============================================================================
-- Work-order 2026-06-15, part D — "Coming Soon" scheduled games.
--
-- Adds opens_at to BOTH game catalogues:
--   · public.games            — the "משחקי זוגות אונליין" wheel catalogue (/games)
--   · public.experience_games — the "הסקס של מיאושי" catalogue (/mioshy-sex)
--
-- Semantics (computed LIVE at render — no manual flag to toggle off):
--   · opens_at IS NULL            → immediate: opens as soon as it's published.
--   · opens_at >  now()           → scheduled/coming-soon: card visible (name +
--                                    image + description) but entry/purchase are
--                                    disabled and a countdown shows until it opens.
--   · opens_at <= now()           → already open; behaves like any normal game.
--
-- Admin-controlled via the game form (GameForm / ExperienceGameForm). No slug
-- hardcoding — the schedule is this column alone.
-- =============================================================================

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS opens_at timestamptz;

ALTER TABLE public.experience_games
  ADD COLUMN IF NOT EXISTS opens_at timestamptz;

COMMENT ON COLUMN public.games.opens_at IS
  'Scheduled open time (work-order 2026-06-15 D). NULL = immediate; future = coming-soon (locked + countdown); past = open. Computed live.';
COMMENT ON COLUMN public.experience_games.opens_at IS
  'Scheduled open time (work-order 2026-06-15 D). NULL = immediate; future = coming-soon (locked + countdown); past = open. Computed live.';
