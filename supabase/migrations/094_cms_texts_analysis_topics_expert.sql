-- 094_cms_texts_analysis_topics_expert.sql
--
-- Backfill cms_texts for the two new sections added to the journey
-- AnalysisSummary on 2026-05-29:
--   1. "Topics we'll work on" — 5 priority categories (communication,
--      intimacy, emotional_connection, friendship, family) with names
--      and short descriptions, sourced from journey/questionnaire.json.
--   2. "Expert emphasis" — premium card pre-CTA emphasizing the real
--      couples expert in a private 1:1 chat, always available, who
--      learns the couple over time.
--
-- ON CONFLICT (key) DO NOTHING — safe to re-run; admin edits win. Same
-- convention as migrations 085-091.

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  -- Topics covered
  ('journeyAssessment.analysis.topicsLabel', 'journey-assessment', 'analysis',
    'תחומי העבודה', 'Areas we''ll work on', false),
  ('journeyAssessment.analysis.topicsTitle', 'journey-assessment', 'analysis',
    'חמישה תחומים. נתחיל מהעדיפות שבחרתם.',
    'Five domains. We start with the one you ranked first.', false),
  ('journeyAssessment.analysis.topicsSub', 'journey-assessment', 'analysis',
    'בכל תחום נעבוד עם כלים, תרגולים ומחקר מהטובים בעולם — גוטמן, צ׳פמן, פרל, סו ג׳ונסון. אישי לכם, לא קורס מוכן.',
    'Each domain combines proven tools, exercises, and research — Gottman, Chapman, Perel, Sue Johnson. Personal to you, not a generic course.', false),

  ('journeyAssessment.analysis.topic1Name', 'journey-assessment', 'analysis',
    'תקשורת זוגית', 'Couple Communication', false),
  ('journeyAssessment.analysis.topic1Desc', 'journey-assessment', 'analysis',
    'איך אנחנו מדברים, מקשיבים ופותרים אי-הסכמות.',
    'How we talk, listen, and resolve disagreements.', false),

  ('journeyAssessment.analysis.topic2Name', 'journey-assessment', 'analysis',
    'מיניות ואינטימיות', 'Sexuality & Intimacy', false),
  ('journeyAssessment.analysis.topic2Desc', 'journey-assessment', 'analysis',
    'החיים המיניים, המגע, הקרבה הפיזית והרצון.',
    'Your sex life, touch, physical closeness, desire.', false),

  ('journeyAssessment.analysis.topic3Name', 'journey-assessment', 'analysis',
    'אהבה וחיבור רגשי', 'Love & Emotional Connection', false),
  ('journeyAssessment.analysis.topic3Desc', 'journey-assessment', 'analysis',
    'תחושת קרבה, ביטויי אהבה, פתיחות רגשית.',
    'Closeness, expressions of love, emotional openness.', false),

  ('journeyAssessment.analysis.topic4Name', 'journey-assessment', 'analysis',
    'חברות ושותפות יומיומית', 'Friendship & Daily Partnership', false),
  ('journeyAssessment.analysis.topic4Desc', 'journey-assessment', 'analysis',
    'כיף, חוויות משותפות, שגרה והתנהלות יומיומית.',
    'Fun, shared experiences, the daily routine.', false),

  ('journeyAssessment.analysis.topic5Name', 'journey-assessment', 'analysis',
    'משפחה, הורות ולחצים חיצוניים', 'Family, Parenting & External Pressures', false),
  ('journeyAssessment.analysis.topic5Desc', 'journey-assessment', 'analysis',
    'ילדים, משפחות מוצא, עבודה, כסף ולחצים מבחוץ.',
    'Kids, in-laws, work, money, outside pressures.', false),

  -- Expert emphasis
  ('journeyAssessment.analysis.expertLabel', 'journey-assessment', 'analysis',
    'הליווי האישי', 'Personal guidance', false),
  ('journeyAssessment.analysis.expertTitle', 'journey-assessment', 'analysis',
    'מומחה זוגיות אישי מחכה לכם בצ׳אט פרטי',
    'A real couples expert, waiting for you in a private chat', false),
  ('journeyAssessment.analysis.expertBody', 'journey-assessment', 'analysis',
    'לא בוט. לא תור. לא פגישה ב-9 בבוקר. אדם אמיתי, שמכיר את הסיפור שלכם — מה עניתם באבחון, מה ענה בן/בת הזוג, ומה עבד עליכם בשבועות האחרונים.',
    'Not a bot. Not a queue. Not a 9am appointment. A real person who knows your story — what you answered, what your partner answered, and what''s been working for you these last few weeks.', false),

  ('journeyAssessment.analysis.expertBullet1', 'journey-assessment', 'analysis',
    'זמין שבעה ימים בשבוע — שולחים שאלה ברגע שעולה, מקבלים מענה כשמוכנים',
    'Available seven days a week — send a question the moment it comes up, get a real reply when ready', false),
  ('journeyAssessment.analysis.expertBullet2', 'journey-assessment', 'analysis',
    'לומד אתכם כזוג — איך אתם מדברים, מה מכביד, מה מאיר',
    'Learns you as a couple — how you talk, what weighs you down, what lights you up', false),
  ('journeyAssessment.analysis.expertBullet3', 'journey-assessment', 'analysis',
    'התוכן והתרגולים מתעדכנים לפי איפה שאתם — כל שבוע מחדש',
    'Your content and exercises update to match where you actually are — every week, fresh', false),
  ('journeyAssessment.analysis.expertBullet4', 'journey-assessment', 'analysis',
    'צ׳אט פרטי 1:1, רק שלכם — לא פורומים, לא אפליקציה משותפת',
    'A private 1:1 chat, just yours — no forums, no shared app', false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
