-- ───────────────────────────────────────────────────────────────────────────
-- 196_journey_question_versions_backfill.sql
--
-- Populate journey_question_versions from what we can prove.
--
-- WHAT WE KNOW, AND HOW
-- ---------------------
-- • journey_questions.created_at is 2026-06-14 for every row and updated_at
--   differs on 24 of 29 — so we know EXACTLY when each question's text was
--   rewritten, even though updated_by was never written (see migration 197).
-- • The axes were NEVER edited. The admin editor's "SCORING LOCK" made them
--   unwritable, which is what caused this bug and is also why today's `axes`
--   value is provably the same one that was live on day one.
--
-- Therefore:
--   v1  [-infinity, updated_at)   axes = today's axes  ← correct for the OLD text
--   v2  [updated_at,  NULL)       axes = today's axes  ← WRONG for the NEW text;
--                                                        corrected in 197.
-- Never-edited questions get a single open version spanning all of time.
--
-- '-infinity' rather than created_at is deliberate: journey_responses begin
-- 2026-04-19, almost two months before these rows existed (scoring fell back to
-- questionnaire.json then). A v1 starting at created_at would leave those
-- answers unresolvable.
--
-- TEXT FIDELITY
-- -------------
-- v1.he_text is restored from the migration 118 seed for the eight questions
-- whose meaning actually changed — those are the ones where someone will later
-- need to read "what did this person actually see". For the remaining edited
-- questions the historical text was not captured anywhere we can recover, so
-- v1 carries today's text with an explicit note. This costs nothing in
-- scoring: their axes agree with both the old and the new wording, so the
-- version split never changes their score.
--
-- Idempotent: ON CONFLICT (slug, version) DO NOTHING. Re-running cannot
-- duplicate or overwrite.
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── v1: the era before each rewrite ────────────────────────────────────────
INSERT INTO public.journey_question_versions
  (slug, version, valid_from, valid_to, he_text, en_text, axes, reverse, options, type, note)
SELECT
  q.slug,
  1,
  '-infinity'::timestamptz,
  -- Never-edited rows stay open forever; edited rows close at the rewrite.
  CASE WHEN q.updated_at IS DISTINCT FROM q.created_at THEN q.updated_at ELSE NULL END,
  COALESCE(seed.he_text, q.he_text),
  COALESCE(seed.en_text, q.en_text),
  q.axes,          -- unchanged since day one: the SCORING LOCK guaranteed it
  q.reverse,
  COALESCE(seed.options, q.options),
  q.type,
  CASE
    WHEN seed.he_text IS NOT NULL THEN 'v1 text restored from migration 118 seed'
    WHEN q.updated_at IS DISTINCT FROM q.created_at
      THEN 'v1 text NOT recoverable; axes unchanged so scoring is unaffected'
    ELSE 'never edited; single version'
  END
FROM public.journey_questions q
LEFT JOIN (
  VALUES
    ('q01_knowledge_world',
     $s$בשבועיים האחרונים, עד כמה אני מודע/ת למה שעובר על בן/בת הזוג שלי - הן בדברים היומיומיים והן במה שמעסיק / מטריד אותם?$s$,
     $s$In the past two weeks, how much do I feel I truly know what my partner is going through - their stresses, small worries, what's really on their mind?$s$,
     NULL::jsonb),
    ('q02_admiration_see_good',
     $s$עד כמה קל לי להיזכר בשלושה דברים שאני מעריך/ה בבן/בת הזוג?$s$,
     $s$When I think of my partner this week - how easy is it for me to recall three things I genuinely admire about them?$s$,
     NULL::jsonb),
    ('q03_bids_turn_toward',
     $s$כשבן/בת הזוג שלי פונה אליי עם מחשבה, שיתוף של אירוע קטן או אחר - באיזו תדירות אני עוצר/ת את מה שאני עושה ומתמקד/ת בבן/בת הזוג שלי?$s$,
     $s$When my partner reaches out with something small - a comment, a laugh, a touch - how often do I actually give attention instead of putting it off to 'later'?$s$,
     NULL::jsonb),
    ('q11_contempt',
     $s$באיזו תדירות קורה שאחד מאיתנו מגלגל עיניים, לועג, או משתמש בטון של 'אתה לא מבין שום דבר' כלפי השני?$s$,
     $s$How often does one of us roll our eyes, mock, or use a 'you just don't get it' tone toward the other?$s$,
     NULL::jsonb),
    ('q17_context_logistics',
     $s$כשיש לנו זמן רק לשנינו - באיזו תדירות השיחה עדיין מסתיימת בסופרמרקט, לו"ז, או רשימות מטלות?$s$,
     $s$When we're alone in the evening with no kids/work - how often does the conversation still end up on groceries, schedules, or to-do lists?$s$,
     NULL::jsonb),
    ('q19_rituals',
     $s$עד כמה יש לנו רגעים קבועים ביום או בשבוע שרק שייכים לנו (קפה של בוקר, דייט קבוע, טקס ערב)?$s$,
     $s$Do we have a regular moment in the day or week that belongs only to us (morning coffee, standing date, evening ritual)?$s$,
     NULL::jsonb),
    ('q24_physical_closeness',
     $s$באיזו תדירות יש בינינו קרבה פיזית לא-מינית (חיבוק ארוך, יד על הכתף, להירדם צמודים)?$s$,
     $s$How often do we have non-sexual physical closeness (long hug, hand on shoulder, falling asleep close)?$s$,
     NULL::jsonb),
    -- q20_biggest_gap: the TEXT was unchanged; the per-option Hebrew LABELS
    -- were swapped. v1 restores the seeded option set so an answer given before
    -- 2026-07-12 still resolves to the option the respondent actually read.
    ('q20_biggest_gap',
     $s$אם היה אפשר לשפר דבר אחד בלבד בזוגיות שלכם בחודש הקרוב - מה זה היה?$s$,
     $s$If you could improve one thing in your relationship this month, what would it be?$s$,
     $s$[{"id":"knowing","he":"להרגיש שמכירים אחד את השני באמת","en":"Feeling we really know each other again","scores":[{"axis":"love_map","weight":1}]},{"id":"appreciation","he":"לקבל יותר הערכה והכרה","en":"Getting more appreciation and recognition","scores":[{"axis":"fondness","weight":1}]},{"id":"closeness","he":"להרגיש יותר קרובים רגשית","en":"Feeling more emotionally close","scores":[{"axis":"turn_toward","weight":1}]},{"id":"fights","he":"לריב פחות","en":"Fighting less / recovering faster","scores":[{"axis":"repair","weight":1}]},{"id":"passion","he":"להרגיש יותר תשוקה ומשיכה","en":"Bringing back desire and attraction","scores":[{"axis":"passion_anticipation","weight":1}]},{"id":"direction","he":"להבין לאן אנחנו הולכים ביחד","en":"Understanding where we're heading together","scores":[{"axis":"shared_meaning","weight":1}]}]$s$::jsonb)
) AS seed(slug, he_text, en_text, options) ON seed.slug = q.slug
ON CONFLICT (slug, version) DO NOTHING;

-- ── v2: the era after the rewrite (edited questions only) ──────────────────
INSERT INTO public.journey_question_versions
  (slug, version, valid_from, valid_to, he_text, en_text, axes, reverse, options, type, note)
SELECT
  q.slug, 2, q.updated_at, NULL,
  q.he_text, q.en_text,
  q.axes,          -- inherited unchanged — this is the wrongness 197 corrects
  q.reverse, q.options, q.type,
  'v2 opened at the recorded rewrite; axes inherited from v1 and corrected in 197'
FROM public.journey_questions q
WHERE q.updated_at IS DISTINCT FROM q.created_at
ON CONFLICT (slug, version) DO NOTHING;

COMMIT;

-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- Every question resolvable at any instant, and exactly one open version each:
--   SELECT slug, count(*) FILTER (WHERE valid_to IS NULL) AS open, count(*) AS versions
--   FROM journey_question_versions GROUP BY slug HAVING count(*) FILTER (WHERE valid_to IS NULL) <> 1;
--   -- expect zero rows

-- ── ROLLBACK ───────────────────────────────────────────────────────────────
-- DELETE FROM public.journey_question_versions WHERE version IN (1, 2);
-- (The table itself is dropped by rolling back 195. journey_questions and
--  journey_responses are not touched by this migration at all.)
