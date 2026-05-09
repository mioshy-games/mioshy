-- 071_journey_layer4_progress.sql
--
-- Layer 4 (Progress) — the system makes the couple's growth visible.
--
-- Two tables:
--   1. journey_weekly_recaps — auto-generated Sunday recap per
--      couple. Drives the recap card on /my/journey.
--   2. journey_milestones — append-only log of unlocked milestones
--      per couple. Drives the milestone-reveal modal at 5 / 10 / 20
--      completed items.
--
-- Deliberately small surface — the Progress layer is mostly read +
-- generate; existing tables (journey_item_completions, journey_analysis)
-- carry the underlying signals.
--
-- Idempotent on re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. journey_weekly_recaps
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.journey_weekly_recaps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Polymorphic owner — at least one set.
  couple_id       UUID REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id)    ON DELETE CASCADE,
  -- Sunday 00:00 UTC of the week the recap covers. The cron writes
  -- one row per (owner, week_starting); UPSERT semantics on conflict.
  week_starting   DATE NOT NULL,
  summary_he      TEXT NOT NULL,
  summary_en      TEXT NOT NULL,
  -- Structured signals: { items_completed, responses_posted,
  -- reactions_received, expert_replies, top_item_title }.
  notable_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Stamped when a coach explicitly approved/edited the recap.
  -- Default flow auto-publishes; this column lets us add a review
  -- gate later without schema changes.
  reviewed_by_expert_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT recap_owner_present CHECK (couple_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS journey_weekly_recaps_couple_week_uniq
  ON public.journey_weekly_recaps (couple_id, week_starting)
  WHERE couple_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS journey_weekly_recaps_user_week_uniq
  ON public.journey_weekly_recaps (user_id, week_starting)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS journey_weekly_recaps_week_idx
  ON public.journey_weekly_recaps (week_starting DESC);

ALTER TABLE public.journey_weekly_recaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journey_weekly_recaps_user_read ON public.journey_weekly_recaps;
CREATE POLICY journey_weekly_recaps_user_read
  ON public.journey_weekly_recaps FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = journey_weekly_recaps.couple_id
          AND cm.user_id   = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS journey_weekly_recaps_expert_read ON public.journey_weekly_recaps;
CREATE POLICY journey_weekly_recaps_expert_read
  ON public.journey_weekly_recaps FOR SELECT
  USING (
    couple_id IS NOT NULL
    AND public.is_expert_for_couple(couple_id)
  );

DROP POLICY IF EXISTS journey_weekly_recaps_admin_all ON public.journey_weekly_recaps;
CREATE POLICY journey_weekly_recaps_admin_all
  ON public.journey_weekly_recaps FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.journey_weekly_recaps IS
  'Auto-generated Sunday recap per (owner, week_starting). Drives the recap card on /my/journey + coach''s "the past week" digest.';

-- ---------------------------------------------------------------------------
-- 2. journey_milestones
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.journey_milestones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Polymorphic owner.
  couple_id       UUID REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id)    ON DELETE CASCADE,
  -- Slug of the milestone definition. Layer 4 ships three default
  -- slugs: 'five_items', 'ten_items', 'twenty_items'. Future content
  -- ops can introduce more without a schema change.
  milestone_slug  TEXT NOT NULL,
  -- When the underlying threshold was crossed (e.g. 5th completion).
  achieved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- When the user dismissed the reveal modal. NULL = pending reveal.
  revealed_at     TIMESTAMPTZ,
  -- Optional snapshot of the signal that triggered (e.g. items count,
  -- last item title). Lets the reveal modal render context without
  -- re-querying.
  signal_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT milestone_owner_present CHECK (couple_id IS NOT NULL OR user_id IS NOT NULL)
);

-- One row per (owner, slug) — milestones don't repeat for the same
-- owner. UPSERT on the cron prevents duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS journey_milestones_couple_slug_uniq
  ON public.journey_milestones (couple_id, milestone_slug)
  WHERE couple_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS journey_milestones_user_slug_uniq
  ON public.journey_milestones (user_id, milestone_slug)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS journey_milestones_pending_idx
  ON public.journey_milestones (achieved_at DESC)
  WHERE revealed_at IS NULL;

ALTER TABLE public.journey_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journey_milestones_user_read ON public.journey_milestones;
CREATE POLICY journey_milestones_user_read
  ON public.journey_milestones FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = journey_milestones.couple_id
          AND cm.user_id   = auth.uid()
      )
    )
  );

-- The dismiss action stamps revealed_at; user can update their own row.
DROP POLICY IF EXISTS journey_milestones_user_update ON public.journey_milestones;
CREATE POLICY journey_milestones_user_update
  ON public.journey_milestones FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = journey_milestones.couple_id
          AND cm.user_id   = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = journey_milestones.couple_id
          AND cm.user_id   = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS journey_milestones_expert_read ON public.journey_milestones;
CREATE POLICY journey_milestones_expert_read
  ON public.journey_milestones FOR SELECT
  USING (
    couple_id IS NOT NULL
    AND public.is_expert_for_couple(couple_id)
  );

DROP POLICY IF EXISTS journey_milestones_admin_all ON public.journey_milestones;
CREATE POLICY journey_milestones_admin_all
  ON public.journey_milestones FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.journey_milestones IS
  'Per-owner milestone log. Three default slugs (five_items / ten_items / twenty_items). revealed_at NULL = pending reveal modal on next /my/journey visit.';

COMMIT;

NOTIFY pgrst, 'reload schema';
