-- 089_cms_texts_games_faq.sql
--
-- Seeds the `gamesHub.faq.*` CMS keys so the 8-question FAQ section
-- on /games (mounted via <FAQ cmsKeyPrefix="gamesHub.faq" ... />)
-- shows up in /admin/content as editable rows.
--
-- Source of truth before this migration: messages/he.json + en.json.
-- After it runs, the cms_texts rows take precedence so admins can
-- edit each question/answer independently without a deploy.
--
-- Schema:
--   - 4 header keys: eyebrow / headline / description / contactCta
--   - 8 question keys: item1Q .. item8Q  (plain text, no markup)
--   - 8 answer keys:   item1A .. item8A  (rich — each is a single <p>)
--
-- Page bucket: `games` (matches where the FAQ is rendered).
-- Section:     `faq` (groups all FAQ keys on the /games page).
--
-- `is_rich = TRUE` on answers because they contain <p> tags; admins
-- get the rich toolbar in /admin/content for those rows and can
-- safely add <em>, <strong>, <mark>, <br> as needed.
--
-- ON CONFLICT (key) DO NOTHING — safe to re-run; never clobbers an
-- admin edit already in the DB. Same pattern as 085 / 086 / 087 / 088.

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich)
VALUES
  -- ── HEADER ──────────────────────────────────────────────────────
  ('gamesHub.faq.eyebrow',
   'games', 'faq',
   'שאלות נפוצות',
   'FAQ',
   false),
  ('gamesHub.faq.headline',
   'games', 'faq',
   'מה שזוגות שואלים לפני שמתחילים.',
   'What couples ask before they start.',
   false),
  ('gamesHub.faq.description',
   'games', 'faq',
   'השאלות החוזרות על משחקי הזוגיות של מיאושי - איך זה עובד, למי זה מתאים, וכמה זה עולה. אם לא ענינו על שאלה ספציפית - דברו איתנו.',
   'The recurring questions about Mioshy''s couples games — how it works, who it''s for, and what it costs. If we missed your question, get in touch.',
   false),
  ('gamesHub.faq.contactCta',
   'games', 'faq',
   'דברו איתנו',
   'Talk to us',
   false),

  -- ── QUESTIONS (plain text) ───────────────────────────────────────
  ('gamesHub.faq.item1Q',
   'games', 'faq',
   'איך זה עובד בפועל?',
   'How does it actually work?',
   false),
  ('gamesHub.faq.item2Q',
   'games', 'faq',
   'צריך שני טלפונים או אחד?',
   'Do we need two phones or one?',
   false),
  ('gamesHub.faq.item3Q',
   'games', 'faq',
   'האם זה מתאים לזוגות עם וותק או רק לחדשים?',
   'Is it for long-term couples or just new ones?',
   false),
  ('gamesHub.faq.item4Q',
   'games', 'faq',
   'כמה זמן לוקח לשחק?',
   'How long does a game take?',
   false),
  ('gamesHub.faq.item5Q',
   'games', 'faq',
   'השאלות וולגריות או מביכות?',
   'Are the questions vulgar or embarrassing?',
   false),
  ('gamesHub.faq.item6Q',
   'games', 'faq',
   'מה אם בן/בת הזוג לא מוכן/ה?',
   'What if my partner isn''t ready?',
   false),
  ('gamesHub.faq.item7Q',
   'games', 'faq',
   'עד כמה זה פרטי? האם הנתונים נשמרים?',
   'How private is this? Is data saved?',
   false),
  ('gamesHub.faq.item8Q',
   'games', 'faq',
   'כמה זה עולה?',
   'How much does it cost?',
   false),

  -- ── ANSWERS (rich — each is a <p>) ───────────────────────────────
  ('gamesHub.faq.item1A',
   'games', 'faq',
   '<p>בוחרים משחק באתר, פותחים על הטלפון, ומתחילים. הכל אונליין - בלי הורדות, בלי התקנות, בלי הרשמה מסובכת. תוך 30 שניות אתם כבר משחקים.</p>',
   '<p>Pick a game on the site, open it on your phone, and start playing. Everything runs in the browser - no downloads, no installations, no complicated sign-ups. You''re playing within 30 seconds.</p>',
   true),
  ('gamesHub.faq.item2A',
   'games', 'faq',
   '<p>מספיק טלפון אחד. אתם משחקים אחד מול השני - השאלות עוברות ביניכם בתורות, או על מסך משותף. גם בסלון. גם במיטה. גם ברכב, אם נסעתם לחופשה.</p>',
   '<p>One phone is enough. You play face to face - questions move between you in turns, or on a shared screen. On the couch. In bed. In the car on the way to vacation.</p>',
   true),
  ('gamesHub.faq.item3A',
   'games', 'faq',
   '<p>מיאושי בנוי בעיקר לזוגות עם שנים של היכרות - מקום שבו השאלות הקלות כבר נשאלו, ויש מה לגלות מחדש. אבל זה עובד גם לזוגות צעירים יותר שרוצים להעמיק כבר עכשיו.</p>',
   '<p>Mioshy is built primarily for couples with years of history - a place where the easy questions have already been asked, and there''s something new to discover. But it works just as well for younger couples who want to go deeper now.</p>',
   true),
  ('gamesHub.faq.item4A',
   'games', 'faq',
   '<p>תלוי בכם. יש זוגות שמסיימים סבב ב-20 דקות. יש כאלה ששאלה אחת פותחת שיחה של שעתיים. אין כללים - תפסיקו כשאתם רוצים, תמשיכו כשבא לכם.</p>',
   '<p>Up to you. Some couples finish a round in 20 minutes. Others get a two-hour conversation out of a single question. No rules - stop when you want, continue when you feel like it.</p>',
   true),
  ('gamesHub.faq.item5A',
   'games', 'faq',
   '<p>לא. השאלות שלנו נוגעות, סקרניות, לפעמים נועזות - אבל תמיד מכבדות. כתבו אותן מומחי זוגיות, לא יוצרי תוכן. תוכלו לשחק בלי לחשוש שתיתקלו במשהו שיפגע במישהו מכם.</p>',
   '<p>No. Our questions are intimate, curious, sometimes bold - but always respectful. Written by couples-relationship experts, not content creators. You can play without worrying about hitting something that hurts either of you.</p>',
   true),
  ('gamesHub.faq.item6A',
   'games', 'faq',
   '<p>אל תציגו את זה כ"תיקון" או "טיפול". פשוט תגידו "בא לי לנסות משחק חדש איתך הערב". רוב הזוגות שמתחילים ככה - ממשיכים בכיף. המשחק מוכיח את עצמו בשאלה הראשונה.</p>',
   '<p>Don''t pitch it as a "fix" or "therapy." Just say "I want to try a new game with you tonight." Most couples who start that way keep going happily. The game proves itself on the first question.</p>',
   true),
  ('gamesHub.faq.item7A',
   'games', 'faq',
   '<p>הכל פרטי לחלוטין. השאלות נשארות בינכם - אנחנו לא רואים את התשובות, לא שומרים אותן, לא משתפים אותן עם אף אחד. הפרטיות שלכם קדושה.</p>',
   '<p>Completely private. The questions stay between you - we don''t see your answers, don''t store them, don''t share them with anyone. Your privacy is sacred.</p>',
   true),
  ('gamesHub.faq.item8A',
   'games', 'faq',
   '<p>התנסות - חינמית, בלי כרטיס אשראי. אחר כך אפשר לרכוש מנוי שבועי עם גישה לכל המשחקים "משחקי זוגות אונליין". בלי התחייבות, בלי קנסות - אפשר לעצור בלחיצת כפתור.</p>',
   '<p>Trial - free, no credit card. After that you can buy a weekly subscription with access to all the "Couples Games Online" titles. No commitment, no penalties - you can stop with one click.</p>',
   true)
ON CONFLICT (key) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
