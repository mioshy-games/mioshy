-- 073_match_rule_copy_pass.sql
--
-- Copy pass on the 12 match-rule rationales seeded in migration 066.
-- Itzik flagged the original copy as too AI-feel; this rewrites
-- every rationale in a coach's voice.
--
-- The rules' slugs, kinds, args, and priorities don't change —
-- only label_he/en (admin-facing) and rationale_he/en (user-facing).
-- All UPDATEs are safe to re-run; matching by slug means nothing
-- breaks if the rules table grew between 066 and this migration.

BEGIN;

-- 1. day_one_kickoff
UPDATE public.journey_match_rules
SET label_he     = 'הצעד הראשון',
    label_en     = 'First step',
    rationale_he = $b$הצעד הראשון שלכם. בחרנו אותו כך שתרגישו תנועה מהיום הראשון.$b$,
    rationale_en = $b$Your first step. We chose it so you feel motion from day one.$b$
WHERE slug = 'day_one_kickoff';

-- 2. manual_assignment
UPDATE public.journey_match_rules
SET label_he     = 'בחירה ישירה של המומחה',
    label_en     = 'Picked by your coach',
    rationale_he = $b$המומחה בחר את זה ישירות לכם — לפי משהו שעלה בשיחות שלכם.$b$,
    rationale_en = $b$Your coach picked this directly — based on something that came up in your sessions.$b$
WHERE slug = 'manual_assignment';

-- 3. default_program_kickoff
UPDATE public.journey_match_rules
SET label_he     = 'חלק מהתוכנית שלכם',
    label_en     = 'Part of your program',
    rationale_he = $b$חלק מהתוכנית שנבנתה לכם אחרי האבחון.$b$,
    rationale_en = $b$Part of the program built for you after the assessment.$b$
WHERE slug = 'default_program_kickoff';

-- 4. priority_communication_top1
UPDATE public.journey_match_rules
SET label_he     = 'תקשורת — עדיפות #1',
    label_en     = 'Communication — top priority',
    rationale_he = $b$דירגתם תקשורת ראשונה. אנחנו מתחילים שם.$b$,
    rationale_en = $b$You ranked communication first. That's where we start.$b$
WHERE slug = 'priority_communication_top1';

-- 5. priority_intimacy_top1
UPDATE public.journey_match_rules
SET label_he     = 'אינטימיות — עדיפות #1',
    label_en     = 'Intimacy — top priority',
    rationale_he = $b$דירגתם אינטימיות ראשונה. הצעד הזה מחזיר את החיבור הפיזי והרגשי.$b$,
    rationale_en = $b$You ranked intimacy first. This step is about getting the physical and emotional closeness back.$b$
WHERE slug = 'priority_intimacy_top1';

-- 6. priority_emotional_connection_top1
UPDATE public.journey_match_rules
SET label_he     = 'חיבור רגשי — עדיפות #1',
    label_en     = 'Emotional connection — top priority',
    rationale_he = $b$דירגתם חיבור רגשי ראשון. תרגיל קצר שמעמיק את ההקשבה ביניכם.$b$,
    rationale_en = $b$You ranked emotional connection first. A short exercise to deepen the listening between you.$b$
WHERE slug = 'priority_emotional_connection_top1';

-- 7. priority_friendship_top1
UPDATE public.journey_match_rules
SET label_he     = 'חברות — עדיפות #1',
    label_en     = 'Friendship — top priority',
    rationale_he = $b$דירגתם חברות זוגית ראשונה. נחזיר זמן איכות פשוט ביניכם.$b$,
    rationale_en = $b$You ranked friendship first. Let's bring some simple quality time back between you.$b$
WHERE slug = 'priority_friendship_top1';

-- 8. priority_family_top1
UPDATE public.journey_match_rules
SET label_he     = 'משפחה ולחצים — עדיפות #1',
    label_en     = 'Family pressures — top priority',
    rationale_he = $b$דירגתם משפחה ראשונה. הצעד הזה מתעסק בלחצים שמשפיעים עליכם כזוג.$b$,
    rationale_en = $b$You ranked family first. This step is about the pressures shaping you as a couple.$b$
WHERE slug = 'priority_family_top1';

-- 9. low_conflict_score
UPDATE public.journey_match_rules
SET label_he     = 'התמודדות עם קונפליקטים — נקודה לחיזוק',
    label_en     = 'Conflict handling — to strengthen',
    rationale_he = $b$הקונפליקטים יצאו אצלכם נקודה לחיזוק. כלי קונקרטי לרגעים מתוחים.$b$,
    rationale_en = $b$Conflict handling came up as something to work on. A concrete tool for tense moments.$b$
WHERE slug = 'low_conflict_score';

-- 10. low_passion_score
UPDATE public.journey_match_rules
SET label_he     = 'תשוקה וחיוניות — נקודה לחיזוק',
    label_en     = 'Passion & vitality — to strengthen',
    rationale_he = $b$אמרתם שהתשוקה ביניכם דעכה לאחרונה. צעד שמחזיר חיים — בלי לחץ.$b$,
    rationale_en = $b$You said the spark has dimmed lately. A step that brings life back — no pressure.$b$
WHERE slug = 'low_passion_score';

-- 11. expert_recommendation
UPDATE public.journey_match_rules
SET label_he     = 'המלצה ישירה מהמומחה',
    label_en     = 'Direct from your coach',
    rationale_he = $b$המומחה ראה משהו בתשובות שלכם והמליץ על הפריט הזה — דווקא עכשיו.$b$,
    rationale_en = $b$Your coach saw something in your responses and recommended this — for right now.$b$
WHERE slug = 'expert_recommendation';

-- 12. partner_response_followup
UPDATE public.journey_match_rules
SET label_he     = 'המשך לשיחה הקודמת',
    label_en     = 'Follow-up to your last reflection',
    rationale_he = $b$המשך ישיר למה שכתבתם בשבוע שעבר. ממשיכים מאיפה שעצרנו.$b$,
    rationale_en = $b$A direct follow-up to what you wrote last week. Picking up where you left off.$b$
WHERE slug = 'partner_response_followup';

COMMIT;

NOTIFY pgrst, 'reload schema';
