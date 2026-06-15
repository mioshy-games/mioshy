-- 111_cms_texts_mioshy_sex_faq.sql
-- 2026-06-09 — Seed the /mioshy-sex FAQ into cms_texts so every Q&A +
-- the header keys are editable in the admin. The page now uses the shared
-- <FAQ> component (cmsKeyPrefix="mioshySexPage.faq"); content was migrated
-- from the legacy faqQ{n}/faqA{n} keys into mioshySexPage.faq.item{N}Q/A +
-- eyebrow/headline/description/contactCta. All plain text → is_rich=false.
-- ON CONFLICT (key) DO NOTHING — idempotent, never clobbers admin edits.
-- Run manually in Supabase.

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich)
VALUES
  ('mioshySexPage.faq.eyebrow', 'mioshy-sex', 'faq', 'שאלות נפוצות', 'FAQ', false),
  ('mioshySexPage.faq.headline', 'mioshy-sex', 'faq', 'שאלות שזוגות שואלים לפני הרכישה.', 'Questions couples ask before they buy.', false),
  ('mioshySexPage.faq.description', 'mioshy-sex', 'faq', 'אספנו את השאלות שזוגות שואלים אותנו לפני הרכישה. עדיין לא מצאתם תשובה?', 'The questions couples ask us before they buy. Still haven''t found an answer?', false),
  ('mioshySexPage.faq.contactCta', 'mioshy-sex', 'faq', 'דברו איתנו', 'Talk to us', false),
  ('mioshySexPage.faq.item1Q', 'mioshy-sex', 'faq', 'למה זה טוב? איך זה שונה מטיפים שאני יכול למצוא ברשת?', 'Why is this good? How is it different from tips I''d find online?', false),
  ('mioshySexPage.faq.item1A', 'mioshy-sex', 'faq', 'המשחקים שלנו נכתבו ע״י מומחים בעולם הסקסולוגיה והטיפול הזוגי, ועוצבו כחוויה שלמה — לא רשימת טיפים. כל משחק הוא מסע של שלבים, עם מתח שמצטבר ושיא שאתם זוכרים. זה מה שלא תמצאו במאמר באינטרנט: לא רעיונות, אלא מסגרת שמובילה אתכם דרך הערב.', 'Our games are written by leading sexologists and couples therapists, and designed as a complete experience — not a tip list. Each game is a staged journey with rising tension and a peak you''ll remember. That''s what an internet article can''t give you: not ideas, but a framework that walks you through the evening.', false),
  ('mioshySexPage.faq.item2Q', 'mioshy-sex', 'faq', 'מה אנחנו מקבלים בתום הרכישה?', 'What do we get when we finish purchasing?', false),
  ('mioshySexPage.faq.item2A', 'mioshy-sex', 'faq', 'גישה מיידית למשחק שרכשתם, לכל החיים, לשני בני הזוג. נפתח אזור פרטי ב״מיאושי שלי״ עם כל המשחקים שלכם — אפשר לחזור אליהם כמה פעמים שתרצו, בלי הגבלה. אין הורדות, אין התקנות. פותחים מהדפדפן בכל מכשיר.', 'Immediate access to the game you bought, for life, for both partners. A private space opens up in ''My Mioshy'' with all your games — replay as many times as you want, no limits. No downloads, no installs. Open it on any device through your browser.', false),
  ('mioshySexPage.faq.item3Q', 'mioshy-sex', 'faq', 'מתי מומלץ לשחק? צריך הכנה?', 'When is it recommended to play? Do we need to prepare?', false),
  ('mioshySexPage.faq.item3A', 'mioshy-sex', 'faq', 'הזמן הכי טוב הוא כשאתם רגועים, פנויים, ובמצב רוח. ערב סוף שבוע, חופשה קצרה, כל זמן שאתם מקדישים לעצמכם בלי הסחות. אין הכנה — נכנסים למשחק והוא מוביל אתכם. כל משחק כולל ציון של מה שצריך (אם בכלל) לפני ההתחלה.', 'The best time is when you''re relaxed, free, and in the mood. A weekend evening, a short getaway, any time you set aside for yourselves with no distractions. No prep needed — open the game and it leads you. Each game lists what''s needed (if anything) before you start.', false),
  ('mioshySexPage.faq.item4Q', 'mioshy-sex', 'faq', 'האם בן/בת הזוג מקבלים גישה למה שרכשתי?', 'Does my partner get access to what I purchased?', false),
  ('mioshySexPage.faq.item4A', 'mioshy-sex', 'faq', 'כן, אוטומטית. כשאתם רוכשים, נפתח לכם ״חלל זוגי״ — אזור משותף לשניכם. כל מה שאחד מכם רוכש פתוח לשני, מיד, באותו רגע. רכישה אחת = שניכם בפנים. אין צורך לקנות פעמיים.', 'Yes, automatically. When you purchase, a ''couple space'' opens for both of you — a shared area. Anything one of you buys is immediately accessible to the other. One purchase = both of you in. No need to buy twice.', false),
  ('mioshySexPage.faq.item5Q', 'mioshy-sex', 'faq', 'האם אפשר לקבל כסף חזרה אם זה לא מתאים?', 'Can we get a refund if it''s not a fit?', false),
  ('mioshySexPage.faq.item5A', 'mioshy-sex', 'faq', 'כן. עד 14 יום מהרכישה, אם לא התחלתם לשחק, נחזיר את התשלום במלואו — כתבו אלינו ב-support@mioshy.com ונסגור את זה. אחרי שהתחלתם — התוכן נחשף ולכן הרכישה לא ניתנת להחזרה.', 'Yes. Up to 14 days from purchase, if you haven''t started playing, we''ll refund in full — email us at support@mioshy.com and we''ll handle it. Once you''ve started, the content has been revealed so the purchase becomes non-refundable.', false),
  ('mioshySexPage.faq.item6Q', 'mioshy-sex', 'faq', 'צריך לקנות צעצועי מין?', 'Do I need to buy sex toys?', false),
  ('mioshySexPage.faq.item6A', 'mioshy-sex', 'faq', 'תלוי במשחק. חלק מהמשחקים משלבים צעצועים — וזה מצוין בעמוד של כל משחק. חלק לא דורשים שום ציוד. אתם בוחרים מראש.', 'Depends on the game. Some games incorporate toys — clearly listed on each game''s page. Others require no equipment at all. You choose upfront.', false),
  ('mioshySexPage.faq.item7Q', 'mioshy-sex', 'faq', 'זה דיסקרטי?', 'Is this discreet?', false),
  ('mioshySexPage.faq.item7A', 'mioshy-sex', 'faq', 'לחלוטין. החיוב מופיע תחת Mioshy בלבד — בלי שמות משחקים, בלי מילים אחרות. כל הנתונים מוצפנים, אנחנו לא מוכרים מידע, ואין פרסומות.', 'Completely. Billing shows only as Mioshy — no game titles, no other words. All data is encrypted, we don''t sell information, and there are no ads.', false),
  ('mioshySexPage.faq.item8Q', 'mioshy-sex', 'faq', 'מה אם אחד מאיתנו לא מוכן/ה?', 'What if one of us isn''t ready?', false),
  ('mioshySexPage.faq.item8A', 'mioshy-sex', 'faq', 'אז מתחילים ברמה הראשונה — שיחה ושאלות, בלי שום לחץ. רוב הזוגות שמתחילים שם מגלים שהשני נפתח באופן טבעי.', 'Then start at level one — talk and questions, no pressure. Most couples who start there find the other opens up naturally.', false)
ON CONFLICT (key) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
