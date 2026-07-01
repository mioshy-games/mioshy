-- 156_journey_priorities_subline_copy.sql
--
-- Journey assessment light-theme redesign (2026-07-01,
-- docs/journey-assessment-redesign-workorder.md §3).
--
-- The priority-ranking step (slug 'q_priorities') is the source of truth for
-- its own hint copy via journey_questions.meta.he_subline / en_subline (read by
-- lib/journey/questions-db.ts → PriorityRankingStep). The redesign makes DRAG
-- the primary reorder interaction, so Itzik updated the Hebrew hint to speak in
-- drag terms:
--
--   "ניתן לגרור ולשנות את הסדר החשוב לך."
--
-- We merge (||) only the two subline keys so purpose/insight/categories in the
-- same meta blob are preserved untouched. Idempotent — re-running just re-sets
-- the same two keys.

UPDATE public.journey_questions
SET meta = meta || jsonb_build_object(
      'he_subline', 'ניתן לגרור ולשנות את הסדר החשוב לך.',
      'en_subline', 'Drag to reorder by what matters most to you.'
    )
WHERE slug = 'q_priorities'
  AND type = 'ranking';
