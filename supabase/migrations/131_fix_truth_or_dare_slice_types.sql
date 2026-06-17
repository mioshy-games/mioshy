-- ───────────────────────────────────────────────────────────────────────────
-- 131_fix_truth_or_dare_slice_types.sql
--
-- Fixes the "stopping on one category shows the other category's question" bug
-- in the wheel game `truth-or-dare` ONLY.
--
-- Diagnosis (diagnostic_honesty_challenge_category.sql): the runtime pipeline
-- is type-consistent — the wheel reports the slice it visually lands on and the
-- question is fetched by that slice's question_type. The fault was DATA: in
-- truth-or-dare's wheel_configs.slices the two question_type values were
-- swapped relative to the labels —
--     slice "חובה" (dare)  → question_type "Truth"   (should be "Dare")
--     slice "אמת"  (truth) → question_type "Dare"    (should be "Truth")
-- so the wheel fetched the OPPOSITE category's question.
--
-- The questions (public.questions) are tagged correctly — DO NOT touch them.
-- honesty-or-challenge and never-have-i-ever were verified healthy and are NOT
-- touched (the slug filter below scopes this to truth-or-dare only).
--
-- Idempotent: each branch fires only on the exact wrong (label, question_type)
-- pairing, so re-running after the fix is a no-op. All other slice fields and
-- slice order are preserved (jsonb_set touches only question_type).
-- ───────────────────────────────────────────────────────────────────────────

UPDATE public.wheel_configs wc
SET slices = (
  SELECT jsonb_agg(
           CASE
             WHEN elem->>'label_he' = 'חובה' AND elem->>'question_type' = 'Truth'
               THEN jsonb_set(elem, '{question_type}', '"Dare"')
             WHEN elem->>'label_he' = 'אמת'  AND elem->>'question_type' = 'Dare'
               THEN jsonb_set(elem, '{question_type}', '"Truth"')
             ELSE elem
           END
           ORDER BY ord
         )
  FROM jsonb_array_elements(wc.slices) WITH ORDINALITY AS t(elem, ord)
)
FROM public.games g
WHERE g.id = wc.game_id
  AND g.slug = 'truth-or-dare';
