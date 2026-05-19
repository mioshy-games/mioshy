-- 086_cms_texts_intimacy.sql
--
-- Seed CMS rows for the new "Intimacy" section on HomepageV2.
--
-- Background: the Intimacy section was added on 2026-05-18 between
-- Hero and ForWhom. The component (components/marketing/v2/Intimacy.tsx)
-- consumes every visible string via <CmsText>. Until this migration
-- runs, those keys exist only in messages/he.json + messages/en.json —
-- which makes the public site render correctly via next-intl fallback,
-- but means the keys do NOT appear in /admin/content for editing.
--
-- This migration seeds all 24 Intimacy keys into cms_texts so admins
-- can edit them from the dashboard without a deploy.
--
-- Shape of the section (as of 2026-05-18):
--   • TOP HALF (currently NOT rendered — JSX trimmed on Itzik's call,
--     but the JSON keys, CSS, and CmsText wiring are retained on disk
--     for possible re-introduction). 12 keys: eyebrow, headlinePart1,
--     headlineEm, lead, feels1..4Quote, feels1..4Body.
--   • BRIDGE (rendered):  bridgeEyebrow, bridgeHeadlinePart1,
--                         bridgeHeadlineEm, bridgeBody. (4 keys)
--   • PILLARS (rendered): pillar1..3Title, pillar1..3Body. (6 keys)
--   • CTA (rendered):     ctaPrimary, ctaSecondary. (2 keys)
--
-- Total: 24 rows.
--
-- All `is_rich = false` — the <em> emphasis that lives in the bridge
-- and main headlines is carried in JSX, not in the JSON values, so
-- every seeded string is plain text.
--
-- ON CONFLICT (key) DO NOTHING — safe to re-run; never clobbers
-- existing admin edits. Same pattern as 085_cms_texts_about_founder.

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich)
VALUES
  -- ── TOP HALF — head (NOT currently rendered) ───────────────────────
  ('homeV2.intimacy.eyebrow',
   'homepage', 'intimacy',
   'הכאב הכי שקט בזוגיות',
   'The quietest pain in a relationship',
   false),
  ('homeV2.intimacy.headlinePart1',
   'homepage', 'intimacy',
   'אפשר להיות ביחד — ',
   'You can be together — ',
   false),
  ('homeV2.intimacy.headlineEm',
   'homepage', 'intimacy',
   'ועדיין להרגיש לבד.',
   'and still feel alone.',
   false),
  ('homeV2.intimacy.lead',
   'homepage', 'intimacy',
   'לישון באותה מיטה. לחלוק את אותו לוח זמנים. להזמין את אותו אוכל. ועדיין לחפש זה את זה. הבדידות בזוגיות היא לא חוסר אהבה — היא חוסר אינטימיות. והיא לא קורית כשמשהו נשבר. היא קורית כשמפסיקים להזין.',
   'Sleep in the same bed. Share the same calendar. Order from the same place. And still search for each other. Loneliness inside a relationship isn''t the absence of love — it''s the absence of intimacy. And it doesn''t happen when something breaks. It happens when we stop feeding it.',
   false),

  -- ── TOP HALF — "feels like" quote cards (NOT currently rendered) ───
  ('homeV2.intimacy.feels1Quote',
   'homepage', 'intimacy',
   '"מתי בפעם האחרונה דיברנו על משהו אמיתי?"',
   '"When did we last talk about something real?"',
   false),
  ('homeV2.intimacy.feels1Body',
   'homepage', 'intimacy',
   'השיחות הפכו ללוגיסטיקה. מי אוסף את הילדים. מה צריך בסופר. רק זה.',
   'Conversations turned logistical. Who picks up the kids. What''s needed from the store. Just that.',
   false),
  ('homeV2.intimacy.feels2Quote',
   'homepage', 'intimacy',
   '"הוא לידי — והראש שלי במסך."',
   '"They''re right next to me — and my head is in my phone."',
   false),
  ('homeV2.intimacy.feels2Body',
   'homepage', 'intimacy',
   'יחד בסלון. כל אחד בעולם משלו. שעות שעוברות בלי שאחד מאיתנו הרים את העיניים.',
   'In the same room. In two different worlds. Hours go by without one of us looking up.',
   false),
  ('homeV2.intimacy.feels3Quote',
   'homepage', 'intimacy',
   '"כבר לא בטוח/ה מה הוא חושב/ת באמת."',
   '"I''m not sure what they really think anymore."',
   false),
  ('homeV2.intimacy.feels3Body',
   'homepage', 'intimacy',
   'בהתחלה ידענו הכל אחד על השני. עכשיו יש דברים שכבר לא שואלים. ולא תמיד מבינים למה.',
   'We used to know everything about each other. Now there are things we just don''t ask. And don''t always understand why.',
   false),
  ('homeV2.intimacy.feels4Quote',
   'homepage', 'intimacy',
   '"מתגעגע/ת אליו/ה — והוא/היא ממש כאן."',
   '"I miss them — and they''re right here."',
   false),
  ('homeV2.intimacy.feels4Body',
   'homepage', 'intimacy',
   'הקרבה הפיזית עוד פה. הרגשית — איפשהו בדרך אבדה. ואין רגע מדויק שאפשר להצביע עליו.',
   'Physical closeness is here. Emotional closeness slipped away somewhere along the way. No clean moment to point to.',
   false),

  -- ── BRIDGE — section opener now that the top half is hidden ────────
  ('homeV2.intimacy.bridgeEyebrow',
   'homepage', 'intimacy',
   'ואיך מיאושי פותרת את זה',
   'And how Mioshy solves it',
   false),
  ('homeV2.intimacy.bridgeHeadlinePart1',
   'homepage', 'intimacy',
   'לא טיפול. כלים שעובדים ',
   'Not therapy. Tools that work ',
   false),
  ('homeV2.intimacy.bridgeHeadlineEm',
   'homepage', 'intimacy',
   'בלי לעצור את החיים.',
   'without putting life on hold.',
   false),
  ('homeV2.intimacy.bridgeBody',
   'homepage', 'intimacy',
   'אנחנו משלבים שנות ניסיון בליווי זוגי עם משחקים, אתגרים, שאלות שלא נשאלות ומומחה אישי שמכיר אתכם לעומק. הכל בנוי לזוגות אמיתיים, עם חיים אמיתיים, שאין להם זמן ל-50 דקות על ספה.',
   'We bring years of couples coaching together with games, challenges, questions you''ve never asked, and a personal expert who knows you deeply. Built for real couples with real lives — no 50-minute couch sessions required.',
   false),

  -- ── PILLARS — 3 differentiators ────────────────────────────────────
  ('homeV2.intimacy.pillar1Title',
   'homepage', 'intimacy',
   'אישי לכם',
   'Personal to you',
   false),
  ('homeV2.intimacy.pillar1Body',
   'homepage', 'intimacy',
   'כל זוג מקבל מסלול משלו. כי אין שני זוגות שזהים, ולא אמורה להיות תשובה אחת לכולם.',
   'Every couple gets their own path. No two couples are the same — and one answer can''t fit them all.',
   false),
  ('homeV2.intimacy.pillar2Title',
   'homepage', 'intimacy',
   'מהיר ופרקטי',
   'Fast and practical',
   false),
  ('homeV2.intimacy.pillar2Body',
   'homepage', 'intimacy',
   '10 דקות ביום, לא שעה בשבוע. נכנס לחיים שלכם, לא דורש לעצור אותם.',
   '10 minutes a day, not an hour a week. Fits into your life — it doesn''t ask you to stop it.',
   false),
  ('homeV2.intimacy.pillar3Title',
   'homepage', 'intimacy',
   'יצירתי, לא מאיים',
   'Playful, not heavy',
   false),
  ('homeV2.intimacy.pillar3Body',
   'homepage', 'intimacy',
   'משחקים, שאלות, רגעים קטנים שמשנים את הטון. בלי ספה, בלי פנקס, בלי להרגיש שבדקו אותכם.',
   'Games, questions, small moments that shift the tone. No couch, no notepad, no feeling examined.',
   false),

  -- ── CTA pair ───────────────────────────────────────────────────────
  ('homeV2.intimacy.ctaPrimary',
   'homepage', 'intimacy',
   'רוצה להפסיק להרגיש לבד',
   'I want to stop feeling alone',
   false),
  ('homeV2.intimacy.ctaSecondary',
   'homepage', 'intimacy',
   'איך מיאושי עובדת',
   'How Mioshy works',
   false)
ON CONFLICT (key) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
