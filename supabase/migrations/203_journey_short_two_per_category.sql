-- ───────────────────────────────────────────────────────────────────────────
-- 203_journey_short_two_per_category.sql
--
-- RUN AFTER 202_journey_questions_axes_sync.sql. 199 makes journey_questions.axes
-- agree with the live scoring config; this migration reads as if it already does.
--
-- Rebuild the SHORT assessment as exactly two scored questions per category —
-- ten scored questions, ten distinct axes, no redundancy.
--
-- WHY
-- ---
-- After 195-198 the short set was 16 questions but unevenly built: family had
-- FOUR scored questions covering only TWO axes (q02 and q17 both on
-- shared_meaning, q24 and q_family_quality_presence both on passion_context),
-- while friendship scraped by on the minimum. Four questions buying the same
-- coverage as two is length the funnel pays for and the report does not use.
--
-- THE RULES APPLIED (Itzik, 2026-08-13)
--   • Two scored questions per category, each on a DIFFERENT axis. Two questions
--     on one axis leaves the category at one axis, which is the engine's own
--     insufficiency threshold — exactly family's problem today.
--   • Pick the pair that best CHARACTERISES the category, not the pair that
--     happens to be there.
--   • Where the audit verified a question's Hebrew and axis agree, prefer it
--     over one flagged directionally off. This is why q25_gratitude_expressed
--     carries fondness rather than q11_contempt, and why neither turn_toward
--     question is used: q03 measures turn-toward RECEIVED and q26 measures it
--     MUTUALLY, both flagged in the audit.
--   • q20_biggest_gap does not count toward the two. It is single-choice, so a
--     respondent contributes exactly one of its six axes — it cannot be a
--     reliable floor. It stays in short as a bonus signal.
--   • No skip-fallback logic. Someone who skips gets a less precise score and
--     the results page says so plainly. The full assessment is where the
--     complete picture lives. That is the product design, not an error state.
--
-- THE TEN
--   מיניות ואינטימיות        q01_knowledge_world      intimacy_presence
--                            q31_touch_nonsexual      love_language_touch
--   תקשורת זוגית             q09_repair_recovery      repair
--                            q30_contempt_v2          four_horsemen_contempt
--   משפחה, הורות ולחצים      q33_external_pressure    external_pressure (reverse)
--                            q34_load_fairness        load_fairness
--   אהבה וחיבור רגשי         q25_gratitude_expressed  fondness
--                            q19_rituals              emotional_safety
--   חברות ושותפות יומיומית   q16_play                 passion_play
--                            q32_love_map_v2          love_map
--
-- Because love_map and passion_play each sit in two category lists, intimacy
-- and emotional connection end up on THREE covered axes rather than two. No
-- category is below two.
--
-- Family finally measures what it is named for. Its previous short pair scored
-- shared_meaning and passion_context — neither of which is about parenting or
-- outside pressure — while the two questions that do measure those sat in full.
--
-- SCORING IS UNTOUCHED. This migration only moves `phase`. No axis, no Hebrew,
-- no option, no version row changes. Everyone's stored answers keep resolving
-- through journey_question_versions exactly as before.
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

-- Snapshot current phases so the rollback is exact rather than reconstructed.
CREATE TABLE IF NOT EXISTS public.journey_questions_phase_backup_203 AS
SELECT slug, phase FROM public.journey_questions;

-- ── into SHORT ─────────────────────────────────────────────────────────────
UPDATE public.journey_questions SET phase = 'short', updated_at = now()
WHERE slug IN (
  'q25_gratitude_expressed',   -- fondness      (audit: Hebrew and axis agree)
  'q31_touch_nonsexual',       -- love_language_touch
  'q33_external_pressure',     -- external_pressure
  'q34_load_fairness'          -- load_fairness
) AND phase <> 'short';

-- ── out to FULL ────────────────────────────────────────────────────────────
-- Every one of these is REDUNDANT in short, not unwanted: its axis is already
-- covered by a question that characterises the category better, or it duplicates
-- an axis another short question already supplies.
UPDATE public.journey_questions SET phase = 'full', updated_at = now()
WHERE slug IN (
  'q02_admiration_see_good',   -- shared_meaning — duplicated q17; "united team"
                               --   was only an approximate fit for the axis
  'q17_context_logistics',     -- shared_meaning — family now measured by q33/q34
  'q24_physical_closeness',    -- passion_context — duplicated q_family_quality
  'q_family_quality_presence', -- passion_context — same axis as q24
  'q11_contempt',              -- fondness — q25 carries it and was audit-verified
  'q15_anticipation',          -- passion_anticipation — intimacy has 3 axes without it
  'q20b_intimacy_satisfaction' -- no axis; only padded the intimacy coverage count
) AND phase <> 'full';

COMMIT;

-- ── WHAT STAYS IN SHORT ────────────────────────────────────────────────────
-- The ten scored above, plus three structural questions that carry no axis and
-- are NOT part of the count:
--   q_gender          tailors downstream content
--   q_priorities      drives the priority narrative and content selection
--   q20_biggest_gap   the bonus signal, per the rules above
-- Short becomes 13 questions, 10 of them scored.
--
-- FLAGGED FOR ITZIK: "everything else goes to full" could be read as moving
-- q_gender and q_priorities out too. They are kept because neither is a scored
-- question and both feed things outside the five categories — removing
-- q_priorities would break the priority narrative that selects a person's
-- content. Say the word and they move.

-- ── VERIFY ─────────────────────────────────────────────────────────────────
--   SELECT phase, count(*) FROM journey_questions WHERE is_active GROUP BY phase;
--   -- expect short 13, full 21
--   SELECT slug FROM journey_questions
--   WHERE is_active AND phase='short' AND jsonb_array_length(coalesce(axes,'[]'::jsonb)) > 0;
--   -- expect the ten above

-- ── ROLLBACK ───────────────────────────────────────────────────────────────
-- UPDATE public.journey_questions q SET phase = b.phase, updated_at = now()
--   FROM public.journey_questions_phase_backup_203 b WHERE q.slug = b.slug;
-- DROP TABLE public.journey_questions_phase_backup_203;
