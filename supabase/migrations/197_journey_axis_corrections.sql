-- ───────────────────────────────────────────────────────────────────────────
-- 197_journey_axis_corrections.sql
--
-- Point each rewritten question's axis at what its Hebrew actually asks.
--
-- SCOPE: journey_question_versions v2 ONLY — the era from the rewrite onward.
-- v1 is deliberately untouched: in that era the text and the axis agreed, the
-- answers were scored correctly, and re-pointing them would be the same class
-- of error we are fixing, aimed the other way. This is what makes the
-- invariance test meaningful: every answer given before 2026-07-01 must score
-- byte-identically before and after this migration.
--
-- The Hebrew is authoritative and is NOT edited here. Not one character of
-- he_text changes in this file. People answered what was on screen.
--
-- Mapping approved by Itzik. Rationale per question is in the audit; the short
-- version is that each `to` axis is what the displayed Hebrew measures.
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

-- Snapshot the pre-correction axes so the rollback is exact rather than
-- reconstructed. Dropping this table is the last step of a rollback.
CREATE TABLE IF NOT EXISTS public.journey_question_versions_axes_backup_197 AS
SELECT id, slug, version, axes, options
FROM public.journey_question_versions
WHERE version = 2
  AND slug IN ('q11_contempt','q17_context_logistics','q01_knowledge_world',
               'q19_rituals','q02_admiration_see_good','q24_physical_closeness',
               'q20_biggest_gap');

-- ── likert questions: single-axis replacements ─────────────────────────────
-- q11: Hebrew asks how often you EXPRESS APPRECIATION. Scored onto contempt it
-- inverted the meaning — more warmth produced a worse result.
UPDATE public.journey_question_versions
SET axes = $j$[{"axis":"fondness","weight":1}]$j$::jsonb,
    note = coalesce(note,'') || ' | 197: four_horsemen_contempt → fondness'
WHERE slug = 'q11_contempt' AND version = 2;

-- q17: Hebrew asks whether you have small rituals unique to you — a POSITIVE
-- item that was carrying a reverse weight on passion_context.
UPDATE public.journey_question_versions
SET axes = $j$[{"axis":"shared_meaning","weight":1}]$j$::jsonb,
    note = coalesce(note,'') || ' | 197: passion_context(-1) → shared_meaning(+1)'
WHERE slug = 'q17_context_logistics' AND version = 2;

-- q01: Hebrew asks about slowing down during sex and staying with bodily
-- sensation. No existing axis covered it; intimacy_presence is new.
UPDATE public.journey_question_versions
SET axes = $j$[{"axis":"intimacy_presence","weight":1}]$j$::jsonb,
    note = coalesce(note,'') || ' | 197: love_map → intimacy_presence (new axis)'
WHERE slug = 'q01_knowledge_world' AND version = 2;

-- q19: Hebrew asks how safe you feel revealing your innermost fears.
UPDATE public.journey_question_versions
SET axes = $j$[{"axis":"emotional_safety","weight":1}]$j$::jsonb,
    note = coalesce(note,'') || ' | 197: shared_meaning → emotional_safety (new axis)'
WHERE slug = 'q19_rituals' AND version = 2;

-- q02: Hebrew asks whether you act as a united team.
UPDATE public.journey_question_versions
SET axes = $j$[{"axis":"shared_meaning","weight":1}]$j$::jsonb,
    note = coalesce(note,'') || ' | 197: fondness → shared_meaning'
WHERE slug = 'q02_admiration_see_good' AND version = 2;

-- q24: Hebrew asks about evening energy for romance, not physical touch.
UPDATE public.journey_question_versions
SET axes = $j$[{"axis":"passion_context","weight":1}]$j$::jsonb,
    note = coalesce(note,'') || ' | 197: love_language_touch+passion_play → passion_context'
WHERE slug = 'q24_physical_closeness' AND version = 2;

-- q03_bids_turn_toward and q26_partner_texts_unprompted: axis UNCHANGED.
-- q03's Hebrew measures turn-toward RECEIVED rather than given, and q26's is
-- mutual rather than partner-initiated. Same construct, different direction —
-- recorded here so the next reader knows it was considered, not missed.
UPDATE public.journey_question_versions
SET note = coalesce(note,'') || ' | 197: axis kept; Hebrew measures RECEIVED turn-toward'
WHERE slug = 'q03_bids_turn_toward' AND version = 2;
UPDATE public.journey_question_versions
SET note = coalesce(note,'') || ' | 197: axis kept; Hebrew is MUTUAL contact'
WHERE slug = 'q26_partner_texts_unprompted' AND version = 2;

-- ── q20_biggest_gap: labels stay, per-option scores move to match them ─────
-- The option ids and English were left correct while the Hebrew labels were
-- shuffled, so `passion` reads "really know each other" and `knowing` reads
-- "more passion". Ids and Hebrew are preserved exactly; only `scores` move.
UPDATE public.journey_question_versions
SET options = $j$[
  {"id":"knowing","he":"להרגיש יותר תשוקה ומשיכה","en":"Feeling we really know each other again","scores":[{"axis":"passion_anticipation","weight":1}]},
  {"id":"appreciation","he":"לקבל יותר הערכה והכרה","en":"Getting more appreciation and recognition","scores":[{"axis":"fondness","weight":1}]},
  {"id":"closeness","he":"להיות יותר מסונכרנים במיניות","en":"Feeling more emotionally close","scores":[{"axis":"intimacy_presence","weight":1}]},
  {"id":"fights","he":"לריב פחות","en":"Fighting less / recovering faster","scores":[{"axis":"repair","weight":1}]},
  {"id":"passion","he":"להרגיש שמכירים אחד את השני באמת","en":"Bringing back desire and attraction","scores":[{"axis":"love_map","weight":1}]},
  {"id":"direction","he":"להיות בחברות ובתקשורת טובה טובה יותר","en":"Understanding where we're heading together","scores":[{"axis":"turn_toward","weight":1}]}
]$j$::jsonb,
    note = coalesce(note,'') || ' | 197: option SCORES re-pointed at the Hebrew labels; ids and he/en untouched'
WHERE slug = 'q20_biggest_gap' AND version = 2;

COMMIT;

-- ── VERIFY ─────────────────────────────────────────────────────────────────
--   SELECT slug, version, axes FROM journey_question_versions
--   WHERE slug IN ('q11_contempt','q17_context_logistics','q01_knowledge_world',
--                  'q19_rituals','q02_admiration_see_good','q24_physical_closeness')
--   ORDER BY slug, version;
--   -- expect v1 = original axis, v2 = corrected axis, for each

-- ── ROLLBACK ───────────────────────────────────────────────────────────────
-- UPDATE public.journey_question_versions v
--   SET axes = b.axes, options = b.options
--   FROM public.journey_question_versions_axes_backup_197 b
--   WHERE v.id = b.id;
-- DROP TABLE public.journey_question_versions_axes_backup_197;
