-- 080_couple_workflow_engine.sql
--
-- Phase 13 — per-couple workflow engine. Three additions:
--
-- 1. journey_couple_item_overrides — per-couple content overrides
--    (also stores the FULL content for one-off items created
--    specifically for one couple).
--
-- 2. journey_items.is_one_off — flag that hides items from catalog
--    browsers when the item was created ad-hoc for one couple.
--
-- 3. journey_couple_recommendations — log of every recommendation
--    shown to the coach, with last_suggested_at + dismissed_at.
--    Drives the 24-hour cooldown so the coach doesn't see the same
--    suggestion repeatedly between actions.
--
-- 4. subscription_admin_actions — audit trail for admin actions on
--    subscriptions (pause/cancel/refund).
--
-- All idempotent.

BEGIN;

-- ── 1. journey_items.is_one_off ──────────────────────────────────
ALTER TABLE public.journey_items
  ADD COLUMN IF NOT EXISTS is_one_off BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.journey_items.is_one_off IS
  'Phase 13 — when true, the item was created ad-hoc for ONE specific couple. Hidden from catalog browsers and from auto-suggestions for other couples.';

CREATE INDEX IF NOT EXISTS journey_items_catalog_idx
  ON public.journey_items (id)
  WHERE is_one_off = false AND is_active = true;

-- ── 2. journey_couple_item_overrides ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.journey_couple_item_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID NOT NULL REFERENCES public.couples(id)      ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES public.journey_items(id) ON DELETE CASCADE,
  -- Per-block overrides. NULL = use the catalog default.
  body_he             TEXT,
  body_en             TEXT,
  task_he             TEXT,
  task_en             TEXT,
  expert_insight_he   TEXT,
  expert_insight_en   TEXT,
  common_mistakes_he  TEXT,
  common_mistakes_en  TEXT,
  metaphor_he         TEXT,
  metaphor_en         TEXT,
  measurement_he      TEXT,
  measurement_en      TEXT,
  do_this_week_he     TEXT,
  do_this_week_en     TEXT,
  dont_this_week_he   TEXT,
  dont_this_week_en   TEXT,
  progress_marker_he  TEXT,
  progress_marker_en  TEXT,
  -- Provenance.
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (couple_id, item_id)
);

ALTER TABLE public.journey_couple_item_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_overrides_admin_all" ON public.journey_couple_item_overrides;
CREATE POLICY "couple_overrides_admin_all"
  ON public.journey_couple_item_overrides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','expert')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','expert')
    )
  );

CREATE INDEX IF NOT EXISTS journey_couple_item_overrides_couple_idx
  ON public.journey_couple_item_overrides (couple_id);
CREATE INDEX IF NOT EXISTS journey_couple_item_overrides_item_idx
  ON public.journey_couple_item_overrides (item_id);

COMMENT ON TABLE public.journey_couple_item_overrides IS
  'Phase 13 — per-couple content overrides. NULL columns mean "use catalog default". For one-off items (journey_items.is_one_off=true), this row stores the full content (the catalog row is just a placeholder).';

-- ── 3. journey_couple_recommendations (24h cooldown) ─────────────
CREATE TABLE IF NOT EXISTS public.journey_couple_recommendations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id          UUID NOT NULL REFERENCES public.couples(id)       ON DELETE CASCADE,
  item_id            UUID REFERENCES public.journey_items(id)          ON DELETE CASCADE,
  -- Why we recommended it (rationale shown in the UI).
  rationale          TEXT,
  -- Score from getCoachSuggestionsForCouple at the time of suggestion.
  score              INTEGER,
  -- When we last surfaced this recommendation to a coach.
  last_suggested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- When the coach explicitly dismissed it ("not for them"). Cooldown
  -- becomes infinite — the system never re-suggests this item.
  dismissed_at       TIMESTAMPTZ,
  -- When the coach acted on it (pushed or scheduled the item).
  acted_at           TIMESTAMPTZ,
  -- Free-form tag from the coach when dismissing.
  dismiss_reason     TEXT,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (couple_id, item_id)
);

ALTER TABLE public.journey_couple_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_recs_admin_all" ON public.journey_couple_recommendations;
CREATE POLICY "couple_recs_admin_all"
  ON public.journey_couple_recommendations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','expert')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','expert')
    )
  );

CREATE INDEX IF NOT EXISTS journey_couple_recommendations_couple_idx
  ON public.journey_couple_recommendations (couple_id);

COMMENT ON TABLE public.journey_couple_recommendations IS
  'Phase 13 — 24-hour cooldown log for Smart Suggestions. Re-suggest only if 24h passed since last_suggested_at AND not dismissed AND not acted_at.';

-- ── 4. subscription_admin_actions ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_admin_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  admin_user_id   UUID NOT NULL REFERENCES auth.users(id),
  action          TEXT NOT NULL CHECK (action IN (
    'pause','resume','cancel_at_period_end','cancel_immediate',
    'refund','extend_trial','override_next_billing','send_invoice','note'
  )),
  reason          TEXT,
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_admin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub_actions_admin_all" ON public.subscription_admin_actions;
CREATE POLICY "sub_actions_admin_all"
  ON public.subscription_admin_actions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS subscription_admin_actions_sub_idx
  ON public.subscription_admin_actions (subscription_id, created_at DESC);

COMMIT;

NOTIFY pgrst, 'reload schema';
