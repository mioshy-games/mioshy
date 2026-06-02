-- ============================================================
-- Migration 106 — seed CMS rows for the expert-page gate explainer
-- ============================================================
-- Itzik 2026-06-02: /my/expert used to silently redirect non-journey
-- users to /my/lessons. That broke discoverability — the connection
-- between "chat with expert" and "Mioshy journey program" wasn't
-- visible anywhere. The page now renders an explainer with a
-- state-aware CTA:
--   • no assessment yet → "להתחיל אבחון חינם" → /journey/assessment
--   • assessment done   → "להצטרף לליווי"     → /journey
--
-- These rows feed both copies via the same CMS namespace so admins
-- can tweak language without a code change.
--
-- All keys live under page='app-shell', section='expert' so they show
-- up alongside the existing expert.* rows in the admin UI.
-- Idempotent: ON CONFLICT (key) DO NOTHING — re-running the migration
-- after manual admin edits won't overwrite their changes.
-- ============================================================

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('appShell.expert.gateChip', 'app-shell', 'expert',
    'מומחה זוגיות פרטי',
    'Private relationship expert', false),

  ('appShell.expert.gateTitleNoAssessment', 'app-shell', 'expert',
    'כדי לפתוח צ׳אט עם מומחה, מתחילים באבחון',
    'Chat with an expert starts with the assessment', false),

  ('appShell.expert.gateTitleHasAssessment', 'app-shell', 'expert',
    'האבחון שלכם מוכן — נשאר רק להצטרף לליווי',
    'Your assessment is ready — just join the program', false),

  ('appShell.expert.gateBodyNoAssessment', 'app-shell', 'expert',
    'צ׳אט פרטי עם מומחה זוגיות נכלל בליווי של מיאושי. כדי שהמומחה יוכל ללוות אתכם נכון, אנחנו מתחילים באבחון קצר של כ-10 דקות שמראה איפה הקשר חזק ואיפה כדאי לעבוד.',
    'Private chat with a relationship expert is part of the Mioshy program. So your expert can guide you the right way, we start with a short 10-minute assessment that shows where the connection is strong and where there''s room to grow.', false),

  ('appShell.expert.gateBodyHasAssessment', 'app-shell', 'expert',
    'סיימתם את האבחון - יפה. השלב הבא הוא להצטרף לליווי שבועי, ואז תוכלו לפתוח את הצ׳אט עם המומחה שמותאם לכם ולקבל פרקים מותאמים אישית.',
    'Assessment done — nice. The next step is to join the weekly program, then you can open the chat with your matched expert and start receiving personalized chapters.', false),

  ('appShell.expert.gateCtaAssessment', 'app-shell', 'expert',
    'להתחיל אבחון חינם', 'Start the free assessment', false),

  ('appShell.expert.gateCtaSubscribe', 'app-shell', 'expert',
    'להצטרף לליווי', 'Join the program', false),

  ('appShell.expert.gateBullet1', 'app-shell', 'expert',
    'מומחה זוגיות פרטי לצ׳אט, 7 ימים בשבוע',
    'Private relationship expert in chat, 7 days a week', false),

  ('appShell.expert.gateBullet2', 'app-shell', 'expert',
    'פרקים מותאמים אישית מתוצאות האבחון',
    'Personalized chapters based on your assessment', false),

  ('appShell.expert.gateBullet3', 'app-shell', 'expert',
    'מענה תוך 24 שעות, אפשר לעצור בכל רגע',
    'Replies within 24 hours, cancel any time', false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
