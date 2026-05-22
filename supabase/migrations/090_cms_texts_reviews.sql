-- 090_cms_texts_reviews.sql
--
-- Seed CMS rows for the "ReviewsGrid" section on HomepageV2.
--
-- Background: ReviewsGrid was promoted from a generic widget to a
-- proper homepage section on 2026-05-18 (eyebrow + headline + 6 cards).
-- Every visible string in components/marketing/v2/ReviewsGrid.tsx
-- already flows through <CmsText cmsKey="homeV2.reviews.*">, so the
-- public site renders correctly via next-intl fallback from
-- messages/{he,en}.json. BUT — without seeded rows in cms_texts, the
-- keys do NOT show up in /admin/content, so admins can't edit them
-- (Itzik flagged this 2026-05-21 trying to edit "הזוגות שלנו משתפים").
--
-- This migration seeds all 27 ReviewsGrid keys.
--
-- Shape of the section:
--   • HEAD:   eyebrow, title, loadMore             (3 keys)
--   • CARDS:  item{1..6}{Text,Initial,Name,Source} (24 keys)
--   ─────────────────────────────────────────
--   Total: 27 rows.
--
-- All `is_rich = false` — testimonial bodies are plain text. The
-- quote marks are baked into the strings themselves; no <em> or
-- other HTML lives in any value, so plain mode is correct.
--
-- ON CONFLICT (key) DO NOTHING — safe to re-run; never clobbers
-- existing admin edits. Same pattern as 085–088.

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich)
VALUES
  -- ── HEAD ─────────────────────────────────────────────────────────
  ('homeV2.reviews.eyebrow',
   'homepage', 'reviews',
   'זוגות מספרים',
   'Couples talking',
   false),
  ('homeV2.reviews.title',
   'homepage', 'reviews',
   'הזוגות שלנו משתפים',
   'What our couples share',
   false),
  ('homeV2.reviews.loadMore',
   'homepage', 'reviews',
   'טען עוד המלצות',
   'Load more reviews',
   false),

  -- ── CARD 1 — שירה לוי ───────────────────────────────────────────
  ('homeV2.reviews.item1Text',
   'homepage', 'reviews',
   '"אז קניתי את ''52 דרכים להסעיר אותך'' כמתנה ליום ההולדת של בעלי, כי רציתי לגוון ולהפתיע. בלי ציפיות גבוהות, עם כמה דרינקים, העברנו ערב מהמם. אחלה משחק - ממליצה."',
   '"I bought ''52 Ways to Drive You Wild'' as a birthday gift for my husband, just to mix things up and surprise him. No high expectations, a couple of drinks, and we had an amazing night. Great game — recommend."',
   false),
  ('homeV2.reviews.item1Initial',
   'homepage', 'reviews',
   'ש',
   'S',
   false),
  ('homeV2.reviews.item1Name',
   'homepage', 'reviews',
   'שירה לוי',
   'Shira Levi',
   false),
  ('homeV2.reviews.item1Source',
   'homepage', 'reviews',
   '11 שנים יחד',
   '11 years together',
   false),

  -- ── CARD 2 — דניאל ק. ───────────────────────────────────────────
  ('homeV2.reviews.item2Text',
   'homepage', 'reviews',
   '"בעבר ניסינו טיפול זוגי - זה עזר לרגע, אבל היה משהו כבד בכל המפגשים. מהרגע שהצטרפנו לליווי של מיאושי, הכל נעשה קל - השיתוף והתחזוקה של הזוגיות הפכו לכיף. ממליצה בחום..."',
   '"We tried couples therapy before - it helped for a moment, but every session felt heavy. The minute we joined Mioshy''s coaching, everything got light. Sharing and tending to the relationship became fun. Strongly recommend..."',
   false),
  ('homeV2.reviews.item2Initial',
   'homepage', 'reviews',
   'ד',
   'D',
   false),
  ('homeV2.reviews.item2Name',
   'homepage', 'reviews',
   'דניאל ק.',
   'Daniel K.',
   false),
  ('homeV2.reviews.item2Source',
   'homepage', 'reviews',
   'נשואים 13 שנים',
   'Married 13 years',
   false),

  -- ── CARD 3 — רוני ויובל ─────────────────────────────────────────
  ('homeV2.reviews.item3Text',
   'homepage', 'reviews',
   '"אנחנו לקוחות 4 שנים. כל פעם שאני אומרת ליובל ''אולי נוריד את המנוי?'' יוצא משהו חדש. ערכה חדשה, אתגר חדש, משחק שלא הכרנו. הם פשוט לא נותנים לנו להתעייף אחד מהשנייה. אחרי 16 שנה."',
   '"We''ve been customers for 4 years. Every time I tell Yuval ''maybe we should cancel?'' something new drops. New kit, new challenge, a game we hadn''t seen. They just don''t let us get tired of each other. After 16 years."',
   false),
  ('homeV2.reviews.item3Initial',
   'homepage', 'reviews',
   'ר',
   'R',
   false),
  ('homeV2.reviews.item3Name',
   'homepage', 'reviews',
   'רוני ויובל',
   'Roni & Yuval',
   false),
  ('homeV2.reviews.item3Source',
   'homepage', 'reviews',
   'בזוגיות 16 שנים',
   'Together 16 years',
   false),

  -- ── CARD 4 — מיכל ועידן ──────────────────────────────────────────
  ('homeV2.reviews.item4Text',
   'homepage', 'reviews',
   '"אגיד את זה ככה - היום זו השיחה הקבועה של יום שני בערב אצלנו: ''מה המשימה הפעם?''. עידן רץ לבדוק מה יש במיאושי לפני. דבר שלא חשבתי שיכול לקרות אצלנו."',
   '"I''ll put it like this - Monday-night talk in our house is now: ''what''s the task this time?'' Idan races to check Mioshy first. Something I never thought could happen with us."',
   false),
  ('homeV2.reviews.item4Initial',
   'homepage', 'reviews',
   'מ',
   'M',
   false),
  ('homeV2.reviews.item4Name',
   'homepage', 'reviews',
   'מיכל ועידן',
   'Michal & Idan',
   false),
  ('homeV2.reviews.item4Source',
   'homepage', 'reviews',
   'נשואים 8 שנים',
   'Married 8 years',
   false),

  -- ── CARD 5 — עינת ברוך ──────────────────────────────────────────
  ('homeV2.reviews.item5Text',
   'homepage', 'reviews',
   '"לקחתי את בעלי למלון ליום הולדת, ופתאום הבנתי שאין לנו ממש תוכנית לערב. הורדתי משחק של מיאושי, וזה הציל את הסיטואציה. צחקנו, שתינו, ודיברנו על דברים שלא דיברנו עליהם בחיים. הוא עוד מדבר על הערב הזה."',
   '"I took my husband to a hotel for his birthday and suddenly realized we had no plan for the evening. I downloaded a Mioshy game, and it saved the night. We laughed, drank, and talked about things we''d never talked about. He still brings up that evening."',
   false),
  ('homeV2.reviews.item5Initial',
   'homepage', 'reviews',
   'ע',
   'E',
   false),
  ('homeV2.reviews.item5Name',
   'homepage', 'reviews',
   'עינת ברוך',
   'Einat Baruch',
   false),
  ('homeV2.reviews.item5Source',
   'homepage', 'reviews',
   'נשואה 9 שנים',
   'Married 9 years',
   false),

  -- ── CARD 6 — טל ועומרי ──────────────────────────────────────────
  ('homeV2.reviews.item6Text',
   'homepage', 'reviews',
   '"ביום האהבה כל המסעדות היו מלאות, אז במקום לצאת - הורדנו משחק של מיאושי בבית. זה היה ערב הרבה יותר טוב מכל מסעדה שהיינו בה השנה. רצינית."',
   '"On Valentine''s Day every restaurant was packed, so instead of going out we downloaded a Mioshy game at home. It was a way better night than any restaurant we hit this year. Seriously."',
   false),
  ('homeV2.reviews.item6Initial',
   'homepage', 'reviews',
   'ט',
   'T',
   false),
  ('homeV2.reviews.item6Name',
   'homepage', 'reviews',
   'טל ועומרי',
   'Tal & Omri',
   false),
  ('homeV2.reviews.item6Source',
   'homepage', 'reviews',
   'בזוגיות 6 שנים',
   'Together 6 years',
   false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
