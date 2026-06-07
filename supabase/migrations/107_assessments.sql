-- 107_assessments.sql
-- =============================================================================
-- Dedicated "Assessments" product line (separate from the Journey funnel).
--
-- Each topical assessment (intimacy, communication, compatibility, family) is
-- its OWN product. To keep the live paid Journey funnel completely isolated
-- (19 code surfaces query `journeys` without an assessment filter), the
-- assessments get their own tables. They mirror the journeys shape so the
-- proven flow patterns (anon-by-device → register at end → analyze) carry
-- over, but nothing here touches journeys / journey_responses / journey_analysis.
--
-- Scoring model differs from Journey: 5 "dimensions" (ממדים) × 4 Likert
-- questions, scored 0..100 per dimension. No Gottman axes. Question 21 is an
-- open reflection (not scored) handed to the coaching team.
--
-- Itzik 2026-06-07: dedicated tables confirmed, each assessment a separate product.
-- =============================================================================

-- ── Sessions: one row per (user/device, assessment) attempt ──────────────────
CREATE TABLE IF NOT EXISTS public.assessment_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     text NOT NULL,                       -- 'intimacy' | 'communication' | ...
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id         text,                                -- set while anonymous; cleared on claim
  language          text NOT NULL DEFAULT 'he',
  status            text NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress','complete')),
  current_step      int  NOT NULL DEFAULT 0,
  completed_at      timestamptz,
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assessment_sessions_user_idx
  ON public.assessment_sessions (user_id, assessment_id);
CREATE INDEX IF NOT EXISTS assessment_sessions_device_idx
  ON public.assessment_sessions (device_id, assessment_id);

-- One active (in_progress) session per (user, assessment). Different
-- assessments can be in progress simultaneously because the key includes
-- assessment_id — this is exactly the isolation that the journeys table
-- couldn't give us without touching 19 call sites.
CREATE UNIQUE INDEX IF NOT EXISTS assessment_sessions_user_active_key
  ON public.assessment_sessions (user_id, assessment_id)
  WHERE user_id IS NOT NULL AND status = 'in_progress';

-- ── Responses: one row per answered question, upserted ───────────────────────
CREATE TABLE IF NOT EXISTS public.assessment_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  question_id   text NOT NULL,
  answer        jsonb NOT NULL,           -- {kind:"likert",value} | {kind:"text",text}
  locale        text NOT NULL DEFAULT 'he',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS assessment_responses_session_idx
  ON public.assessment_responses (session_id);

-- ── Results: computed analysis per session ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assessment_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  assessment_id       text NOT NULL,
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  -- [{key, he, en, score}] — 0..100 per dimension, higher = stronger.
  dimension_scores    jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- the 3 lowest dimension keys, flagged for the coaching team.
  weakest_dimensions  jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- the open question 21 — authentic free text for the coach.
  open_answer         text,
  -- full analysis bundle incl. ai_hero (benefit-stack hero + recs).
  summary             jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assessment_results_user_idx
  ON public.assessment_results (user_id, assessment_id);
CREATE INDEX IF NOT EXISTS assessment_results_session_idx
  ON public.assessment_results (session_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- All writes go through the service-role admin client (same proven pattern as
-- the journeys flow — see project_supabase_ssr_rls_pattern). RLS here only
-- governs direct client reads: a signed-in user may read their own rows.
-- Anonymous (device-only) rows are read server-side via the service role.
ALTER TABLE public.assessment_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assessment_sessions_select_own ON public.assessment_sessions;
CREATE POLICY assessment_sessions_select_own
  ON public.assessment_sessions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS assessment_responses_select_own ON public.assessment_responses;
CREATE POLICY assessment_responses_select_own
  ON public.assessment_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_sessions s
      WHERE s.id = assessment_responses.session_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS assessment_results_select_own ON public.assessment_results;
CREATE POLICY assessment_results_select_own
  ON public.assessment_results FOR SELECT
  USING (user_id = auth.uid());
