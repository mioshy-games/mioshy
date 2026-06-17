-- ───────────────────────────────────────────────────────────────────────────
-- diagnostic_honesty_challenge_category.sql
--
-- Pinpoints the "stopping on one category shows the other category's question"
-- bug in the wheel game "כנות ואתגר" (slug 'honesty-or-challenge').
--
-- WHY THIS IS A DATA QUERY, NOT A CODE BUG
-- ────────────────────────────────────────
-- The runtime pipeline is type-consistent end to end:
--   • The wheel reports the slice it VISUALLY landed on
--     (Wheel.tsx settle → indexAtPointer(targetRot); the same targetRot drives
--      the CSS transform, so visual == reported, always).
--   • TruthOrDareClient.handleSettled fetches a question via
--     pickNextQuestion(reportedType), which filters `q.type === reportedType`.
--   • So the question shown ALWAYS has q.type == the landed slice's
--     question_type. The code cannot cross categories.
-- Therefore the only way the player sees "אתגר" but gets an honesty question is
-- a DATA mismatch in this game's admin-entered rows. This script finds it.
--
-- Run in Supabase Dashboard → SQL Editor (service-role). Read-only.
-- ───────────────────────────────────────────────────────────────────────────

-- ── Q1. Wheel slices: the LABEL the player sees vs the question_type used to
--        fetch the question. These two must be semantically aligned per slice.
with g as (
  select id, slug, name_he
  from public.games
  where slug = 'honesty-or-challenge' or name_he = 'כנות ואתגר'
  order by (slug = 'honesty-or-challenge') desc
  limit 1
)
select
  (s->>'label_he')      as slice_label_he,   -- what the player reads on the slice
  (s->>'label_en')      as slice_label_en,
  (s->>'question_type') as slice_question_type, -- the pool key used to fetch a question
  (s->>'color')         as color
from g
join public.wheel_configs wc on wc.game_id = g.id
cross join lateral jsonb_array_elements(wc.slices) as s;

-- ── Q2. Question pool for this game: count + a sample per type. The `type`
--        strings here must EXACTLY equal the slice_question_type values above,
--        and each sample text must match its type's meaning (truth = something
--        to answer; dare/challenge = an action to perform).
with g as (
  select id
  from public.games
  where slug = 'honesty-or-challenge' or name_he = 'כנות ואתגר'
  order by (slug = 'honesty-or-challenge') desc
  limit 1
)
select
  q.type,
  count(*)        as active_questions,
  min(q.text_he)  as sample_text_he
from g
join public.questions q on q.game_id = g.id and q.is_active
group by q.type
order by q.type;

-- ── HOW TO READ THE RESULT (definition of done for the diagnosis) ───────────
-- Look at Q1 row by row and compare label ↔ question_type:
--   EXPECTED (healthy):  label_he 'כנות'  → question_type = the truth/honesty pool
--                        label_he 'אתגר' → question_type = the dare/challenge pool
--   BUG CASE 1 (swap):   label_he 'אתגר' but question_type points at the honesty
--                        pool (and/or 'כנות' points at the dare pool). → the slice
--                        question_type values are swapped relative to the labels.
-- Cross-check with Q2:
--   • Every slice_question_type from Q1 MUST appear as a `type` in Q2 (else the
--     player would get NO question, not the wrong one).
--   BUG CASE 2 (content):  the question_type ↔ label line up, but the sample_text
--                          under a type reads like the OTHER category (questions
--                          were filed under the wrong type).
--
-- Paste both result sets back and the corrective migration will be exact:
--   • Case 1 → UPDATE wheel_configs.slices to swap the two question_type values.
--   • Case 2 → UPDATE public.questions SET type = ... for the mis-filed rows.
