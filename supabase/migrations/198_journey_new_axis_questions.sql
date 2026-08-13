-- ───────────────────────────────────────────────────────────────────────────
-- 198_journey_new_axis_questions.sql
--
-- Five NEW questions, restoring the signals that migration 197 vacated and
-- giving the two new family axes a source.
--
-- NEW SLUGS, DELIBERATELY. Repurposing an existing row is exactly the mistake
-- being undone here: it is what let a question's meaning change while its
-- history silently kept pointing at the old one. Every question below is a new
-- row with its own version starting now, so nobody's past answer is retro-fitted
-- to a question they never saw.
--
-- WHY EACH ONE EXISTS
--   q30_contempt_v2        197 moved q11 to fondness, leaving
--                          four_horsemen_contempt with NO source. It is the
--                          single strongest divorce predictor in Gottman's data
--                          and it feeds תקשורת זוגית.
--   q31_touch_nonsexual    197 moved q24 to passion_context, leaving
--                          love_language_touch with no source — without it the
--                          touch love-language can never be selected and
--                          מיניות ואינטימיות loses a leg.
--   q32_love_map_v2        197 moved q01 to intimacy_presence, leaving love_map
--                          with no source. love_map feeds BOTH אהבה וחיבור רגשי
--                          and חברות ושותפות יומיומית — without it the
--                          friendship category has no live source at all in the
--                          short assessment.
--   q33_external_pressure  משפחה, הורות ולחצים חיצוניים is named for external
--                          pressure and measured none. REVERSE-weighted: more
--                          outside pressure entering the relationship is worse.
--   q34_load_fairness      Same category; perceived fairness of the household
--                          and childcare load.
--
-- PHASE = 'short' for all five. The results page is what the acceptance bar
-- talks about, and for the overwhelming majority of people that page is built
-- from the SHORT set (median questions answered = 12; the short set is 13).
-- Placed in 'full' they would not appear in almost anyone's report and the
-- five-category bar would still fail. This lengthens the short assessment from
-- 13 scored questions to 18 — a real funnel change, called out in the PR.
--
-- Hebrew is exactly as supplied. Not reworded, not "improved".
-- Idempotent: upsert on slug.
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO public.journey_questions
  (slug, position, phase, type, domain, axes, reverse, he_text, en_text, options, meta, is_active)
VALUES
  ( 'q30_contempt_v2', 34, 'short', 'likert5', 'communication',
    $x$[{"axis":"four_horsemen_contempt","weight":1.0}]$x$::jsonb, false,
    $x$באיזו תדירות קורה שאחד מכם מגלגל עיניים, לועג או מדבר בזלזול אל השני, גם אם בצחוק?$x$,
    $x$How often does one of you roll your eyes, mock, or speak dismissively to the other - even as a joke?$x$,
    NULL,
    $x${"purpose":"Four Horsemen - Contempt. Restores the signal vacated when q11's Hebrew was rewritten into an appreciation question (migration 197).","insight":"High contempt is the strongest single predictor of separation in Gottman's data."}$x$::jsonb,
    true ),

  ( 'q31_touch_nonsexual', 35, 'short', 'likert5', 'intimacy',
    $x$[{"axis":"love_language_touch","weight":1.0}]$x$::jsonb, false,
    $x$בשבוע רגיל, כמה מגע לא מיני יש ביניכם, כמו חיבוק, יד על הכתף או ליטוף?$x$,
    $x$In a typical week, how much non-sexual touch is there between you - a hug, a hand on the shoulder, a caress?$x$,
    NULL,
    $x${"purpose":"Restores love_language_touch, vacated when q24 moved to passion_context (migration 197)."}$x$::jsonb,
    true ),

  ( 'q32_love_map_v2', 36, 'short', 'likert5', 'emotional_connection',
    $x$[{"axis":"love_map","weight":1.0}]$x$::jsonb, false,
    $x$עד כמה אתה יודע מה עובר על בן או בת הזוג בימים האלה, בלי שתצטרך לשאול?$x$,
    $x$How much do you know what your partner is going through these days, without having to ask?$x$,
    NULL,
    $x${"purpose":"Restores love_map, vacated when q01 moved to intimacy_presence (migration 197). Feeds BOTH the emotional-connection and friendship categories."}$x$::jsonb,
    true ),

  ( 'q33_external_pressure', 37, 'short', 'likert5', 'family',
    $x$[{"axis":"external_pressure","weight":-1.0}]$x$::jsonb, false,
    $x$באיזו מידה לחצים מבחוץ, כמו עבודה, כסף או משפחה מורחבת, נכנסים אליכם לתוך הזוגיות?$x$,
    $x$How much do outside pressures - work, money, extended family - make their way into your relationship?$x$,
    NULL,
    $x${"purpose":"First real measure of the external-pressure half of the family category, which was named for it but never measured it.","insight":"REVERSE: a higher answer means more pressure entering the relationship, i.e. worse."}$x$::jsonb,
    true ),

  ( 'q34_load_fairness', 38, 'short', 'likert5', 'family',
    $x$[{"axis":"load_fairness","weight":1.0}]$x$::jsonb, false,
    $x$בניהול הבית והילדים, עד כמה חלוקת העומס מרגישה הוגנת לשניכם?$x$,
    $x$In running the home and the kids, how fair does the division of the load feel to both of you?$x$,
    NULL,
    $x${"purpose":"Perceived fairness of domestic and childcare load - the parenting half of the family category."}$x$::jsonb,
    true )

ON CONFLICT (slug) DO UPDATE SET
  position = EXCLUDED.position,
  phase    = EXCLUDED.phase,
  type     = EXCLUDED.type,
  domain   = EXCLUDED.domain,
  axes     = EXCLUDED.axes,
  reverse  = EXCLUDED.reverse,
  he_text  = EXCLUDED.he_text,
  en_text  = EXCLUDED.en_text,
  meta     = EXCLUDED.meta,
  is_active = EXCLUDED.is_active;

-- Every question needs a version row or scoring cannot resolve it. These open
-- at '-infinity' rather than now(): they are brand new, so there are no prior
-- answers to mis-attribute, and an open-ended range keeps the resolver total.
INSERT INTO public.journey_question_versions
  (slug, version, valid_from, valid_to, he_text, en_text, axes, reverse, options, type, note)
SELECT q.slug, 1, '-infinity'::timestamptz, NULL,
       q.he_text, q.en_text, q.axes, q.reverse, q.options, q.type,
       'new question introduced in migration 198'
FROM public.journey_questions q
WHERE q.slug IN ('q30_contempt_v2','q31_touch_nonsexual','q32_love_map_v2',
                 'q33_external_pressure','q34_load_fairness')
ON CONFLICT (slug, version) DO NOTHING;

COMMIT;

-- ── VERIFY ─────────────────────────────────────────────────────────────────
--   SELECT slug, phase, axes FROM journey_questions
--   WHERE slug LIKE 'q3%_%' ORDER BY position;
--   SELECT count(*) FROM journey_questions WHERE phase='short' AND is_active; -- 18

-- ── ROLLBACK ───────────────────────────────────────────────────────────────
-- DELETE FROM public.journey_question_versions
--   WHERE slug IN ('q30_contempt_v2','q31_touch_nonsexual','q32_love_map_v2',
--                  'q33_external_pressure','q34_load_fairness');
-- DELETE FROM public.journey_questions
--   WHERE slug IN ('q30_contempt_v2','q31_touch_nonsexual','q32_love_map_v2',
--                  'q33_external_pressure','q34_load_fairness');
-- NOTE: if any journey_responses rows already reference these slugs, delete the
-- questions but KEEP the responses — nothing is ever deleted from responses.
-- An orphaned response simply fails to resolve and is skipped by scoring.
