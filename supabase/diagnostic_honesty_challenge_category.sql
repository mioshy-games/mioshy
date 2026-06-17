-- ───────────────────────────────────────────────────────────────────────────
-- diagnostic_honesty_challenge_category.sql
--
-- Pinpoints the "stopping on one category shows the other category's question"
-- bug across ALL wheel games (the catalogue games are clones of one another, so
-- the same admin-entered mismatch likely repeats in every one — not only
-- "כנות ואתגר" / honesty-or-challenge).
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
-- a DATA mismatch in the admin-entered rows. This script finds it, per game.
--
-- Scope = every game that has a wheel_config (the wheel-game catalogue). Snakes
-- is excluded automatically (it has no public.games row).
--
-- Run in Supabase Dashboard → SQL Editor (service-role). Read-only.
-- ───────────────────────────────────────────────────────────────────────────

-- ── Q1. Every wheel game's slices: the LABEL the player sees vs the
--        question_type used to fetch a question. Must be aligned per slice.
select
  g.slug                                          as game_slug,
  g.name_he                                       as game_name_he,
  s.ord                                           as slice_index,
  (s.val->>'label_he')                            as slice_label_he,
  (s.val->>'label_en')                            as slice_label_en,
  (s.val->>'question_type')                       as slice_question_type
from public.games g
join public.wheel_configs wc on wc.game_id = g.id
cross join lateral jsonb_array_elements(wc.slices) with ordinality as s(val, ord)
order by g.slug, s.ord;

-- ── Q2. Each wheel game's question pool: count + a sample per type. The `type`
--        strings here must EXACTLY equal the slice_question_type values in Q1,
--        and each sample text must match its type's meaning (truth = something
--        to answer; dare/challenge = an action to perform).
select
  g.slug          as game_slug,
  q.type,
  count(*)        as active_questions,
  min(q.text_he)  as sample_text_he
from public.games g
join public.questions q on q.game_id = g.id and q.is_active
group by g.slug, q.type
order by g.slug, q.type;

-- ── Q3. The money query — per game, per slice: the displayed label next to a
--        sample question that WOULD actually be fetched for that slice
--        (filtered by the slice's question_type). Read each row: if the label
--        and the sample read like DIFFERENT categories, that slice is the bug.
--        `matching_questions = 0` flags a slice that would show NO question.
select
  g.slug                                          as game_slug,
  s.ord                                           as slice_index,
  (s.val->>'label_he')                            as slice_label_he,
  (s.val->>'question_type')                       as slice_question_type,
  (select count(*) from public.questions q
     where q.game_id = g.id and q.is_active
       and q.type = s.val->>'question_type')      as matching_questions,
  (select min(q.text_he) from public.questions q
     where q.game_id = g.id and q.is_active
       and q.type = s.val->>'question_type')      as sample_of_that_type
from public.games g
join public.wheel_configs wc on wc.game_id = g.id
cross join lateral jsonb_array_elements(wc.slices) with ordinality as s(val, ord)
order by g.slug, s.ord;

-- ── HOW TO READ THE RESULT (definition of done for the diagnosis) ───────────
-- Q3 is usually enough on its own. For each row, compare slice_label_he with
-- sample_of_that_type:
--   HEALTHY:  label 'כנות'  → sample is a question to ANSWER (honesty)
--             label 'אתגר' → sample is an ACTION to perform (dare/challenge)
--   BUG CASE 1 (label↔type swap): label 'אתגר' but sample reads like honesty
--             (and/or 'כנות' returns a dare). The slice question_type values are
--             swapped relative to the labels. → fix on the slices side.
--   BUG CASE 2 (mis-filed questions): labels↔types line up, but sample_of_that_type
--             reads like the OTHER category. → fix on the questions side.
--   matching_questions = 0 → that slice would show no question at all.
--
-- Paste the result back. The corrective migration will then cover EVERY
-- affected game in one pass:
--   • Case 1 → UPDATE public.wheel_configs SET slices = (swap the two
--              question_type values) for each affected game.
--   • Case 2 → UPDATE public.questions SET type = ... for the mis-filed rows.
