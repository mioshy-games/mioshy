-- 070_journey_layer3_safety_net.sql
--
-- Layer 3 (Safety Net) — the system catches users who drift, lets
-- them pause without quitting, and reminds them gently.
--
-- Tables added:
--   1. subscription_pauses — user-initiated pauses with reason +
--      paused_until. NEVER deletes the underlying subscription;
--      pause is a state, not a teardown.
--   2. journey_drift_alerts — per-couple state row tracking when
--      we last saw activity + when (if at all) the coach sent a
--      drift check-in.
--   3. journey_reminder_log — idempotency log for d1/d2 user-side
--      reminders + d7 coach-side drift alerts. Composite-unique
--      so the cron never double-sends.
--
-- Plus helper:
--   pact_record_honoured_week(pact_id, week_number) — single
--   write to bump honoured_through_week on the pact row.
--
-- Idempotent end-to-end.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. subscription_pauses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscription_pauses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The subscription row this pause anchors to. Soft-FK (no cascade)
  -- because subscriptions live on a separate timeline (Cardcom-driven).
  subscription_id UUID,
  paused_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- When the pause auto-ends. If the user reactivates earlier, we
  -- stamp resumed_at and ignore the auto-end.
  paused_until    TIMESTAMPTZ NOT NULL,
  resumed_at      TIMESTAMPTZ,
  -- 'too_busy' | 'life_event' | 'tried_not_for_us' | 'other'
  reason          TEXT NOT NULL CHECK (reason IN ('too_busy','life_event','tried_not_for_us','other')),
  reason_text     TEXT,
  CONSTRAINT pause_window_sane CHECK (paused_until > paused_at)
);

CREATE INDEX IF NOT EXISTS subscription_pauses_user_idx
  ON public.subscription_pauses (user_id, paused_at DESC);
CREATE INDEX IF NOT EXISTS subscription_pauses_active_idx
  ON public.subscription_pauses (user_id)
  WHERE resumed_at IS NULL;

ALTER TABLE public.subscription_pauses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_pauses_user_read ON public.subscription_pauses;
CREATE POLICY subscription_pauses_user_read
  ON public.subscription_pauses FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS subscription_pauses_user_insert ON public.subscription_pauses;
CREATE POLICY subscription_pauses_user_insert
  ON public.subscription_pauses FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS subscription_pauses_user_update ON public.subscription_pauses;
CREATE POLICY subscription_pauses_user_update
  ON public.subscription_pauses FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS subscription_pauses_admin_all ON public.subscription_pauses;
CREATE POLICY subscription_pauses_admin_all
  ON public.subscription_pauses FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.subscription_pauses IS
  'User-initiated subscription pauses. resumed_at NULL = currently paused. '
  'Drives the "you''re paused until X" UI in /account and the "back when ready" '
  'restoration flow.';

-- ---------------------------------------------------------------------------
-- 2. journey_drift_alerts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.journey_drift_alerts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Polymorphic owner (mirrors journey_assignments). At least one set.
  couple_id             UUID REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES auth.users(id)    ON DELETE CASCADE,
  -- Last activity signal we observed when this row was last updated.
  last_response_at      TIMESTAMPTZ,
  last_message_at       TIMESTAMPTZ,
  -- Computed bucket: 'active' | 'drifting' | 'silent'.
  state                 TEXT NOT NULL CHECK (state IN ('active','drifting','silent')),
  -- The most recent time the coach sent a drift check-in. NULL =
  -- coach hasn't reached out for this drift episode yet. The user-
  -- facing drift banner ONLY surfaces when this is non-null —
  -- automation never guilt-trips the user; the human does.
  coach_checked_in_at   TIMESTAMPTZ,
  coach_checked_in_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT drift_owner_present CHECK (couple_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS journey_drift_alerts_couple_uniq
  ON public.journey_drift_alerts (couple_id)
  WHERE couple_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS journey_drift_alerts_user_uniq
  ON public.journey_drift_alerts (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS journey_drift_alerts_state_idx
  ON public.journey_drift_alerts (state) WHERE state != 'active';

ALTER TABLE public.journey_drift_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journey_drift_alerts_expert_read ON public.journey_drift_alerts;
CREATE POLICY journey_drift_alerts_expert_read
  ON public.journey_drift_alerts FOR SELECT
  USING (
    couple_id IS NOT NULL
    AND public.is_expert_for_couple(couple_id)
  );

DROP POLICY IF EXISTS journey_drift_alerts_user_read ON public.journey_drift_alerts;
CREATE POLICY journey_drift_alerts_user_read
  ON public.journey_drift_alerts FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = journey_drift_alerts.couple_id
          AND cm.user_id   = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS journey_drift_alerts_admin_all ON public.journey_drift_alerts;
CREATE POLICY journey_drift_alerts_admin_all
  ON public.journey_drift_alerts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.journey_drift_alerts IS
  'One row per couple/user tracking drift state. updated by drift cron + on every coach check-in. '
  'state=drifting at 8-14d silent; state=silent at 15d+. coach_checked_in_at gates the user-facing drift banner.';

-- Touch trigger for updated_at
CREATE OR REPLACE FUNCTION public.tg_journey_drift_alerts_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journey_drift_alerts_touch ON public.journey_drift_alerts;
CREATE TRIGGER journey_drift_alerts_touch
  BEFORE UPDATE ON public.journey_drift_alerts
  FOR EACH ROW EXECUTE FUNCTION public.tg_journey_drift_alerts_touch();

-- ---------------------------------------------------------------------------
-- 3. journey_reminder_log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.journey_reminder_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_item_id UUID REFERENCES public.journey_scheduled_items(id) ON DELETE CASCADE,
  -- 'd1_morning' | 'd2_evening' | 'd7_drift_coach_alert'
  reminder_kind     TEXT NOT NULL,
  -- 'email' | 'push' | 'in_app'
  channel           TEXT NOT NULL,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotency: same (user, item, kind) only ever fires once.
  UNIQUE (user_id, scheduled_item_id, reminder_kind)
);

CREATE INDEX IF NOT EXISTS journey_reminder_log_user_idx
  ON public.journey_reminder_log (user_id, sent_at DESC);

ALTER TABLE public.journey_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journey_reminder_log_user_read ON public.journey_reminder_log;
CREATE POLICY journey_reminder_log_user_read
  ON public.journey_reminder_log FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS journey_reminder_log_admin_all ON public.journey_reminder_log;
CREATE POLICY journey_reminder_log_admin_all
  ON public.journey_reminder_log FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.journey_reminder_log IS
  'Idempotency log for d1/d2 user reminders and d7 coach drift alerts. '
  'Composite unique (user_id, scheduled_item_id, reminder_kind) so cron retries are free.';

-- ---------------------------------------------------------------------------
-- 4. RPC: bump pact honoured_through_week
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pact_record_honoured_week(
  p_pact_id UUID,
  p_week    INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.journey_couple_pacts
  SET honoured_through_week = GREATEST(COALESCE(honoured_through_week, 0), p_week)
  WHERE id = p_pact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pact_record_honoured_week(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pact_record_honoured_week(UUID, INT) TO authenticated, service_role;

COMMENT ON FUNCTION public.pact_record_honoured_week IS
  'L3 cron helper: bumps honoured_through_week if p_week is greater than current. Never decreases. SECURITY DEFINER so the cron service role can write across users.';

COMMIT;

NOTIFY pgrst, 'reload schema';
