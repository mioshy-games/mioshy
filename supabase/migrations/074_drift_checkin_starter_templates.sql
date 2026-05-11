-- 074_drift_checkin_starter_templates.sql
--
-- Seed starting templates for coach drift check-ins so coaches
-- don't type from scratch the first time.
--
-- Constraint: journey_expert_library is per-coach (expert_id NOT
-- NULL FK to auth.users). We can't insert a "shared" template row
-- without an owner. Two options:
--   A) Insert per-expert (one copy per active coach). Heavy + needs
--      to run on every new expert.
--   B) Add a system-wide table for starter templates, queried
--      separately and injected into the popover.
--
-- For Layer 3 / first ship, B is cleaner. We add a small
-- journey_starter_templates table (no per-expert ownership) that
-- the popover queries alongside the coach's own library. The coach
-- can "save to my library" any starter they like, and the saved
-- copy is then editable.
--
-- Idempotent on re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.journey_starter_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Same kinds as journey_expert_library so the popover can render
  -- both sources uniformly.
  kind        TEXT NOT NULL CHECK (kind IN ('saved_reply','content_pin','couple_note','couple_message','drift_checkin')),
  label_he    TEXT NOT NULL,
  label_en    TEXT NOT NULL,
  body_he     TEXT NOT NULL,
  body_en     TEXT NOT NULL,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  sort_order  INT NOT NULL DEFAULT 100,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journey_starter_templates_kind_idx
  ON public.journey_starter_templates (kind, sort_order)
  WHERE is_active = true;

ALTER TABLE public.journey_starter_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journey_starter_templates_expert_read
  ON public.journey_starter_templates;
CREATE POLICY journey_starter_templates_expert_read
  ON public.journey_starter_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('expert','admin')
    )
  );

DROP POLICY IF EXISTS journey_starter_templates_admin_all
  ON public.journey_starter_templates;
CREATE POLICY journey_starter_templates_admin_all
  ON public.journey_starter_templates FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed: 4 drift-checkin templates. Copy is human-first per the
-- 2026-05-08 standard (no "we noticed", no "celebrate", written
-- in a coach's voice).

INSERT INTO public.journey_starter_templates
  (kind, label_he, label_en, body_he, body_en, tags, sort_order)
VALUES
  ('drift_checkin',
   'חזרה רכה — חיים עמוסים',
   'Soft re-entry — busy life',
   $b$הי לשניכם. עברו כמה שבועות מאז ששמעתי מכם. אני לא בודק/ת אם השלמתם משהו — פשוט רוצה לדעת מה איתכם. מה קורה?$b$,
   $b$Hi to both of you. It's been a few weeks since I heard from you. I'm not checking if you completed anything — just want to know how you are. How's life?$b$,
   ARRAY['drift-checkin','warm']::TEXT[],
   100),

  ('drift_checkin',
   'חזרה רכה — אחרי תקופה קשה',
   'Soft re-entry — hard period',
   $b$הי. עברתם השבועות האחרונים בלי תגובה — וזה בסדר גמור. לפעמים החיים הופכים לעמוסים מדי בשביל "עוד דבר אחד". אני רק רוצה להזכיר שאני פה, גם בלי שתעשו שום דבר. כשבא לכם — נדבר.$b$,
   $b$Hi. You've been quiet these past weeks — and that's completely okay. Sometimes life gets too full for "one more thing." I just want to remind you I'm here, even if you do nothing. When it feels right, we'll talk.$b$,
   ARRAY['drift-checkin','gentle']::TEXT[],
   90),

  ('drift_checkin',
   'שאלה ישירה',
   'Direct question',
   $b$הי. רוצה לשאול אתכם משהו ישיר: האם המסלול שאנחנו עליו מתאים לכם? אין תשובה לא נכונה. אם כן — נמשיך מאיפה שעצרנו. אם לא — נעשה התאמה.$b$,
   $b$Hi. I want to ask you something direct: is this path we're on still right for you? There's no wrong answer. If yes — we'll pick up where we left off. If not — we'll adjust.$b$,
   ARRAY['drift-checkin','direct']::TEXT[],
   80),

  ('drift_checkin',
   'הצעה להפסקה',
   'Suggesting a pause',
   $b$הי. אם בא לכם הפסקה — להשהות לכמה שבועות זה אפשרי, ועדיף מלהיעלם. תוכלו להשהות מהחשבון שלכם. אני אהיה פה כשתחזרו.$b$,
   $b$Hi. If you'd like a break — pausing for a few weeks is an option, and it's better than disappearing. You can pause from your account. I'll be here when you come back.$b$,
   ARRAY['drift-checkin','pause-suggestion']::TEXT[],
   70);

COMMIT;

NOTIFY pgrst, 'reload schema';
