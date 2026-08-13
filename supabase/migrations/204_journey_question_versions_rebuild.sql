-- ───────────────────────────────────────────────────────────────────────────
-- 204_journey_question_versions_rebuild.sql
--
-- Rebuild journey_question_versions from journey_questions_history — the actual
-- record of what changed and when — instead of from journey_questions.updated_at.
--
-- WHY 196 WAS WRONG
-- -----------------
-- The backfill in 196 assumed each question was rewritten ONCE and used its
-- updated_at as the single boundary. `updated_at` is the LAST edit, not the
-- edit that changed the meaning. Questions were edited repeatedly:
--
--   q01_knowledge_world     6 text versions, last edited 07-20, but it stopped
--                           being the love_map question on 07-01 06:31 and became
--                           the sexual-presence question on 07-01 16:14.
--   q17_context_logistics   3 text versions, last edited 07-20, but it stopped
--                           being the logistics question on 07-01 06:59.
--
-- So 593 answers to q01 and 568 to q17 — 1,161 in total — have been scored
-- against an era that had already ended. This migration moves them.
--
-- Other questions had their boundaries misplaced too (q03, q09, q19, q20b) or
-- gained a spurious second version where the text never changed at all (q16_play,
-- q20_biggest_gap, q22a_success_signal). None of those affect scoring, because
-- their axis is identical across every era — but the record was wrong, and a
-- version table that misstates history is the thing we are trying to stop
-- relying on guesswork for.
--
-- WHAT THIS TABLE HOLDS AFTER THIS MIGRATION
-- ------------------------------------------
-- SCORING-relevant windows only: a new row exists where the AXIS must change,
-- not on every wording tweak. The full text history lives in
-- journey_questions_history and is documented in docs/journey-scoring-history.md.
-- A single open window per question is the normal case and is correct whenever
-- the meaning never moved.
--
-- Every boundary below is a timestamp taken from journey_questions_history, not
-- inferred. Answer counts are as at 2026-08-13.
--
-- ⚠️  journey_questions is NOT touched by this migration. Note for whoever
--    writes the next one: that table has a BEFORE UPDATE trigger,
--    journey_questions_touch_updated_at_trigger, which overwrites updated_at on
--    EVERY update — an explicit `updated_at = <value>` in your SET clause is
--    silently discarded. Since the version boundaries were derived from those
--    timestamps, bumping them destroys the evidence. Disable the trigger around
--    the statement if you genuinely need to preserve or restore them.
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

-- Exact rollback material.
CREATE TABLE IF NOT EXISTS public.journey_question_versions_backup_204 AS
SELECT * FROM public.journey_question_versions;

DELETE FROM public.journey_question_versions;

-- ── Default: one open window per active question, carrying today's axes ────
-- Correct for every question whose meaning never changed. The eight questions
-- that DID change are overridden below.
INSERT INTO public.journey_question_versions
  (slug, version, valid_from, valid_to, he_text, en_text, axes, reverse, options, type, note)
SELECT q.slug, 1, '-infinity'::timestamptz, NULL,
       q.he_text, q.en_text, q.axes, q.reverse, q.options, q.type,
       'rebuilt by 204: meaning never changed; single window'
FROM public.journey_questions q;

-- ── q01_knowledge_world — THREE meanings ───────────────────────────────────
-- v2 is deliberately UNSCORED. Its Hebrew asked "how much do you feel you are in
-- first place for your partner", which is neither love_map nor intimacy_presence.
-- 14 answers sit in it. They are kept in journey_responses untouched; they simply
-- do not contribute to any axis, because we do not know which one is true and
-- inventing one for 14 answers would be noise dressed as data.
DELETE FROM public.journey_question_versions WHERE slug = 'q01_knowledge_world';
INSERT INTO public.journey_question_versions
  (slug, version, valid_from, valid_to, he_text, en_text, axes, reverse, options, type, note)
VALUES
  ('q01_knowledge_world', 1, '-infinity', '2026-07-01T06:31:46Z',
   $x$בשבועיים האחרונים, עד כמה אני מודע/ת למה שעובר על בן/בת הזוג שלי - הן בדברים היומיומיים והן במה שמעסיק / מטריד אותם?$x$,
   NULL, $x$[{"axis":"love_map","weight":1}]$x$::jsonb, false, NULL, 'likert5',
   '204: the original love_map question — 162 answers'),
  ('q01_knowledge_world', 2, '2026-07-01T06:31:46Z', '2026-07-01T16:14:46Z',
   $x$עד כמה את/ה מרגיש/ה במקום הראשון אצל בן/בת הזוג, גם בתוך שגרה עמוסה?$x$,
   NULL, $x$[]$x$::jsonb, false, NULL, 'likert5',
   '204: "in first place" era — matches NO existing axis, deliberately unscored. 14 answers, retained but not counted.'),
  ('q01_knowledge_world', 3, '2026-07-01T16:14:46Z', NULL,
   (SELECT he_text FROM public.journey_questions WHERE slug='q01_knowledge_world'),
   (SELECT en_text FROM public.journey_questions WHERE slug='q01_knowledge_world'),
   $x$[{"axis":"intimacy_presence","weight":1}]$x$::jsonb, false, NULL, 'likert5',
   '204: sexual-presence question — 644 answers. Was scored love_map until this migration.');

-- ── q17_context_logistics — boundary moves 07-20 → 07-01 06:59 ─────────────
DELETE FROM public.journey_question_versions WHERE slug = 'q17_context_logistics';
INSERT INTO public.journey_question_versions
  (slug, version, valid_from, valid_to, he_text, en_text, axes, reverse, options, type, note)
VALUES
  ('q17_context_logistics', 1, '-infinity', '2026-07-01T06:59:06Z',
   $x$כשיש לנו זמן רק לשנינו - באיזו תדירות השיחה עדיין מסתיימת בסופרמרקט, לו"ז, או רשימות מטלות?$x$,
   NULL, $x$[{"axis":"passion_context","weight":-1}]$x$::jsonb, false, NULL, 'likert5',
   '204: the original logistics question, reverse-scored — 135 answers'),
  ('q17_context_logistics', 2, '2026-07-01T06:59:06Z', NULL,
   (SELECT he_text FROM public.journey_questions WHERE slug='q17_context_logistics'),
   (SELECT en_text FROM public.journey_questions WHERE slug='q17_context_logistics'),
   $x$[{"axis":"shared_meaning","weight":1}]$x$::jsonb, false, NULL, 'likert5',
   '204: rituals question — 611 answers. Was scored passion_context(-1) until this migration.');

-- ── The five whose single boundary 196 got right ───────────────────────────
-- Confirmed against journey_questions_history: for each of these the meaning
-- changed exactly once, at the timestamp used below.
--   q02 07-01 06:32:44   q11 07-01 06:55:04   q24 07-01 06:56:16
--   q19 07-20 08:03:04   q20_biggest_gap 07-12 06:31:01 (OPTION labels, not text)
DELETE FROM public.journey_question_versions
 WHERE slug IN ('q02_admiration_see_good','q11_contempt','q24_physical_closeness','q19_rituals');
INSERT INTO public.journey_question_versions
  (slug, version, valid_from, valid_to, he_text, en_text, axes, reverse, options, type, note)
VALUES
  ('q02_admiration_see_good', 1, '-infinity', '2026-07-01T06:32:44Z',
   $x$עד כמה קל לי להיזכר בשלושה דברים שאני מעריך/ה בבן/בת הזוג?$x$, NULL,
   $x$[{"axis":"fondness","weight":1}]$x$::jsonb, false, NULL, 'likert5', '204: original admiration question'),
  ('q02_admiration_see_good', 2, '2026-07-01T06:32:44Z', NULL,
   (SELECT he_text FROM public.journey_questions WHERE slug='q02_admiration_see_good'), NULL,
   $x$[{"axis":"shared_meaning","weight":1}]$x$::jsonb, false, NULL, 'likert5', '204: "united team" question'),

  ('q11_contempt', 1, '-infinity', '2026-07-01T06:55:04Z',
   $x$באיזו תדירות קורה שאחד מאיתנו מגלגל עיניים, לועג, או משתמש בטון של 'אתה לא מבין שום דבר' כלפי השני?$x$, NULL,
   $x$[{"axis":"four_horsemen_contempt","weight":1}]$x$::jsonb, false, NULL, 'likert5', '204: original contempt question'),
  ('q11_contempt', 2, '2026-07-01T06:55:04Z', NULL,
   (SELECT he_text FROM public.journey_questions WHERE slug='q11_contempt'), NULL,
   $x$[{"axis":"fondness","weight":1}]$x$::jsonb, false, NULL, 'likert5', '204: appreciation question'),

  ('q24_physical_closeness', 1, '-infinity', '2026-07-01T06:56:16Z',
   $x$באיזו תדירות יש בינינו קרבה פיזית לא-מינית (חיבוק ארוך, יד על הכתף, להירדם צמודים)?$x$, NULL,
   $x$[{"axis":"love_language_touch","weight":0.5},{"axis":"passion_play","weight":0.5}]$x$::jsonb, false, NULL, 'likert5',
   '204: original non-sexual touch question'),
  ('q24_physical_closeness', 2, '2026-07-01T06:56:16Z', NULL,
   (SELECT he_text FROM public.journey_questions WHERE slug='q24_physical_closeness'), NULL,
   $x$[{"axis":"passion_context","weight":1}]$x$::jsonb, false, NULL, 'likert5', '204: evening-energy question'),

  ('q19_rituals', 1, '-infinity', '2026-07-20T08:03:04Z',
   $x$עד כמה יש לנו רגעים קבועים ביום או בשבוע שרק שייכים לנו (קפה של בוקר, דייט קבוע, טקס ערב)?$x$, NULL,
   $x$[{"axis":"shared_meaning","weight":0.5}]$x$::jsonb, false, NULL, 'likert5',
   '204: rituals question — 687 answers. Reworded 07-20 07:59 with no change of meaning.'),
  ('q19_rituals', 2, '2026-07-20T08:03:04Z', NULL,
   (SELECT he_text FROM public.journey_questions WHERE slug='q19_rituals'), NULL,
   $x$[{"axis":"emotional_safety","weight":1}]$x$::jsonb, false, NULL, 'likert5', '204: self-disclosure question');

-- ── q20_biggest_gap — the change was in the OPTION LABELS, not the text ────
-- A text-derived rebuild misses this entirely: he_text never changed. The labels
-- swapped at 07-12 06:31:01, which is the boundary 196 happened to get right.
DELETE FROM public.journey_question_versions WHERE slug = 'q20_biggest_gap';
INSERT INTO public.journey_question_versions
  (slug, version, valid_from, valid_to, he_text, en_text, axes, reverse, options, type, note)
VALUES
  ('q20_biggest_gap', 1, '-infinity', '2026-07-12T06:31:01Z',
   (SELECT he_text FROM public.journey_questions WHERE slug='q20_biggest_gap'), NULL,
   '[]'::jsonb, false,
   $x$[{"id":"knowing","he":"להרגיש שמכירים אחד את השני באמת","en":"Feeling we really know each other again","scores":[{"axis":"love_map","weight":1}]},{"id":"appreciation","he":"לקבל יותר הערכה והכרה","en":"Getting more appreciation and recognition","scores":[{"axis":"fondness","weight":1}]},{"id":"closeness","he":"להרגיש יותר קרובים רגשית","en":"Feeling more emotionally close","scores":[{"axis":"turn_toward","weight":1}]},{"id":"fights","he":"לריב פחות","en":"Fighting less / recovering faster","scores":[{"axis":"repair","weight":1}]},{"id":"passion","he":"להרגיש יותר תשוקה ומשיכה","en":"Bringing back desire and attraction","scores":[{"axis":"passion_anticipation","weight":1}]},{"id":"direction","he":"להבין לאן אנחנו הולכים ביחד","en":"Understanding where we're heading together","scores":[{"axis":"shared_meaning","weight":1}]}]$x$::jsonb,
   'single_choice', '204: original option labels, scores matched them'),
  ('q20_biggest_gap', 2, '2026-07-12T06:31:01Z', NULL,
   (SELECT he_text FROM public.journey_questions WHERE slug='q20_biggest_gap'), NULL,
   '[]'::jsonb, false,
   (SELECT options FROM public.journey_questions WHERE slug='q20_biggest_gap'),
   'single_choice', '204: labels swapped; scores re-pointed at them by 197');

COMMIT;

-- ── VERIFY ─────────────────────────────────────────────────────────────────
--   SELECT slug, count(*) FILTER (WHERE valid_to IS NULL) AS open, count(*) AS versions
--   FROM journey_question_versions GROUP BY slug
--   HAVING count(*) FILTER (WHERE valid_to IS NULL) <> 1;   -- expect zero rows

-- ── ROLLBACK ───────────────────────────────────────────────────────────────
-- DELETE FROM public.journey_question_versions;
-- INSERT INTO public.journey_question_versions SELECT * FROM public.journey_question_versions_backup_204;
-- DROP TABLE public.journey_question_versions_backup_204;
