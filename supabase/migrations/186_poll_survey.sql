-- 186_poll_survey.sql
--
-- "סקר הזוגיות של ישראל" (Israel Relationship Survey) — Stage 1 data layer.
-- Daily one-question/two-option poll for couples with a live Bayesian %
-- reveal. Spec: docs/mioshy-live-poll-code-agent-prompt.md (§4 schema, §8
-- percentage formula). Prefixed `poll_` to avoid colliding with the journey
-- assessment `questions` tables.
--
-- Stage 1 covers: poll_questions + poll_votes + poll_vote_aggregates.
-- users/couples/user_question_history/push_tokens (§4) come in later stages
-- and reuse the existing Supabase auth / profiles — no new tables here.
--
-- ⚠️ NO invented vote numbers (§13). count_a/count_b start at 0. The reveal %
-- uses cold-start PRIORS (§8): pct_a = (prior_a + count_a) /
-- (prior_a + prior_b + count_a + count_b) * 100. Priors are admin estimates.
-- NO questions are seeded here — the real questions are loaded from Itzik's CSV
-- (docs/poll-questions-template.csv format) via the import path; the full admin
-- CSV UI is Stage 2.
--
-- Service-role only (RLS on, no public policies): all reads/writes go through
-- the server API using the service-role client. Safe to re-run (IF NOT EXISTS).

BEGIN;

CREATE TABLE IF NOT EXISTS public.poll_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text          text NOT NULL,
  option_a      text NOT NULL,
  option_b      text NOT NULL,
  order_index   integer NOT NULL DEFAULT 0,
  domain        text,
  is_active     boolean NOT NULL DEFAULT true,
  -- Cold-start priors (§8): effective pseudo-counts. prior_weight reserved for
  -- the Wilson display-range logic (Stage 4 refinement).
  prior_a       numeric NOT NULL DEFAULT 0,
  prior_b       numeric NOT NULL DEFAULT 0,
  prior_weight  numeric NOT NULL DEFAULT 0,
  insight_line  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS poll_questions_active_order_idx
  ON public.poll_questions (is_active, order_index);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid NOT NULL REFERENCES public.poll_questions(id) ON DELETE CASCADE,
  option       text NOT NULL CHECK (option IN ('a','b')),
  user_id      uuid,                     -- null while anonymous; linked on signup (Stage 6)
  anon_id      text NOT NULL,            -- cookie id; every vote is saved, even anonymous (§7)
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS poll_votes_question_idx ON public.poll_votes (question_id);
CREATE INDEX IF NOT EXISTS poll_votes_anon_idx     ON public.poll_votes (anon_id);
CREATE INDEX IF NOT EXISTS poll_votes_user_idx     ON public.poll_votes (user_id);
-- One vote per (anon_id, question): no repeat on an answered question (§7).
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_anon_question_uidx
  ON public.poll_votes (anon_id, question_id);

CREATE TABLE IF NOT EXISTS public.poll_vote_aggregates (
  question_id  uuid PRIMARY KEY REFERENCES public.poll_questions(id) ON DELETE CASCADE,
  count_a      integer NOT NULL DEFAULT 0,
  count_b      integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.poll_questions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_vote_aggregates ENABLE ROW LEVEL SECURITY;

-- No question seed — real questions load from Itzik's CSV. The import creates a
-- matching zero-count poll_vote_aggregates row per question.

COMMIT;
