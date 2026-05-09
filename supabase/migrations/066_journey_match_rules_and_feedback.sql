-- 066_journey_match_rules_and_feedback.sql
--
-- Pre-Layer-1 governance + Layer-1 foundation for the listening layer.
--
-- Adds three things:
--   1. journey_match_rules — registry of named rules. For Layer 1 the
--      table only needs to register WHO matched what (label + rationale
--      shown to user). Full DSL evaluation lands in V2 (see Part 4 of
--      docs/journey-execution-architecture-2026-05-08.md).
--   2. journey_scheduled_items.matched_by_rule_id — FK back to the rule
--      that produced this scheduled item. Enables "Why this item?" on
--      the user side and rule traces on the admin side.
--   3. journey_item_feedback — per-item user feedback (4 buckets).
--      Drives downstream content quality + later, the matching engine.
--
-- All three ship together because they form one coherent layer: every
-- match rule emits items, every item gets feedback, every feedback
-- attributes back to a rule. Layer 1 cannot launch without all three.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. journey_match_rules
-- ---------------------------------------------------------------------------

CREATE TABLE public.journey_match_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  label_he      TEXT NOT NULL,
  label_en      TEXT NOT NULL,
  -- Shown verbatim to the user under the item title.
  -- Keep under ~80 chars to render cleanly on mobile.
  rationale_he  TEXT NOT NULL,
  rationale_en  TEXT NOT NULL,
  -- Names a built-in matcher implementation. Layer 1 has 4 builtins:
  --   'manual'           — set by admin / expert action
  --   'auto_purchase'    — emitted by assignJourneyOnPurchase
  --   'priority_top1'    — emitted by priority routing
  --   'system_default'   — fallback / catch-all
  -- More join here in V2 when DSL ships.
  matcher_kind  TEXT NOT NULL,
  -- Free-form args for the matcher (e.g. priority_top1 carries
  -- {"priority_key": "communication"}).
  matcher_args  JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  -- Higher priority evaluated first when multiple rules match.
  priority      INT NOT NULL DEFAULT 100,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX journey_match_rules_active_idx
  ON public.journey_match_rules (is_active, priority DESC);

CREATE INDEX journey_match_rules_kind_idx
  ON public.journey_match_rules (matcher_kind);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_journey_match_rules_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER journey_match_rules_touch
  BEFORE UPDATE ON public.journey_match_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_journey_match_rules_touch();

-- RLS — admin-only read/write. Users never query this directly; the
-- rationale travels through journey_scheduled_items JOINs.
ALTER TABLE public.journey_match_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY journey_match_rules_admin_all
  ON public.journey_match_rules
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Service role bypasses RLS — used by the cadence engine.
COMMENT ON TABLE public.journey_match_rules IS
  'Registry of named match rules that produce journey_scheduled_items. Full DSL in V2; Layer 1 ships with 12 hand-coded rules referenced by slug.';


-- ---------------------------------------------------------------------------
-- 2. journey_scheduled_items.matched_by_rule_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.journey_scheduled_items
  ADD COLUMN matched_by_rule_id UUID
    REFERENCES public.journey_match_rules(id) ON DELETE SET NULL;

CREATE INDEX journey_scheduled_items_matched_rule_idx
  ON public.journey_scheduled_items (matched_by_rule_id);

COMMENT ON COLUMN public.journey_scheduled_items.matched_by_rule_id IS
  'The rule that produced this scheduled item. NULL for legacy rows pre-migration 066. Drives "Why this item?" disclosure.';


-- ---------------------------------------------------------------------------
-- 3. journey_item_feedback
-- ---------------------------------------------------------------------------

CREATE TABLE public.journey_item_feedback (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_item_id  UUID NOT NULL
    REFERENCES public.journey_scheduled_items(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 4 buckets — keep tight; richer feedback comes through the per-item
  -- thread, not this row. UI maps:
  --   'helpful'            — עזר ✨ / Helpful
  --   'neutral'            — סבבה / Fine
  --   'not_for_us'         — לא לנו / Not for us
  --   'made_things_worse'  — החמיר / Made things worse
  rating             TEXT NOT NULL CHECK (
    rating IN ('helpful','neutral','not_for_us','made_things_worse')
  ),
  -- Optional free text, prompted only when rating is negative.
  optional_text      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One row per (item, user) — UPSERT replaces on resubmit.
  UNIQUE (scheduled_item_id, user_id)
);

CREATE INDEX journey_item_feedback_item_idx
  ON public.journey_item_feedback (scheduled_item_id);

CREATE INDEX journey_item_feedback_user_idx
  ON public.journey_item_feedback (user_id);

CREATE INDEX journey_item_feedback_rating_idx
  ON public.journey_item_feedback (rating);

ALTER TABLE public.journey_item_feedback ENABLE ROW LEVEL SECURITY;

-- Users see + insert their own feedback.
CREATE POLICY journey_item_feedback_user_select_own
  ON public.journey_item_feedback FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY journey_item_feedback_user_insert_own
  ON public.journey_item_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY journey_item_feedback_user_update_own
  ON public.journey_item_feedback FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Experts see feedback from their assigned couples (via the scheduled
-- item's assignment → owner → couple_id).
CREATE POLICY journey_item_feedback_expert_read
  ON public.journey_item_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.journey_scheduled_items si
      JOIN public.journey_assignments a ON a.id = si.assignment_id
      WHERE si.id = journey_item_feedback.scheduled_item_id
        AND a.couple_id IS NOT NULL
        AND public.is_expert_for_couple(a.couple_id)
    )
  );

-- Admins see all feedback.
CREATE POLICY journey_item_feedback_admin_all
  ON public.journey_item_feedback
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.journey_item_feedback IS
  'User feedback per scheduled item. 4 buckets, optional text. Drives content-quality dashboards and Layer 4+ matching learning.';


-- ---------------------------------------------------------------------------
-- 4. Seed 12 hand-coded match rules
-- ---------------------------------------------------------------------------
-- These are the rules Layer 1 ships with. The system attaches one of
-- these to every newly-created scheduled item via materialize.ts (next
-- code change). Existing scheduled_items get their rule attribution
-- via the backfill migration that runs after this one.
--
-- Rationale text is what the USER reads. Keep it warm, specific,
-- under 80 chars where possible.

INSERT INTO public.journey_match_rules
  (slug, label_he, label_en, rationale_he, rationale_en, matcher_kind, matcher_args, priority)
VALUES
  -- 1
  ('day_one_kickoff',
   'הצעד הראשון של המסע',
   'Day-one kickoff',
   $b$הצעד הראשון של המסע שלכם — בחרנו אותו כך שתוכלו להרגיש תנועה מהיום הראשון.$b$,
   $b$Your first step on this journey — we chose it so you can feel forward motion from day one.$b$,
   'auto_purchase', '{"override":"day_one"}'::jsonb, 200),

  -- 2
  ('manual_assignment',
   'בחירה אישית של המומחה',
   'Hand-picked by your coach',
   $b$המומחה שלכם בחר את הפריט הזה עבורכם, כי הוא מתאים בדיוק למה שעולה אצלכם עכשיו.$b$,
   $b$Your coach hand-picked this for you — it fits exactly what's coming up between you right now.$b$,
   'manual', '{}'::jsonb, 250),

  -- 3
  ('default_program_kickoff',
   'חלק מהתוכנית הראשונית',
   'Part of your starting program',
   $b$חלק מתוכנית הליווי שהותאמה לכם בעקבות האבחון.$b$,
   $b$Part of the coaching program tailored to you after the assessment.$b$,
   'auto_purchase', '{}'::jsonb, 100),

  -- 4
  ('priority_communication_top1',
   'תקשורת זוגית — עדיפות #1',
   'Communication — priority #1',
   $b$דירגתם תקשורת זוגית במקום הראשון, ולכן הצעדים הראשונים שלכם בונים את התשתית של תקשורת בריאה.$b$,
   $b$You ranked communication #1, so your early steps build the foundation of healthy communication together.$b$,
   'priority_top1', '{"priority_key":"communication"}'::jsonb, 150),

  -- 5
  ('priority_intimacy_top1',
   'אינטימיות — עדיפות #1',
   'Intimacy — priority #1',
   $b$דירגתם אינטימיות במקום הראשון, ולכן בחרנו פריט שעוזר לחזק חיבור פיזי ורגשי.$b$,
   $b$You ranked intimacy #1, so we chose something to help strengthen physical and emotional closeness.$b$,
   'priority_top1', '{"priority_key":"intimacy"}'::jsonb, 150),

  -- 6
  ('priority_emotional_connection_top1',
   'חיבור רגשי — עדיפות #1',
   'Emotional connection — priority #1',
   $b$דירגתם חיבור רגשי במקום הראשון, ולכן בחרנו צעד שמעמיק את ההקשבה ביניכם.$b$,
   $b$You ranked emotional connection #1, so we chose a step that deepens the listening between you.$b$,
   'priority_top1', '{"priority_key":"emotional_connection"}'::jsonb, 150),

  -- 7
  ('priority_friendship_top1',
   'חברות זוגית — עדיפות #1',
   'Friendship — priority #1',
   $b$דירגתם חברות זוגית במקום הראשון, ולכן בחרנו צעד שמחזיר זמן איכות פשוט ביניכם.$b$,
   $b$You ranked friendship #1, so we chose a step that brings simple quality time back into your routine.$b$,
   'priority_top1', '{"priority_key":"friendship"}'::jsonb, 150),

  -- 8
  ('priority_family_top1',
   'משפחה ולחצים פנימיים — עדיפות #1',
   'Family pressures — priority #1',
   $b$דירגתם משפחה במקום הראשון, ולכן הצעד הראשון מתמקד בלחצים שמשפיעים עליכם כזוג.$b$,
   $b$You ranked family #1, so the first step focuses on the pressures shaping you as a couple.$b$,
   'priority_top1', '{"priority_key":"family"}'::jsonb, 150),

  -- 9
  ('low_conflict_score',
   'התמודדות עם קונפליקטים — נקודה לחיזוק',
   'Conflict handling — area to strengthen',
   $b$התמודדות עם קונפליקטים עלתה כנקודה לחיזוק. הפריט הזה נותן כלי קונקרטי לרגעים מתוחים.$b$,
   $b$Conflict handling came up as an area to strengthen. This piece gives you a concrete tool for tense moments.$b$,
   'system_default', '{"axis":"conflict","threshold":40}'::jsonb, 120),

  -- 10
  ('low_passion_score',
   'תשוקה וחיוניות — נקודה לחיזוק',
   'Passion & vitality — area to strengthen',
   $b$אותתתם שתחושת התשוקה ביניכם דעכה לאחרונה. בחרנו צעד שמחזיר רוח חיים, בלי לחץ.$b$,
   $b$You signalled that the spark between you has dimmed lately. We chose a step that brings life back, without pressure.$b$,
   'system_default', '{"axis":"passion","threshold":60}'::jsonb, 120),

  -- 11
  ('expert_recommendation',
   'המלצה ישירה מהמומחה שלכם',
   'Direct recommendation from your coach',
   $b$המומחה שלכם זיהה משהו בתשובות שלכם והמליץ לדחוף את הפריט הזה דווקא עכשיו.$b$,
   $b$Your coach noticed something in your responses and recommended this piece for right now.$b$,
   'manual', '{"source":"expert_push"}'::jsonb, 220),

  -- 12
  ('partner_response_followup',
   'המשך לשיחה הקודמת ביניכם',
   'Follow-up to your last reflection',
   $b$הפריט הזה מתחבר ישירות למה שכתבתם בשבוע שעבר. נמשיך מהמקום שבו עצרנו.$b$,
   $b$This connects directly to what you wrote last week. We pick up where you left off.$b$,
   'system_default', '{"trigger":"recent_response"}'::jsonb, 110);


-- ---------------------------------------------------------------------------
-- 5. Backfill matched_by_rule_id for existing scheduled_items
-- ---------------------------------------------------------------------------
-- Strategy: every existing row gets the most plausible rule based on
-- the assignment's origin. NULL stays only for rows we genuinely can't
-- attribute (which the UI handles gracefully).

-- 5a. Day-1 override rows
UPDATE public.journey_scheduled_items si
SET matched_by_rule_id = (SELECT id FROM public.journey_match_rules WHERE slug = 'day_one_kickoff')
WHERE si.matched_by_rule_id IS NULL
  AND si.has_unlock_override = TRUE;

-- 5b. Manual admin assignments
UPDATE public.journey_scheduled_items si
SET matched_by_rule_id = (SELECT id FROM public.journey_match_rules WHERE slug = 'manual_assignment')
FROM public.journey_assignments a
WHERE si.assignment_id = a.id
  AND si.matched_by_rule_id IS NULL
  AND a.origin = 'admin_manual';

-- 5c. Auto-purchase assignments — default program rule
UPDATE public.journey_scheduled_items si
SET matched_by_rule_id = (SELECT id FROM public.journey_match_rules WHERE slug = 'default_program_kickoff')
FROM public.journey_assignments a
WHERE si.assignment_id = a.id
  AND si.matched_by_rule_id IS NULL
  AND a.origin = 'purchase';

-- 5d. Anything left untagged stays NULL — the UI falls back gracefully.

COMMIT;

-- Reload PostgREST schema cache so the new columns/tables are visible
-- to the API immediately. Without this, the first admin write fails
-- with a "schema cache" error.
NOTIFY pgrst, 'reload schema';
