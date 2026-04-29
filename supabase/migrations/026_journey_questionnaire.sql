-- ============================================================
-- 026_journey_questionnaire.sql
-- The Seven Principles-inspired questionnaire + engagement engine
-- Prefixed `journey_*` to avoid collision with existing `questions` (Truth/Dare)
-- ============================================================

-- -------------------------------------------------------------
-- 1. journeys: one row per user (or device_id pre-register)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journeys (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id         text,                                 -- nullable after register
  language          text NOT NULL DEFAULT 'he'
                    CHECK (language IN ('he','en')),
  status            text NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress','paywall','complete','abandoned')),
  current_step      integer NOT NULL DEFAULT 0,           -- 0-based question index
  questionnaire_version integer NOT NULL DEFAULT 1,
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journeys_owner_chk CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS journeys_user_id_idx    ON public.journeys(user_id);
CREATE INDEX IF NOT EXISTS journeys_device_id_idx  ON public.journeys(device_id);
CREATE INDEX IF NOT EXISTS journeys_status_idx     ON public.journeys(status);
CREATE UNIQUE INDEX IF NOT EXISTS journeys_user_active_key
  ON public.journeys(user_id)
  WHERE user_id IS NOT NULL AND status IN ('in_progress','paywall');

ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journeys_self_select" ON public.journeys;
CREATE POLICY "journeys_self_select"
  ON public.journeys FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "journeys_self_update" ON public.journeys;
CREATE POLICY "journeys_self_update"
  ON public.journeys FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Anonymous insert allowed by device_id only
DROP POLICY IF EXISTS "journeys_anon_insert" ON public.journeys;
CREATE POLICY "journeys_anon_insert"
  ON public.journeys FOR INSERT
  WITH CHECK (
    (user_id IS NULL AND device_id IS NOT NULL AND length(device_id) > 8)
    OR user_id = auth.uid()
  );

-- -------------------------------------------------------------
-- 2. journey_responses: one row per answered question
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journey_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id   uuid NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  question_id  text NOT NULL,                 -- matches questionnaire.json id
  answer       jsonb NOT NULL,                -- { value: 3 } | { option: "a" } | { text: "..." }
  locale       text NOT NULL DEFAULT 'he',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, question_id)
);

CREATE INDEX IF NOT EXISTS journey_responses_journey_id_idx ON public.journey_responses(journey_id);
CREATE INDEX IF NOT EXISTS journey_responses_question_id_idx ON public.journey_responses(question_id);

ALTER TABLE public.journey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journey_responses_by_owner" ON public.journey_responses;
CREATE POLICY "journey_responses_by_owner"
  ON public.journey_responses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.journeys j
      WHERE j.id = journey_responses.journey_id
        AND (j.user_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journeys j
      WHERE j.id = journey_responses.journey_id
        AND (j.user_id = auth.uid() OR public.is_admin())
    )
  );

-- -------------------------------------------------------------
-- 3. journey_analysis: latest computed insights per user
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journey_analysis (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id         uuid NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  axis_scores        jsonb NOT NULL,          -- { love_map: 0.62, fondness: 0.48, ... }
  friendship_score   numeric(5,2),
  conflict_health    numeric(5,2),
  passion_risk       numeric(5,2),
  primary_love_language   text,
  secondary_love_language text,
  top_gap            text,                    -- axis with strongest negative signal
  four_horsemen_flag boolean NOT NULL DEFAULT false,
  summary            jsonb,                   -- narrative + top3 recommendations (bilingual)
  computed_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journey_analysis_user_id_idx ON public.journey_analysis(user_id);
CREATE INDEX IF NOT EXISTS journey_analysis_journey_id_idx ON public.journey_analysis(journey_id);
CREATE INDEX IF NOT EXISTS journey_analysis_computed_at_idx ON public.journey_analysis(computed_at DESC);

ALTER TABLE public.journey_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journey_analysis_self_select" ON public.journey_analysis;
CREATE POLICY "journey_analysis_self_select"
  ON public.journey_analysis FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- -------------------------------------------------------------
-- 4. message_templates: admin-managed content library
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,                      -- e.g. "w01_love_map_intro"
  channel     text NOT NULL CHECK (channel IN ('email','sms','whatsapp','task','insight')),
  subject_he  text,
  subject_en  text,
  body_he     text NOT NULL,
  body_en     text NOT NULL,
  variables   jsonb NOT NULL DEFAULT '[]'::jsonb,        -- ["first_name","primary_love_language"]
  trigger_axis text,                                     -- optional: which axis low-score triggers this
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_templates_channel_idx ON public.message_templates(channel);
CREATE INDEX IF NOT EXISTS message_templates_active_idx  ON public.message_templates(is_active);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_templates_admin_all" ON public.message_templates;
CREATE POLICY "message_templates_admin_all"
  ON public.message_templates FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -------------------------------------------------------------
-- 5. engagement_schedules: per-user planned sends
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.engagement_schedules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id  uuid NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','sent','skipped','failed','cancelled')),
  reason       text,                                     -- why this was scheduled ('week_1_love_map', 'manual', etc.)
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  error        text
);

CREATE INDEX IF NOT EXISTS engagement_schedules_user_id_idx ON public.engagement_schedules(user_id);
CREATE INDEX IF NOT EXISTS engagement_schedules_pending_idx
  ON public.engagement_schedules(scheduled_for) WHERE status = 'pending';

ALTER TABLE public.engagement_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "engagement_schedules_self_select" ON public.engagement_schedules;
CREATE POLICY "engagement_schedules_self_select"
  ON public.engagement_schedules FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "engagement_schedules_admin_all" ON public.engagement_schedules;
CREATE POLICY "engagement_schedules_admin_all"
  ON public.engagement_schedules FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -------------------------------------------------------------
-- 6. sent_messages: audit trail of everything sent (email/sms/whatsapp)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sent_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id     uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  schedule_id     uuid REFERENCES public.engagement_schedules(id) ON DELETE SET NULL,
  channel         text NOT NULL CHECK (channel IN ('email','sms','whatsapp','task','insight')),
  subject         text,
  body            text NOT NULL,
  to_address      text NOT NULL,                -- email or phone
  sent_by         text NOT NULL DEFAULT 'system' CHECK (sent_by IN ('system','admin')),
  sent_by_admin   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_id     text,                         -- SendGrid / Twilio message id
  status          text NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('sent','delivered','bounced','failed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sent_messages_user_id_idx ON public.sent_messages(user_id);
CREATE INDEX IF NOT EXISTS sent_messages_created_at_idx ON public.sent_messages(created_at DESC);

ALTER TABLE public.sent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sent_messages_self_select" ON public.sent_messages;
CREATE POLICY "sent_messages_self_select"
  ON public.sent_messages FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "sent_messages_admin_all" ON public.sent_messages;
CREATE POLICY "sent_messages_admin_all"
  ON public.sent_messages FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -------------------------------------------------------------
-- 7. journey_tasks: weekly exercise assignments
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journey_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id  uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  title_he     text NOT NULL,
  title_en     text NOT NULL,
  body_he      text NOT NULL,
  body_en      text NOT NULL,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  due_at       timestamptz,
  status       text NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','done','skipped')),
  done_at      timestamptz,
  assigned_by  text NOT NULL DEFAULT 'system' CHECK (assigned_by IN ('system','admin')),
  notes        text
);

CREATE INDEX IF NOT EXISTS journey_tasks_user_id_idx ON public.journey_tasks(user_id);
CREATE INDEX IF NOT EXISTS journey_tasks_status_idx  ON public.journey_tasks(status);

ALTER TABLE public.journey_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journey_tasks_self" ON public.journey_tasks;
CREATE POLICY "journey_tasks_self"
  ON public.journey_tasks FOR ALL
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- -------------------------------------------------------------
-- 8. user_notes: admin-only notes per user (coach journal)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  body        text NOT NULL,
  is_pinned   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notes_user_id_idx ON public.user_notes(user_id);

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_notes_admin_only" ON public.user_notes;
CREATE POLICY "user_notes_admin_only"
  ON public.user_notes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -------------------------------------------------------------
-- 9. activity_logs: immutable audit trail
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- who did it (admin or same user)
  action     text NOT NULL,                                       -- 'answer_saved', 'paywall_shown', 'subscription_started', 'message_sent', 'task_assigned', 'note_added', 'subscription_cancelled'
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_user_id_idx ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON public.activity_logs(created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_admin_select" ON public.activity_logs;
CREATE POLICY "activity_logs_admin_select"
  ON public.activity_logs FOR SELECT
  USING (public.is_admin() OR user_id = auth.uid());

-- -------------------------------------------------------------
-- 10. Function: link anon journey to user on register
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_journey_to_user(p_device_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.journeys
  SET user_id = auth.uid(),
      last_activity_at = now()
  WHERE device_id = p_device_id
    AND user_id IS NULL
  RETURNING id INTO j_id;

  RETURN j_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_journey_to_user(text) TO authenticated;

-- -------------------------------------------------------------
-- 11. View: admin users list with journey summary
-- -------------------------------------------------------------
CREATE OR REPLACE VIEW public.admin_users_overview AS
SELECT
  u.id               AS user_id,
  u.email,
  u.created_at       AS user_created_at,
  j.id               AS journey_id,
  j.status           AS journey_status,
  j.current_step,
  j.last_activity_at,
  s.status           AS subscription_status,
  s.plan,
  s.current_period_end,
  a.friendship_score,
  a.conflict_health,
  a.passion_risk,
  a.primary_love_language,
  a.top_gap,
  a.four_horsemen_flag,
  (SELECT count(*) FROM public.sent_messages m WHERE m.user_id = u.id) AS messages_sent_count,
  (SELECT count(*) FROM public.journey_tasks t WHERE t.user_id = u.id AND t.status = 'open') AS open_tasks_count
FROM auth.users u
LEFT JOIN LATERAL (
  SELECT * FROM public.journeys j0
  WHERE j0.user_id = u.id
  ORDER BY j0.last_activity_at DESC
  LIMIT 1
) j ON true
LEFT JOIN LATERAL (
  SELECT * FROM public.subscriptions s0
  WHERE s0.user_id = u.id
  ORDER BY s0.created_at DESC
  LIMIT 1
) s ON true
LEFT JOIN LATERAL (
  SELECT * FROM public.journey_analysis a0
  WHERE a0.user_id = u.id
  ORDER BY a0.computed_at DESC
  LIMIT 1
) a ON true;

-- Grant select on view to authenticated; RLS is enforced on underlying tables
GRANT SELECT ON public.admin_users_overview TO authenticated;
