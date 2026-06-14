-- 118_journey_questions_seed.sql
-- =============================================================================
-- F1 — Seed public.journey_questions from journey/questionnaire.json (v7, 28 Q),
-- FIELD-PERFECT. The JSON stays as the runtime FALLBACK; this just moves the
-- editable copy into the DB.
--
-- Mapping (per approved proposal §7):
--   slug      ← questions[].id
--   position  ← array index in questions[] (0-based)
--   domain    ← questions[].domain (NULL kept as NULL)
--   axes      ← questions[].axes  VERBATIM (signed/fractional weights kept)
--   type      ← questions[].type
--   reverse   ← false (journey inverts via negative weight)
--   he_text   ← he  (likert)  OR he_prompt (choice/reflection/ranking)
--   en_text   ← en  (likert)  OR en_prompt (...)
--   options   ← questions[].options VERBATIM (option id + scores preserved); NULL if none
--   meta      ← {purpose, insight?, max_length?, he_subline?, en_subline?, categories?}
--   phase     ← these 11 slugs = 'short', everything else = 'full':
--               q01_knowledge_world, q02_admiration_see_good, q03_bids_turn_toward,
--               q16_play, q09_repair_recovery, q15_anticipation, q24_physical_closeness,
--               q17_context_logistics, q20_biggest_gap, q20b_intimacy_satisfaction,
--               q22a_success_signal     (q11_contempt is FULL by decision)
--
-- NOTE on jsonb numeric normalization: jsonb stores 1.0 as 1 and -1.0 as -1
--   (0.5 stays 0.5). This is NUMERICALLY identical — analysis.ts consumes the
--   weight as a JS number — so scoring is unaffected.
--
-- Bilingual text + JSON are written with dollar-quoting ($x$...$x$) so the many
-- English apostrophes (I'm, what's, we're) and Hebrew need no escaping.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING. Re-running inserts only slugs that
-- don't yet exist (backfill) and never touches existing rows — so admin edits
-- made via F2 are NEVER reverted by a re-seed. No duplicates. Because DO NOTHING
-- performs no UPDATE on conflict, the audit trigger never fires on a re-run.
-- =============================================================================

BEGIN;

INSERT INTO public.journey_questions
  (slug, position, phase, type, domain, axes, reverse, he_text, en_text, options, meta)
VALUES
  -- 0 ───────────────────────────────────────────────────────────────────────
  ( 'q01_knowledge_world', 0, 'short', 'likert5', 'emotional_connection',
    $x$[{"axis":"love_map","weight":1.0}]$x$::jsonb, false,
    $x$בשבועיים האחרונים, עד כמה אני מודע/ת למה שעובר על בן/בת הזוג שלי - הן בדברים היומיומיים והן במה שמעסיק / מטריד אותם?$x$,
    $x$In the past two weeks, how much do I feel I truly know what my partner is going through - their stresses, small worries, what's really on their mind?$x$,
    NULL,
    $x${"purpose":"Baseline Love Map - does the person actually know their partner's current inner life?","insight":"If low: partner feels invisible. We open with Love Map week."}$x$::jsonb ),

  -- 1 ───────────────────────────────────────────────────────────────────────
  ( 'q02_admiration_see_good', 1, 'short', 'likert5', 'emotional_connection',
    $x$[{"axis":"fondness","weight":1.0}]$x$::jsonb, false,
    $x$עד כמה קל לי להיזכר בשלושה דברים שאני מעריך/ה בבן/בת הזוג?$x$,
    $x$When I think of my partner this week - how easy is it for me to recall three things I genuinely admire about them?$x$,
    NULL,
    $x${"purpose":"Fondness & Admiration snapshot - can the user still articulate what they love?","insight":"If low + low Love Map: relationship is in early Negative Sentiment Override."}$x$::jsonb ),

  -- 2 ───────────────────────────────────────────────────────────────────────
  ( 'q_gender', 2, 'full', 'forced_choice', NULL,
    $x$[]$x$::jsonb, false,
    $x$כדי להתאים את התכנים האישיים עבורך - מה המגדר שלך?$x$,
    $x$So we can tailor content to you - what's your gender?$x$,
    $x$[{"id":"female","he":"אישה","en":"Female","scores":[]},{"id":"male","he":"גבר","en":"Male","scores":[]},{"id":"other","he":"אחר / מעדיף/ה לא לציין","en":"Other / prefer not to say","scores":[]}]$x$::jsonb,
    $x${"purpose":"Captures the respondent's gender label for audience-targeted coaching content (migration 044). Doesn't drive the diagnostic - option ids map directly to profiles.gender ('male' | 'female' | 'other').","insight":"Persisted onto profiles.gender immediately if authed, or backfilled the moment the anon journey is claimed by a user. The audience filter on couple timelines is structural (couple_members.role), so this is purely the display label the expert sees."}$x$::jsonb ),

  -- 3 ───────────────────────────────────────────────────────────────────────
  ( 'q_relationship_status', 3, 'full', 'forced_choice', NULL,
    $x$[]$x$::jsonb, false,
    $x$מה הסטטוס שלכם כזוג?$x$,
    $x$What's your relationship status?$x$,
    $x$[{"id":"married","he":"נשואים","en":"Married","scores":[]},{"id":"partnership","he":"ידועים בציבור / חיים יחד","en":"Partnership / living together","scores":[]},{"id":"dating","he":"בזוגיות, לא גרים יחד","en":"Dating, not living together","scores":[]},{"id":"engaged","he":"מאורסים","en":"Engaged","scores":[]}]$x$::jsonb,
    $x${"purpose":"Relationship type - used by the expert to pick appropriate framing (married couples vs. dating differ in conflict patterns).","insight":"Doesn't affect axis scores; surfaced on the expert couple-detail page."}$x$::jsonb ),

  -- 4 ───────────────────────────────────────────────────────────────────────
  ( 'q_relationship_years', 4, 'full', 'forced_choice', NULL,
    $x$[]$x$::jsonb, false,
    $x$כמה שנים אתם יחד?$x$,
    $x$How long have you been together?$x$,
    $x$[{"id":"lt1","he":"פחות משנה","en":"Less than 1 year","scores":[]},{"id":"1to3","he":"1-3 שנים","en":"1-3 years","scores":[]},{"id":"4to7","he":"4-7 שנים","en":"4-7 years","scores":[]},{"id":"8to15","he":"8-15 שנים","en":"8-15 years","scores":[]},{"id":"gt15","he":"יותר מ-15 שנים","en":"More than 15 years","scores":[]}]$x$::jsonb,
    $x${"purpose":"How long the couple has been together - pacing of long-married vs. early-relationship couples differs.","insight":"Surfaced on expert dashboard."}$x$::jsonb ),

  -- 5 ───────────────────────────────────────────────────────────────────────
  ( 'q_kids_count', 5, 'full', 'forced_choice', 'family',
    $x$[]$x$::jsonb, false,
    $x$כמה ילדים יש לכם?$x$,
    $x$How many kids do you have?$x$,
    $x$[{"id":"0","he":"אין","en":"None","scores":[]},{"id":"1","he":"ילד אחד","en":"1","scores":[]},{"id":"2","he":"שני ילדים","en":"2","scores":[]},{"id":"3","he":"שלושה ילדים","en":"3","scores":[]},{"id":"4plus","he":"4 ומעלה","en":"4 or more","scores":[]}]$x$::jsonb,
    $x${"purpose":"Family size - informs scheduling-realistic prescriptions.","insight":"Surfaced on expert dashboard."}$x$::jsonb ),

  -- 6 ───────────────────────────────────────────────────────────────────────
  ( 'q03_bids_turn_toward', 6, 'short', 'likert5', 'friendship',
    $x$[{"axis":"turn_toward","weight":1.0}]$x$::jsonb, false,
    $x$כשבן/בת הזוג שלי פונה אליי עם מחשבה, שיתוף של אירוע קטן או אחר - באיזו תדירות אני עוצר/ת את מה שאני עושה ומתמקד/ת בבן/בת הזוג שלי?$x$,
    $x$When my partner reaches out with something small - a comment, a laugh, a touch - how often do I actually give attention instead of putting it off to 'later'?$x$,
    NULL,
    $x${"purpose":"Turn Toward: do small connection bids get responded to?","insight":"The single strongest Gottman predictor of long-term stability."}$x$::jsonb ),

  -- 7 ───────────────────────────────────────────────────────────────────────
  ( 'q07_pso_benefit_of_doubt', 7, 'full', 'likert5', 'communication',
    $x$[{"axis":"pso","weight":1.0}]$x$::jsonb, false,
    $x$כשבן/בת הזוג שלי במצב רוח רע - באיזו תדירות ההנחה הראשונה שלי היא 'כנראה עבר עליו/ה משהו' ולא 'זה מכוון נגדי'?$x$,
    $x$When my partner is in a bad mood - how often is my first assumption 'they must be going through something' rather than 'this is aimed at me'?$x$,
    NULL,
    $x${"purpose":"Positive Sentiment Override - assumed intent when partner is off.","insight":"PSO score predicts whether repair attempts will land."}$x$::jsonb ),

  -- 8 ───────────────────────────────────────────────────────────────────────
  ( 'q08_influence_decisions', 8, 'full', 'likert5', 'communication',
    $x$[{"axis":"influence","weight":1.0}]$x$::jsonb, false,
    $x$בהחלטות משמעותיות (כסף, ילדים, זמן) - עד כמה אני מרגיש/ה שהדעה שלי באמת משפיעה על התוצאה הסופית?$x$,
    $x$On meaningful decisions (money, kids, time) - how much do I feel my opinion actually shapes the final outcome?$x$,
    NULL,
    $x${"purpose":"Accepting Influence - power sharing."}$x$::jsonb ),

  -- 9 ───────────────────────────────────────────────────────────────────────
  ( 'q09_repair_recovery', 9, 'short', 'likert5', 'communication',
    $x$[{"axis":"repair","weight":1.0}]$x$::jsonb, false,
    $x$כשיש בינינו ריב או מתח - באיזו תדירות אני מצליח/ה להוריד את החום (בדיחה, הפסקה, התנצלות) ושזה באמת שובר את הלופ?$x$,
    $x$When there's an argument or tension - how often does one of us manage to take the heat down (joke, break, apology) and it actually works?$x$,
    NULL,
    $x${"purpose":"Repair Attempts - can you de-escalate a tense moment?"}$x$::jsonb ),

  -- 10 ──────────────────────────────────────────────────────────────────────
  ( 'q10_criticism_vs_complaint', 10, 'full', 'likert5', 'communication',
    $x$[{"axis":"four_horsemen_criticism","weight":1.0}]$x$::jsonb, false,
    $x$בוויכוחים שלנו, באיזו תדירות עולים אצלנו משפטים כמו 'אתה תמיד...' או 'את אף פעם לא...'?$x$,
    $x$In our arguments, how often do I hear myself or my partner start sentences with 'you always…' or 'you never…'?$x$,
    NULL,
    $x${"purpose":"Four Horsemen - Criticism.","insight":"A high score here flags the need for Week-5 conflict track."}$x$::jsonb ),

  -- 11 ──────────────────────────────────────────────────────────────────────
  ( 'q11_contempt', 11, 'full', 'likert5', 'communication',
    $x$[{"axis":"four_horsemen_contempt","weight":1.0}]$x$::jsonb, false,
    $x$באיזו תדירות קורה שאחד מאיתנו מגלגל עיניים, לועג, או משתמש בטון של 'אתה לא מבין שום דבר' כלפי השני?$x$,
    $x$How often does one of us roll our eyes, mock, or use a 'you just don't get it' tone toward the other?$x$,
    NULL,
    $x${"purpose":"Four Horsemen - Contempt (single strongest divorce predictor in Gottman's data)."}$x$::jsonb ),

  -- 12 ──────────────────────────────────────────────────────────────────────
  ( 'q12_defensive', 12, 'full', 'likert5', 'communication',
    $x$[{"axis":"four_horsemen_defensive","weight":1.0}]$x$::jsonb, false,
    $x$כשבן/בת הזוג מעלה משהו שהפריע לו/ה - באיזו תדירות התגובה הראשונה שלי היא להסביר את עצמי, במקום להתעניין במה שהוא/היא חווה?$x$,
    $x$When my partner raises something that bothered them - how often is my first reaction to explain why it's not my fault, instead of listening?$x$,
    NULL,
    $x${"purpose":"Four Horsemen - Defensiveness."}$x$::jsonb ),

  -- 13 ──────────────────────────────────────────────────────────────────────
  ( 'q13_stonewall', 13, 'full', 'likert5', 'communication',
    $x$[{"axis":"four_horsemen_stonewall","weight":1.0}]$x$::jsonb, false,
    $x$כשהשיחה נהיית קשה - באיזו תדירות אחד מאיתנו מתנתק, שותק, מסתובב ועוזב את הדיון?$x$,
    $x$When a conversation gets hard - how often does one of us shut down, go silent, turn away, or leave the discussion?$x$,
    NULL,
    $x${"purpose":"Four Horsemen - Stonewalling (shutdown, usually later-stage)."}$x$::jsonb ),

  -- 14 ──────────────────────────────────────────────────────────────────────
  ( 'q14_autonomy_separateness', 14, 'full', 'likert5', 'intimacy',
    $x$[{"axis":"passion_autonomy","weight":1.0}]$x$::jsonb, false,
    $x$עד כמה אני עדיין סקרן/ית לגלות צדדים חדשים בבן/בת הזוג?$x$,
    $x$How much does my partner still surprise me - is there still a side of them I'm curious about, not fully predictable?$x$,
    NULL,
    $x${"purpose":"Passion - autonomy (Perel). Can you still see your partner as *other*?"}$x$::jsonb ),

  -- 15 ──────────────────────────────────────────────────────────────────────
  ( 'q15_anticipation', 15, 'short', 'likert5', 'intimacy',
    $x$[{"axis":"passion_anticipation","weight":1.0}]$x$::jsonb, false,
    $x$במהלך שבוע טיפוסי - עד כמה אני מוצא/ת את עצמי מחכה לרגע שאחזור לבן/בת הזוג?$x$,
    $x$In a typical week - how much do I find myself looking forward to something specific that happens between us?$x$,
    NULL,
    $x${"purpose":"Passion - anticipation. Is there something to look forward to with them?"}$x$::jsonb ),

  -- 16 ──────────────────────────────────────────────────────────────────────
  ( 'q16_play', 16, 'short', 'likert5', 'friendship',
    $x$[{"axis":"passion_play","weight":1.0}]$x$::jsonb, false,
    $x$בימים רגילים (לא רק באירועים מיוחדים) - עד כמה יש בינינו הומור משותף ובדיחות פנימיות?$x$,
    $x$How much humor, playful teasing, and shared laughter do we have on regular days (not just special occasions)?$x$,
    NULL,
    $x${"purpose":"Passion - play. Do you still joke, tease, have non-goal-oriented fun?"}$x$::jsonb ),

  -- 17 ──────────────────────────────────────────────────────────────────────
  ( 'q17_context_logistics', 17, 'short', 'likert5', 'family',
    $x$[{"axis":"passion_context","weight":-1.0}]$x$::jsonb, false,
    $x$כשיש לנו זמן רק לשנינו - באיזו תדירות השיחה עדיין מסתיימת בסופרמרקט, לו"ז, או רשימות מטלות?$x$,
    $x$When we're alone in the evening with no kids/work - how often does the conversation still end up on groceries, schedules, or to-do lists?$x$,
    NULL,
    $x${"purpose":"Passion - context. Negative weight: high score = bad (logistics eats us).","insight":"Inverted: 'almost always' = daily logistics dominate → low passion_context."}$x$::jsonb ),

  -- 18 ──────────────────────────────────────────────────────────────────────
  ( 'q19_rituals', 18, 'full', 'likert5', 'friendship',
    $x$[{"axis":"shared_meaning","weight":0.5}]$x$::jsonb, false,
    $x$עד כמה יש לנו רגעים קבועים ביום או בשבוע שרק שייכים לנו (קפה של בוקר, דייט קבוע, טקס ערב)?$x$,
    $x$Do we have a regular moment in the day or week that belongs only to us (morning coffee, standing date, evening ritual)?$x$,
    NULL,
    $x${"purpose":"Shared Meaning - rituals of connection (Gottman Pillar 2)."}$x$::jsonb ),

  -- 19 ──────────────────────────────────────────────────────────────────────
  ( 'q20_biggest_gap', 19, 'short', 'single_choice', NULL,
    $x$[]$x$::jsonb, false,
    $x$אם היה אפשר לשפר דבר אחד בלבד בזוגיות שלכם בחודש הקרוב - מה זה היה?$x$,
    $x$If you could improve one thing in your relationship this month, what would it be?$x$,
    $x$[{"id":"knowing","he":"להרגיש שמכירים אחד את השני באמת","en":"Feeling we really know each other again","scores":[{"axis":"love_map","weight":1}]},{"id":"appreciation","he":"לקבל יותר הערכה והכרה","en":"Getting more appreciation and recognition","scores":[{"axis":"fondness","weight":1}]},{"id":"closeness","he":"להרגיש יותר קרובים רגשית","en":"Feeling more emotionally close","scores":[{"axis":"turn_toward","weight":1}]},{"id":"fights","he":"לריב פחות","en":"Fighting less / recovering faster","scores":[{"axis":"repair","weight":1}]},{"id":"passion","he":"להרגיש יותר תשוקה ומשיכה","en":"Bringing back desire and attraction","scores":[{"axis":"passion_anticipation","weight":1}]},{"id":"direction","he":"להבין לאן אנחנו הולכים ביחד","en":"Understanding where we're heading together","scores":[{"axis":"shared_meaning","weight":1}]}]$x$::jsonb,
    $x${"purpose":"User-perceived top gap - used to weight recommendations."}$x$::jsonb ),

  -- 20 ──────────────────────────────────────────────────────────────────────
  ( 'q20a_urgency_now', 20, 'full', 'likert5', NULL,
    $x$[]$x$::jsonb, false,
    $x$בזמן האחרון אני מרגיש/ה שמשהו בזוגיות שלנו דורש שינוי, ושעכשיו הזמן לטפל בזה.$x$,
    $x$Lately I feel something in our relationship needs to change, and now is the time to act on it.$x$,
    NULL,
    $x${"purpose":"Self-rated urgency — how strongly the user feels NOW is the time to act on their relationship. Not scored; surfaces emotional weight for the coach."}$x$::jsonb ),

  -- 21 ──────────────────────────────────────────────────────────────────────
  ( 'q20b_intimacy_satisfaction', 21, 'short', 'likert5', NULL,
    $x$[]$x$::jsonb, false,
    $x$באיזו תדירות החיים המיניים שלנו משאירים אותי מחובר/ת ומסופק/ת?$x$,
    $x$How often does our intimate life leave me feeling connected and satisfied?$x$,
    NULL,
    $x${"purpose":"Self-rated intimacy satisfaction — frequency of feeling connected + satisfied. Not scored; flagged to coach."}$x$::jsonb ),

  -- 22 ──────────────────────────────────────────────────────────────────────
  ( 'q20c_what_hurts', 22, 'full', 'reflection', NULL,
    $x$[]$x$::jsonb, false,
    $x$מה הדבר שהכי כואב לך בזוגיות שלכם היום? אפילו במשפט אחד.$x$,
    $x$What hurts you most in your relationship today? Even in one sentence.$x$,
    NULL,
    $x${"purpose":"Open reflection — the single most painful thing in the relationship today.","max_length":600}$x$::jsonb ),

  -- 23 ──────────────────────────────────────────────────────────────────────
  ( 'q22a_success_signal', 23, 'short', 'reflection', NULL,
    $x$[]$x$::jsonb, false,
    $x$מה חסר לדעתכם שאם תפתרו בזוגיות יוכל לשנות את הזוגיות לחלוטין לצורה הטובה ביותר?$x$,
    $x$What do you feel is missing in your relationship that, if solved, could transform it for the better?$x$,
    NULL,
    $x${"purpose":"Open reflection - what is missing in the relationship that, if resolved, could transform it for the better. Bridges 'pain points' (q20c) with 'desired outcome'. Itzik 2026-06-02 rewrite.","max_length":600}$x$::jsonb ),

  -- 24 ──────────────────────────────────────────────────────────────────────
  ( 'q24_physical_closeness', 24, 'short', 'likert5', 'intimacy',
    $x$[{"axis":"love_language_touch","weight":0.5},{"axis":"passion_play","weight":0.5}]$x$::jsonb, false,
    $x$באיזו תדירות יש בינינו קרבה פיזית לא-מינית (חיבוק ארוך, יד על הכתף, להירדם צמודים)?$x$,
    $x$How often do we have non-sexual physical closeness (long hug, hand on shoulder, falling asleep close)?$x$,
    NULL,
    $x${"purpose":"Non-sexual physical closeness frequency."}$x$::jsonb ),

  -- 25 ──────────────────────────────────────────────────────────────────────
  ( 'q25_gratitude_expressed', 25, 'full', 'likert5', 'emotional_connection',
    $x$[{"axis":"fondness","weight":0.5},{"axis":"love_language_words","weight":0.5}]$x$::jsonb, false,
    $x$באיזו תדירות אני אומר/ת לבן/בת הזוג משהו ספציפי שאני מעריך/ה (למשל: 'אהבתי איך טיפלת בילד אתמול')?$x$,
    $x$How often do I tell my partner something specific I appreciate (not just a casual 'thanks')?$x$,
    NULL,
    $x${"purpose":"Expressed (not just felt) appreciation."}$x$::jsonb ),

  -- 26 ──────────────────────────────────────────────────────────────────────
  ( 'q26_partner_texts_unprompted', 26, 'full', 'likert5', 'friendship',
    $x$[{"axis":"turn_toward","weight":0.5},{"axis":"passion_anticipation","weight":0.5}]$x$::jsonb, false,
    $x$באיזו תדירות אנחנו יוצרים קשר באמצע היום - רק כדי להתחבר?$x$,
    $x$How often does my partner reach out to me mid-day for no practical reason - just to connect?$x$,
    NULL,
    $x${"purpose":"Small-bid frequency from partner (mid-day reaching out)."}$x$::jsonb ),

  -- 27 ──────────────────────────────────────────────────────────────────────
  ( 'q_priorities', 27, 'full', 'ranking', NULL,
    $x$[]$x$::jsonb, false,
    $x$דרג את תחומי הזוגיות לפי סדר החשיבות עבורך$x$,
    $x$Rank the relationship areas by personal priority$x$,
    NULL,
    $x${"purpose":"Captures the user's perceived priority order across 5 relationship domains. Drives the expert's per-partner alignment view.","insight":"Doesn't move diagnostic axes. Stored as ordered list of stable slugs in journey_responses; renders side-by-side with the partner's list in the expert dashboard for divergence flags.","he_subline":"הראשון הוא הכי חשוב לך, האחרון פחות. תוכל לגרור ולשנות את הסדר.","en_subline":"The first is most important to you, the last is least. Drag to reorder.","categories":[{"key":"communication","he":"תקשורת זוגית","en":"Couple Communication","he_desc":"איך אנחנו מדברים, מקשיבים ופותרים אי-הסכמות","en_desc":"How we talk, listen, and resolve disagreements"},{"key":"intimacy","he":"מיניות ואינטימיות","en":"Sexuality & Intimacy","he_desc":"החיים המיניים, המגע, הקרבה הפיזית והרצון","en_desc":"Sex life, touch, physical closeness, desire"},{"key":"emotional_connection","he":"אהבה וחיבור רגשי","en":"Love & Emotional Connection","he_desc":"תחושת קרבה, ביטויי אהבה, פתיחות רגשית","en_desc":"Closeness, expressions of love, emotional openness"},{"key":"friendship","he":"חברות ושותפות יומיומית","en":"Friendship & Daily Partnership","he_desc":"כיף, חוויות משותפות, שגרה והתנהלות יומיומית","en_desc":"Fun, shared experiences, daily routine"},{"key":"family","he":"משפחה, הורות ולחצים חיצוניים","en":"Family, Parenting & External Pressures","he_desc":"ילדים, משפחות מוצא, עבודה, כסף ולחצים מבחוץ","en_desc":"Kids, in-laws, work, money, outside pressures"}]}$x$::jsonb )

-- DO NOTHING (not DO UPDATE): once questions are edited in the admin (F2) the
-- DB is the source of truth, so a re-run of this seed must NEVER revert admin
-- edits. DO NOTHING still backfills any slug that's missing (e.g. a brand-new
-- question added to the JSON later) without clobbering existing rows.
ON CONFLICT (slug) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
