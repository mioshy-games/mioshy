-- ============================================================
-- 065_journey_starter_content_he.sql
--
-- Per Itzik 2026-05-07 — UNBLOCK the post-purchase Journey
-- experience. Until this migration runs, the production DB has
-- no `journey_programs` row tagged with product_slug='journey',
-- so `assignJourneyOnPurchase` returns "no_program_configured"
-- silently and the user sees an empty desk after paying.
--
-- This migration:
--
--   1. Creates a Journey program tagged for the Cardcom 'journey'
--      product (idempotent on slug).
--
--   2. Attaches the five priority categories that earlier
--      migrations seeded as STANDALONE (program_id=NULL) to this
--      new program. The existing standalone rows have their own
--      assessment_priority_key values — we promote them.
--
--   3. Seeds 5 starter items per category (25 items total). Each
--      is hand-written editorial content suited for week-1 to
--      week-5 delivery (default_offset_days 0/7/14/21/28). The
--      first item in each category has offset=0 so it unlocks
--      immediately; the rest drip on the standard cadence.
--
-- All inserts use dollar-quoted text literals ($b$...$b$ and
-- $t$...$t$) so single quotes inside Hebrew (אג'נדה, ד"ר וכו')
-- don't break parsing. Real newlines are used directly inside the
-- dollar-quoted blocks.
--
-- All inserts are idempotent (`ON CONFLICT (...) DO UPDATE`) so
-- this can be re-run safely.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. The program
-- ────────────────────────────────────────────────────────────
INSERT INTO public.journey_programs (
  slug,
  name_he, name_en,
  description_he, description_en,
  product_slug,
  default_anchor,
  is_active,
  sort_weight
) VALUES (
  'journey-mvp',
  'ליווי עם מיאושי',
  'Journey with Mioshy',
  'תוכנית עבודה אישית — תרגולים, אבחון, ומשימות שבועיות מהמומחים שלנו.',
  'A personal work program — practices, assessment, and weekly tasks from our experts.',
  'journey',
  'purchase',
  true,
  0
)
ON CONFLICT (slug) DO UPDATE SET
  product_slug   = EXCLUDED.product_slug,
  is_active      = true,
  name_he        = EXCLUDED.name_he,
  name_en        = EXCLUDED.name_en,
  description_he = EXCLUDED.description_he,
  description_en = EXCLUDED.description_en,
  default_anchor = EXCLUDED.default_anchor,
  updated_at     = now();

-- ────────────────────────────────────────────────────────────
-- 2. Promote standalone priority categories to belong to this
--    program. The diagnostic showed five standalone rows with
--    these assessment_priority_key values:
--      communication, emotional_connection, family,
--      friendship, intimacy
--    Note: the Hebrew "love" category in some seeds is keyed as
--    'emotional_connection' rather than 'love'. We accept either
--    so the migration works regardless of which seed shipped.
-- ────────────────────────────────────────────────────────────
WITH program AS (
  SELECT id FROM public.journey_programs WHERE slug = 'journey-mvp' LIMIT 1
)
UPDATE public.journey_categories c
SET program_id = (SELECT id FROM program),
    updated_at = now()
WHERE c.assessment_priority_key IN (
  'communication','intimacy','love','emotional_connection',
  'friendship','family'
)
  AND c.program_id IS NULL;

-- ────────────────────────────────────────────────────────────
-- 3. Seed 25 starter items (5 per category).
-- ────────────────────────────────────────────────────────────

-- ── COMMUNICATION ─────────────────────────────────────────────
WITH cat AS (
  SELECT id FROM public.journey_categories
  WHERE assessment_priority_key = 'communication'
  LIMIT 1
)
INSERT INTO public.journey_items (
  category_id, slug, title_he, body_he, task_he,
  sort_order, default_offset_days, is_active
)
SELECT id, slug, title_he, body_he, task_he, sort_order, offset_days, true
FROM cat,
(VALUES
  (
    'comm-01-listening-window',
    '5 דקות של הקשבה — בלי לפתור',
    $b$הדבר הקשה ביותר בתקשורת זוגית הוא לא לדבר. זה לשתוק נכון.

רוב הריבים מתחילים כי אחד הצדדים *לא הרגיש שהוא נשמע* — לא כי הצד השני לא הסכים איתו, אלא כי הצד השני קפץ ישר לפתרון, להגנה, או לסיפור משלו.

המשימה הערב היא פשוטה: 5 דקות של הקשבה אחת לשנייה, בלי לפתור, בלי לקטוע. רק להקשיב.$b$,
    $t$בחרו זמן רגוע. אחד מכם מספר על משהו שהיה לו היום (לאו דווקא רע — סתם משהו). הצד השני מקשיב 5 דקות בלי לקטוע. בסוף — הוא חוזר במשפט קצר על מה שהבין שהיה משמעותי לבן/בת הזוג. ואז מתחלפים.$t$,
    1, 0
  ),
  (
    'comm-02-soft-startup',
    'איך פותחים שיחה קשה — בלי שהיא תתפוצץ',
    $b$90% משיחות הזוגיות שהופכות לריב נשברות בשניות הראשונות. ד"ר גוטמן קורא לזה "harsh startup" — פתיחה תוקפנית.

הפורמט של פתיחה רכה:
1. **אני** מרגיש/ה...
2. כש**זה** קורה...
3. ואני צריך/ה...

שלוש הנקודות האלה נמנעות מהאשמה — והן מעלות את הסיכוי שבן/בת הזוג ישמע ב-67% (מחקר גוטמן 1999).$b$,
    $t$כל אחד יבחר מצב אחד מהשבוע האחרון שהפריע לו (אפילו קטן). יכתוב את התלונה לפי הפורמט: "אני מרגיש [רגש]. כשזה [התרחיש]. ואני צריך [בקשה ספציפית]". יקראו אחד לשני בלי תגובה. רק להאזין.$t$,
    2, 7
  ),
  (
    'comm-03-repair-attempt',
    'תיקון תוך כדי ריב',
    $b$גם הזוגות הכי טובים רבים. ההבדל: הם יודעים לעצור באמצע.

"תיקון" (repair attempt) הוא משפט קטן שאומר "אני רוצה לרדת מהריב הזה". זה יכול להיות הומור, חיבוק, "סליחה, יצא לי ממש לא יפה", או פשוט "בא לי לעצור רגע".

המטרה: ליצור 3 משפטי-תיקון שאתם יכולים לזרוק כשהדם רותח, *מראש*, כשאתם רגועים. כי באמצע הריב המוח לא מייצר אותם לבד.$b$,
    $t$שבו יחד 10 דקות. כל אחד יציע 2 משפטים שעוזרים לו לרדת מריב. ביחד תבחרו 3 שמשמשים אתכם מעכשיו: שניים שלכם ואחד שאתם בחרתם ביחד. כתבו אותם בפתק על המקרר.$t$,
    3, 14
  ),
  (
    'comm-04-weekly-checkin',
    'הצ׳ק-אין השבועי — 20 דקות שמשנות הכל',
    $b$אחת לשבוע, באותו זמן קבוע, 20 דקות בלי טלפון, בלי ילדים, בלי טלוויזיה. שתי שאלות פשוטות:

1. **מה היה השבוע שלך?** (לא אצלנו — שלך כיחיד/ה)
2. **על מה אתה צריך אותי השבוע הבא?**

הזוגות שעושים את זה באופן עקבי מדווחים על שיפור משמעותי בתחושת חיבור תוך 6 שבועות. זה לא טיפול — זה תחזוקה.$b$,
    $t$בחרו יום ושעה קבועים (יום ראשון בערב? שבת בבוקר?). שמרו את זה ביומן כמו פגישה. השבוע — תרגלו פעם אחת את שתי השאלות.$t$,
    4, 21
  ),
  (
    'comm-05-disagree-without-attack',
    'איך להגיד "אני לא מסכים" בלי להפוך את זה לפגיעה',
    $b$יש הבדל בין *לא להסכים על דעה* לבין *לפסול את האדם*. רוב הזוגות מערבבים בין שני הדברים.

הפורמט: "אני שומע מה שאתה אומר. אני רואה את זה אחרת. אני חושב/ת ש[הדעה השונה שלך] — ואני לא חייב/ת שתסכים/י."

שני המפתחות: 1) "אני שומע" — מאשר שהאחר נשמע. 2) "אני לא חייב/ת שתסכים/י" — משחרר את הצד השני מהצורך לשנות את דעתו.$b$,
    $t$בחרו נושא קטן שאתם לא מסכימים עליו (איך לחנך, איזה סרט לראות, מה לבשל). תרגלו לומר את הפורמט אחד לשני. בלי להגיע להסכמה. רק לתרגל את האמירה.$t$,
    5, 28
  )
) AS items(slug, title_he, body_he, task_he, sort_order, offset_days)
ON CONFLICT (category_id, slug) DO UPDATE SET
  title_he   = EXCLUDED.title_he,
  body_he    = EXCLUDED.body_he,
  task_he    = EXCLUDED.task_he,
  sort_order = EXCLUDED.sort_order,
  default_offset_days = EXCLUDED.default_offset_days,
  is_active  = true,
  updated_at = now();

-- ── INTIMACY ─────────────────────────────────────────────────
WITH cat AS (
  SELECT id FROM public.journey_categories
  WHERE assessment_priority_key = 'intimacy'
  LIMIT 1
)
INSERT INTO public.journey_items (
  category_id, slug, title_he, body_he, task_he,
  sort_order, default_offset_days, is_active
)
SELECT id, slug, title_he, body_he, task_he, sort_order, offset_days, true
FROM cat,
(VALUES
  (
    'intim-01-touch-without-agenda',
    'מגע — בלי שיוביל לסקס',
    $b$אחת הסיבות שאינטימיות פיזית מתייבשת אצל זוגות ותיקים: כל מגע "מסמן" משהו. חיבוק = "אני רוצה לעשות אהבה". יד על הברך = "התקרבות". וזה לוחץ.

הפתרון: להחזיר מגע *בלי אג׳נדה*. חיבוק כי בא לכם לחבק. יד ביד כי אתם הולכים יחד. נשיקה כי שלום.

החזרה של מגע יומיומי לא-מיני היא הצעד הראשון להחזיר את המיני.$b$,
    $t$הערב — 3 מגעים קטנים, בלי שום ציפייה לסקס. נשיקה ארוכה אחת ליד דלת המקרר. 30 שניות חיבוק. יד על הכתף תוך כדי שהוא/היא מבשל/ת. זהו.$t$,
    1, 0
  ),
  (
    'intim-02-emotional-foreplay',
    'הקדמה רגשית — לפני הקדמה פיזית',
    $b$אצל רוב הנשים, החשק לא מתעורר *פתאום*. הוא מתעורר *מחיבור*.

זה אומר: שעתיים לפני שאתם מצפים שמשהו יקרה במיטה — תהיו נחמדים אחד לשני. שיחה רגישה. הקשבה. צחוק. *אז* הגוף נפתח.

גברים, זה נכון גם לכם — אבל הציר שלכם לרוב הפוך: סקס מוביל לחיבור רגשי. הזוגיות הבריאה מאזנת את שניהם.$b$,
    $t$הערב — בלי לדבר על סקס בכלל. השקיעו שעה במשהו רגשי: לראות סרט יחד מחובקים, לדבר על משהו עמוק, לבשל יחד תוך שיחה. ראו מה קורה אחרי.$t$,
    2, 7
  ),
  (
    'intim-03-desire-conversation',
    'שיחה אחת על מה שאתם אוהבים',
    $b$רוב הזוגות לא מדברים על סקס בכלל. עושים — לא מדברים. וזה גורם לכך שהשני לא יודע מה כיף לכם, ואתם לא יודעים מה כיף לו/לה.

המשימה: שיחה אחת, 15 דקות, על מה שטוב לכם. לא ביקורת על מה שלא טוב. רק מה כן.

כלל: כשאחד מדבר, השני לא מתייחס בנגיעה — רק שואל ומקשיב.$b$,
    $t$מצאו זמן בלי לחץ. כל אחד עונה: "מה הדבר שאתה הכי אוהב שאני עושה לך במיטה?" 15 דקות, בלי שיפוטיות.$t$,
    3, 14
  ),
  (
    'intim-04-novelty-experiment',
    'דבר אחד חדש',
    $b$אינטימיות שגרתית היא טובה ובטוחה — אבל גם משעממת לאחר זמן. לא צריך להפוך את עולמכם הפוך, מספיק *דבר אחד חדש* כל חודש.

זה יכול להיות: זמן אחר ביום (במקום ערב — בוקר). מקום אחר (לא רק חדר השינה). תאורה אחרת. אביזר חדש. מילים שאתם אומרים. מה שלא תכננתם — ועובדים אחד עם השני לתכנן.$b$,
    $t$רשמו במקום נסתר 3 דברים שאתם רוצים לנסות. כל אחד 3. החליפו רשימות. בחרו דבר אחד שמתאים לשניכם, ותכננו אותו לסוף השבוע.$t$,
    4, 21
  ),
  (
    'intim-05-after-care',
    'ה-15 דקות שאחרי',
    $b$מה שקורה *אחרי* האקט המיני קובע אם הזיכרון יהיה חיובי או עמום. רוב הזוגות נופלים לשינה או לטלפון. זה הרגע שהמוח מקודד את הזיכרון — ואיך שתסיימו, ככה תזכרו.

15 דקות שאחרי: להישאר צמודים. לדבר משהו רגשי. לחבק. לא ללכת מיד למקלחת או לטלפון. זה הזמן הכי אינטימי בכל האקט — ולרוב מבוזבז.$b$,
    $t$בפעם הבאה שתהיו אינטימיים — תוודאו שאחרי, אתם נשארים יחד 10-15 דקות מינימום. לא לקפוץ. לא לטלפון. רק יחד.$t$,
    5, 28
  )
) AS items(slug, title_he, body_he, task_he, sort_order, offset_days)
ON CONFLICT (category_id, slug) DO UPDATE SET
  title_he   = EXCLUDED.title_he,
  body_he    = EXCLUDED.body_he,
  task_he    = EXCLUDED.task_he,
  sort_order = EXCLUDED.sort_order,
  default_offset_days = EXCLUDED.default_offset_days,
  is_active  = true,
  updated_at = now();

-- ── EMOTIONAL CONNECTION / LOVE ──────────────────────────────
-- Some seeds use 'emotional_connection' instead of 'love'. We
-- match either so the migration works against both schemas.
WITH cat AS (
  SELECT id FROM public.journey_categories
  WHERE assessment_priority_key IN ('emotional_connection','love')
  ORDER BY assessment_priority_key
  LIMIT 1
)
INSERT INTO public.journey_items (
  category_id, slug, title_he, body_he, task_he,
  sort_order, default_offset_days, is_active
)
SELECT id, slug, title_he, body_he, task_he, sort_order, offset_days, true
FROM cat,
(VALUES
  (
    'love-01-love-language-test',
    'איזו שפת אהבה אתם מדברים — ולמה זה לא תמיד אותה',
    $b$גארי צ׳פמן זיהה 5 שפות אהבה: מילות התעוררות, מגע פיזי, מתנות, פעולות שירות, זמן איכות.

המלכודת: כל אחד מאיתנו נותן אהבה בשפה שהוא *מקבל* בה. אבל אם בן/בת הזוג מקבל אהבה בשפה אחרת, אנחנו מרגישים שאנחנו נותנים — והוא/היא מרגיש/ה שלא מקבל/ת.$b$,
    $t$כל אחד יבחר את 2 שפות האהבה שהכי "מדברות" אליו. שתפו אחד את השני. שבוע הבא — נסו "לדבר" 1-2 פעמים את השפה של בן/בת הזוג, גם אם זה לא טבעי לכם.$t$,
    1, 0
  ),
  (
    'love-02-appreciation-ritual',
    'משפט הערכה אחד ביום',
    $b$ד"ר גוטמן מצא שזוגות מצליחים נותנים 5 חיוביות מול 1 שלילית במהלך אינטראקציה. רוב הזוגות שמגיעים לטיפול עומדים על 1:1 או הפוך.

תרגיל פשוט: כל יום, פעם אחת, להגיד תודה ספציפית. לא "תודה" סתמי — תודה ספציפית. "תודה ששמת לי קפה לפני שיצאת — זה עשה לי את הבוקר".$b$,
    $t$מהיום, פעם ביום, אמרו תודה ספציפית. כתבו אותה בפתק אם לא נמצאים יחד. שבוע — 7 משפטי תודה. תראו מה קורה.$t$,
    2, 7
  ),
  (
    'love-03-falling-back-in-love',
    'מה גרם לי להתאהב בך?',
    $b$הזיכרונות הראשוניים שלנו על הזוגיות הם הדלק שלה. כשאנחנו שוכחים אותם — הזוגיות מאבדת את הסיבה שלה להתקיים.

המשימה היא לחדש את הסיפור. לזכור איך זה התחיל. מה ראיתי בו/ה. למה אמרתי כן. הסיפור הזה לא רק נחמד — הוא ה*עוגן* שמחזיר אותנו כשאנחנו רחוקים.$b$,
    $t$שבו 20 דקות. כל אחד יספר: "מה היה הרגע שהבנתי שאני מאוהב/ת?" "מה הדבר הראשון שמשך אותי אליך?" אם אתם זוכרים סיפור משותף — תספרו אותו אחד לשני, גם אם שניכם יודעים אותו.$t$,
    3, 14
  ),
  (
    'love-04-small-rituals',
    'שלושת ה"חוזים" הקטנים',
    $b$זוגות בריאים בנויים על "חוזים" קטנים שהם לא מודעים אליהם: נשיקה לפני שיוצאים. הודעה בצוהריים. חיבוק כשאחד מהם חוזר. אלה לא הרגלים — אלה *טקסים*.

הבעיה: כשעמוסים, החוזים הקטנים נשמטים ראשונים. ואיתם נשמטת הזוגיות.$b$,
    $t$זהו 3 טקסים קטנים שהיו לכם פעם וקצת נשכחו. החליטו על אחד שאתם מחזירים החל מהיום. כתבו אותו במקום שתראו (תזכורת בטלפון, פתק על המקרר).$t$,
    4, 21
  ),
  (
    'love-05-dream-talk',
    'מה אתם רוצים בעוד 5 שנים?',
    $b$זוגות שמדברים על העתיד יחד נשארים יחד יותר. זה לא קסם — זה כי הם בונים *משותף*.

השיחה הזו לא חייבת להיות כבדה. "איפה היית רוצה לחיות בעוד 5 שנים?" "מה היית רוצה ללמוד?" "איך הילדים שלנו צריכים להיראות?" אלה שאלות שמחברות, לא מפרידות.$b$,
    $t$שיחה אחת, 30 דקות, בלי טלפון. שאלה אחת לכל אחד. ענו ביושר, אפילו אם זה לא יפה. אל תתקנו אחד את השני.$t$,
    5, 28
  )
) AS items(slug, title_he, body_he, task_he, sort_order, offset_days)
ON CONFLICT (category_id, slug) DO UPDATE SET
  title_he   = EXCLUDED.title_he,
  body_he    = EXCLUDED.body_he,
  task_he    = EXCLUDED.task_he,
  sort_order = EXCLUDED.sort_order,
  default_offset_days = EXCLUDED.default_offset_days,
  is_active  = true,
  updated_at = now();

-- ── FRIENDSHIP ───────────────────────────────────────────────
WITH cat AS (
  SELECT id FROM public.journey_categories
  WHERE assessment_priority_key = 'friendship'
  LIMIT 1
)
INSERT INTO public.journey_items (
  category_id, slug, title_he, body_he, task_he,
  sort_order, default_offset_days, is_active
)
SELECT id, slug, title_he, body_he, task_he, sort_order, offset_days, true
FROM cat,
(VALUES
  (
    'friend-01-share-a-day',
    'לחזור להיות חברים — לא רק שותפים',
    $b$אחרי כמה שנים יחד, רוב הזוגות הופכים לשותפים: ילדים, חשבונות, לוגיסטיקה. החברות נשמטת ראשונה.

האבחון: מתי בפעם האחרונה שאלת אותו/אותה משהו לא-לוגיסטי? "איך היה לך באמת היום?" "מה צחיק אותך לאחרונה?" "מה הסדרה שאתה אובד עליה?" — אלה שאלות של חברים.$b$,
    $t$ערב אחד — אסור לדבר על: ילדים, כסף, עבודה, או רשימת קניות. רק על מה שמעניין אתכם בתור בני אדם. אם משעמם — זה הסימן שצריך עוד.$t$,
    1, 0
  ),
  (
    'friend-02-show-curiosity',
    'הסקרנות — הדלק של חברות זוגית',
    $b$אנחנו חושבים שאנחנו מכירים אחד את השני. ואחרי 10-20 שנה, רוב הזמן זה אפילו נכון. אבל בני אדם משתנים — דעות, חלומות, פחדים מתעדכנים. אם אנחנו מפסיקים להתעדכן, אנחנו חיים עם בן/בת זוג שכבר לא קיים/ת.$b$,
    $t$כל אחד יבחר שאלה אחת לשאול: "מה דעתך על X לאחרונה?" / "מה היית רוצה לנסות שלא ניסית?" / "מה משעמם אותך?" שאלה אמיתית, לא רטורית.$t$,
    2, 7
  ),
  (
    'friend-03-shared-laugh',
    'הצחוק המשותף',
    $b$מחקרים מראים שזוגות שצוחקים יחד הם הזוגות שנשארים יחד. הצחוק הוא ה"דבק" הפסיכולוגי של החברות.

הבעיה: כשעמוסים, צוחקים פחות. וכשצוחקים פחות, החברות נסוגה. זה מעגל אכזרי.$b$,
    $t$מצאו 30 דקות לעשות משהו שמצחיק אתכם. סטנד-אפ. סדרת קומדיה. משחק אבסורדי שאתם אוהבים. תקופת ההומור היא תרופה לזוגיות.$t$,
    3, 14
  ),
  (
    'friend-04-do-something-new',
    'דבר אחד שלא עשיתם יחד',
    $b$הניסיון המשותף יוצר זיכרונות חדשים — והזיכרונות הם חומר הגלם של הזוגיות.

אם אתם תמיד עושים את אותו דבר (אותו מסעדה, אותה הסכמה, אותו טיול), המוח מפסיק לקודד את זה כ"חוויה". זה הופך לרקע. לעומת זאת, חוויה חדשה — אפילו פשוטה — נחקקת.$b$,
    $t$בחרו פעילות אחת שלא עשיתם יחד אף פעם. לא חייב להיות גדול: ללמוד מתכון חדש, לראות סוג סרט שאתם לא רגילים, לבקר באזור בעיר שלא הייתם בו. תכננו אותה לתוך השבועיים הקרובים.$t$,
    4, 21
  ),
  (
    'friend-05-the-fond-memory',
    'הזיכרון הטוב — תרגיל החיבור',
    $b$כשהזוגיות עכורה, המוח מתחיל לבחור זיכרונות שליליים. ככל שיותר זיכרונות שליליים נשלפים, ככה הזוגיות מתחזקת בחושך. זה נקרא "negative sentiment override" (גוטמן).

האנטידוט: ביוזמה, לבחור זיכרון *טוב* לחלוק. לא חייב להיות גדול. סתם רגע מצחיק. סתם פעם שהיה כיף. המוח, כשמזכיר זיכרון טוב, "נדבק" שוב לזוגיות.$b$,
    $t$כל אחד יבחר זיכרון אחד טוב מהזוגיות שלכם — מהשנה האחרונה. יספר אותו אחד לשני, ב-2 משפטים. תופתעו כמה זה מחבר.$t$,
    5, 28
  )
) AS items(slug, title_he, body_he, task_he, sort_order, offset_days)
ON CONFLICT (category_id, slug) DO UPDATE SET
  title_he   = EXCLUDED.title_he,
  body_he    = EXCLUDED.body_he,
  task_he    = EXCLUDED.task_he,
  sort_order = EXCLUDED.sort_order,
  default_offset_days = EXCLUDED.default_offset_days,
  is_active  = true,
  updated_at = now();

-- ── FAMILY ───────────────────────────────────────────────────
WITH cat AS (
  SELECT id FROM public.journey_categories
  WHERE assessment_priority_key = 'family'
  LIMIT 1
)
INSERT INTO public.journey_items (
  category_id, slug, title_he, body_he, task_he,
  sort_order, default_offset_days, is_active
)
SELECT id, slug, title_he, body_he, task_he, sort_order, offset_days, true
FROM cat,
(VALUES
  (
    'family-01-couple-first',
    'הזוג קודם — לא הילדים',
    $b$אחת הטעויות הגדולות בהורות: לשים את הילדים לפני הזוגיות. נראה הגיוני, נכון? הם תלויים בנו.

אבל מחקרים מראים את ההפך: ילדים שגדלים אצל זוג שמדגיש את הזוגיות שלו, מתפתחים *טוב יותר* — כי הם מרגישים שהבסיס יציב.

זה לא אומר להזניח את הילדים. זה אומר שצריך זמן זוגי מוגן — ובלעדיו, כל המערכת מתערערת.$b$,
    $t$בחרו ערב אחד בשבוע שהוא "ערב זוג" — אחרי שהילדים בשינה. זה זמן מוגן: לא טלפונים, לא טלוויזיה אם אפשר, רק אתם. שעה מספיקה.$t$,
    1, 0
  ),
  (
    'family-02-united-front',
    'חזית אחידה — בלי "אבא הרשה"',
    $b$ילדים מאוד מהר לומדים לפצל בין שני ההורים. זה פסיכולוגי טבעי. הבעיה: כשההורים נופלים לזה, סמכותם נפגעת — והם רבים אחד עם השני.

כלל ברזל: לא מתווכחים על חינוך מול הילדים. אם יש אי-הסכמה — דוחים את ההכרעה ל"בוא נדבר על זה אחר כך".$b$,
    $t$מהיום, אם בן/בת הזוג קיבל/ה החלטה חינוכית מול הילדים — לא מתעמתים. אומרים "סבבה" ומדברים אחרי שהילדים בשינה. שום ילד לא ינוצל לזוגיות שלכם.$t$,
    2, 7
  ),
  (
    'family-03-bedroom-rule',
    'חדר השינה הוא לזוג',
    $b$בעידן של ילדים שזוחלים לחדר באמצע הלילה, חדר השינה הזוגי הופך להיות חדר משפחתי. וזה הורג את הזוגיות.

זה לא אכזרי לסגור את הדלת. זה הכרחי. הזוגיות שלכם זקוקה לחלל פיזי משלה — אחרת היא נעלמת.$b$,
    $t$החלטה שמשפחה: מהשבוע הזה, חדר השינה הוא לכם. ילד שצריך — בא לחדר שלו. דלת נסגרת בערב. במידה והם קטנים מדי לזה — מצאו את האיזון, אבל תכווננו את הקריטריון.$t$,
    3, 14
  ),
  (
    'family-04-extended-family',
    'משפחה מורחבת — מתי לעצור',
    $b$ההורים, האחים, החמים והחמים — כולם רוצים להיות חלק. אבל כל קשר משפחתי מורחב צריך לעבור דרך *הסכמה זוגית*, לא דרך אחד מבני הזוג בלבד.

כשבן/בת הזוג מרגיש שהמשפחה של הצד השני "פולשת" — זה הופך לחיכוך גדול בזוגיות.$b$,
    $t$יש סכסוך / לחץ עם משפחה מורחבת? שבו 20 דקות בלי האשמות, ופשוט תקשיבו זה לזה. כל אחד יגיד מה קשה לו. אחר כך — תחליטו ביחד מה הגבול שלכם.$t$,
    4, 21
  ),
  (
    'family-05-rituals-create-belonging',
    'טקסים יוצרים שייכות',
    $b$המשפחה היא לא רק ביולוגיה. היא טקסים. ארוחת שישי. משחק קופסה אחת לחודש. בריכה בכל שבת. אלה הדברים שילדים זוכרים — לא הקניות הגדולות.

וזה לא רק לילדים. הטקסים הקטנים האלה הם גם הזוגיות שלכם. הם מסמלים "אנחנו משפחה".$b$,
    $t$בחרו טקס משפחתי אחד שאתם רוצים להחזיר או לייצר. לא חייב להיות מסובך. כתבו אותו ביומן. השבוע — תרגלו פעם אחת.$t$,
    5, 28
  )
) AS items(slug, title_he, body_he, task_he, sort_order, offset_days)
ON CONFLICT (category_id, slug) DO UPDATE SET
  title_he   = EXCLUDED.title_he,
  body_he    = EXCLUDED.body_he,
  task_he    = EXCLUDED.task_he,
  sort_order = EXCLUDED.sort_order,
  default_offset_days = EXCLUDED.default_offset_days,
  is_active  = true,
  updated_at = now();

-- ────────────────────────────────────────────────────────────
-- 4. Reload PostgREST schema cache so the API picks up the new
--    rows immediately (mirrors what migration 064 does).
-- ────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
