-- 154_cms_texts_couples_assessment.sql
--
-- Seed cms_texts for the new /couples-assessment marketing landing (built from
-- docs/assessment-intro-mockup-v12.html). Namespace: couplesAssessment.*,
-- page = 'couples-assessment'. All copy is admin-editable here; the page
-- sections also carry a bilingual inline fallback in CassessContent, and the
-- FAQ (shared homepage component) falls back to messages/*.json.
--
-- Additive: new keys only, ON CONFLICT (key) DO NOTHING. FAQ answers are
-- is_rich (they ship <p> markup); everything else is plain.

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  -- ── HERO ──────────────────────────────────────────────────────────────
  ('couplesAssessment.hero.eyebrow', 'couples-assessment', 'hero',
    'אבחון זוגי · חינם', 'Couples assessment · free', false),
  ('couplesAssessment.hero.h1', 'couples-assessment', 'hero',
    'איפה אתם היום, ולאן אפשר להגיע?', 'Where are you today, and how far can you go?', false),
  ('couplesAssessment.hero.sub', 'couples-assessment', 'hero',
    'אבחון קצר ותקבלו תמונה רחבה על הזוגיות שלכם!',
    'A short assessment, and you get a broad picture of your relationship.', false),
  ('couplesAssessment.hero.cta', 'couples-assessment', 'hero',
    'להתחיל את האבחון', 'Start the assessment', false),
  ('couplesAssessment.hero.trust', 'couples-assessment', 'hero',
    '3 דקות · בלי כרטיס אשראי', '3 minutes · no credit card', false),
  ('couplesAssessment.hero.startLabel', 'couples-assessment', 'hero',
    'נקודת ההתחלה שלכם', 'Your starting point', false),
  ('couplesAssessment.hero.goalLabel', 'couples-assessment', 'hero',
    'היעד', 'The goal', false),
  ('couplesAssessment.hero.bar1', 'couples-assessment', 'hero', 'אינטימיות', 'Intimacy', false),
  ('couplesAssessment.hero.bar2', 'couples-assessment', 'hero', 'חיבור רגשי', 'Emotional', false),
  ('couplesAssessment.hero.bar3', 'couples-assessment', 'hero', 'תקשורת', 'Communication', false),
  ('couplesAssessment.hero.bar4', 'couples-assessment', 'hero', 'חברות', 'Friendship', false),
  ('couplesAssessment.hero.bar5', 'couples-assessment', 'hero', 'משפחה', 'Family', false),

  -- ── WHAT YOU GET ──────────────────────────────────────────────────────
  ('couplesAssessment.what.lead', 'couples-assessment', 'what',
    'איפה הזוגיות שלכם חזקה ואיפה כדאי לשפר?',
    'Where is your relationship strong, and where to improve?', false),
  ('couplesAssessment.what.h2', 'couples-assessment', 'what',
    'תמונת מצב אישית של הזוגיות שלכם', 'A personal picture of your relationship', false),
  ('couplesAssessment.what.body', 'couples-assessment', 'what',
    'תוך 3 דקות תקבלו ניתוח אישי המראה היכן הקשר חזק, איפה נוצר פער, ואיפה נמצא הפוטנציאל הגדול ביותר לשינוי. בלי ניחושים - תמונת מצב אמיתית של הזוגיות שלכם.',
    'In 3 minutes you get a personal analysis showing where the bond is strong, where a gap formed, and where the biggest potential for change is. No guessing, a real picture of your relationship.', false),

  -- ── DOMAINS ───────────────────────────────────────────────────────────
  ('couplesAssessment.domains.lead', 'couples-assessment', 'domains', 'מה בודקים?', 'What we check', false),
  ('couplesAssessment.domains.h2', 'couples-assessment', 'domains',
    'חמשת התחומים שאנחנו בוחנים', 'The five areas we examine', false),
  ('couplesAssessment.domains.d1Name', 'couples-assessment', 'domains', 'אינטימיות', 'Intimacy', false),
  ('couplesAssessment.domains.d1Desc', 'couples-assessment', 'domains',
    'הקרבה הפיזית, התשוקה והנוכחות שלכם זה עבור זה.',
    'Physical closeness, desire, and being present for each other.', false),
  ('couplesAssessment.domains.d2Name', 'couples-assessment', 'domains', 'חיבור רגשי', 'Emotional connection', false),
  ('couplesAssessment.domains.d2Desc', 'couples-assessment', 'domains',
    'עד כמה אתם מרגישים מובנים, קרובים ושותפים אמיתיים.',
    'How understood, close, and truly partnered you feel.', false),
  ('couplesAssessment.domains.d3Name', 'couples-assessment', 'domains', 'תקשורת', 'Communication', false),
  ('couplesAssessment.domains.d3Desc', 'couples-assessment', 'domains',
    'איך אתם מדברים, מקשיבים ומתקנים את הקשר אחרי ריב.',
    'How you talk, listen, and repair after a fight.', false),
  ('couplesAssessment.domains.d4Name', 'couples-assessment', 'domains', 'חברות', 'Friendship', false),
  ('couplesAssessment.domains.d4Desc', 'couples-assessment', 'domains',
    'הכיף, הצחוק והרגעים הקטנים של היומיום יחד.',
    'The fun, laughter, and small everyday moments together.', false),
  ('couplesAssessment.domains.d5Name', 'couples-assessment', 'domains', 'משפחה', 'Family', false),
  ('couplesAssessment.domains.d5Desc', 'couples-assessment', 'domains',
    'ההתמודדות עם ההורות והמשפחה, והתיאום ההדדי ביניכם.',
    'Handling parenting and family, and how you coordinate.', false),

  -- ── GAP TO GOAL ───────────────────────────────────────────────────────
  ('couplesAssessment.gap.lead', 'couples-assessment', 'gap', 'מפער ליעד', 'From gap to goal', false),
  ('couplesAssessment.gap.h2', 'couples-assessment', 'gap',
    'לראות את הפער זה הצעד הראשון לסגור אותו',
    'Seeing the gap is the first step to closing it', false),
  ('couplesAssessment.gap.cta', 'couples-assessment', 'gap', 'להתחיל את האבחון', 'Start the assessment', false),
  ('couplesAssessment.gap.step1Title', 'couples-assessment', 'gap', 'רואים את הפער', 'See the gap', false),
  ('couplesAssessment.gap.step1Body', 'couples-assessment', 'gap',
    'איפה הזוגיות שלכם היום, מול איפה אתם רוצים שתהיה.',
    'Where your relationship is today vs. where you want it.', false),
  ('couplesAssessment.gap.step2Title', 'couples-assessment', 'gap', 'יודעים מאיפה מתחילים', 'Know where to start', false),
  ('couplesAssessment.gap.step2Body', 'couples-assessment', 'gap',
    'התחום עם הפוטנציאל הכי גדול לשיפור, מסומן בבירור.',
    'The area with the most room to grow, clearly marked.', false),
  ('couplesAssessment.gap.step3Title', 'couples-assessment', 'gap', 'מתקדמים ליעד', 'Move toward the goal', false),
  ('couplesAssessment.gap.step3Body', 'couples-assessment', 'gap',
    'צעד אחרי צעד, ממקום מדויק - וסוגרים את הפער.',
    'Step by step, from a precise place, and close the gap.', false),

  -- ── CLOSING ───────────────────────────────────────────────────────────
  ('couplesAssessment.closing.eyebrow', 'couples-assessment', 'closing', 'מוכנים להתחיל?', 'Ready to begin?', false),
  ('couplesAssessment.closing.h2', 'couples-assessment', 'closing',
    'קליק אחד זה כל מה שמפריד ביניכם לבין הזוגיות שמגיעה לכם.',
    'One click is all that stands between you and the relationship you deserve.', false),
  ('couplesAssessment.closing.trust', 'couples-assessment', 'closing', 'בלי כרטיס אשראי', 'No credit card', false),
  ('couplesAssessment.closing.cta', 'couples-assessment', 'closing', 'קדימה לאבחון', 'Start the assessment', false),

  -- ── FAQ (shared homepage component; answers are rich) ─────────────────
  ('couplesAssessment.faq.eyebrow', 'couples-assessment', 'faq', 'שאלות נפוצות', 'FAQ', false),
  ('couplesAssessment.faq.headline', 'couples-assessment', 'faq',
    'כל מה שכדאי לדעת על האבחון', 'Everything worth knowing about the assessment', false),
  ('couplesAssessment.faq.description', 'couples-assessment', 'faq',
    'שאלות קצרות, תשובות ברורות. ואם נשאר משהו - אנחנו כאן.',
    'Short questions, clear answers. And if anything''s left, we''re here.', false),
  ('couplesAssessment.faq.contactCta', 'couples-assessment', 'faq', 'דברו איתנו', 'Talk to us', false),
  ('couplesAssessment.faq.item1Q', 'couples-assessment', 'faq', 'מה בודק האבחון?', 'What does the assessment check?', false),
  ('couplesAssessment.faq.item1A', 'couples-assessment', 'faq',
    '<p>חמישה תחומים שמרכיבים את הזוגיות: אינטימיות, חיבור רגשי, תקשורת, חברות ומשפחה.</p>',
    '<p>Five areas that make up a relationship: intimacy, emotional connection, communication, friendship, and family.</p>', true),
  ('couplesAssessment.faq.item2Q', 'couples-assessment', 'faq', 'כמה זמן האבחון?', 'How long is the assessment?', false),
  ('couplesAssessment.faq.item2A', 'couples-assessment', 'faq',
    '<p>כ-3 דקות. שאלות קצרות וברורות, בלי שאלונים מתישים.</p>',
    '<p>About 3 minutes. Short, clear questions, no exhausting questionnaires.</p>', true),
  ('couplesAssessment.faq.item3Q', 'couples-assessment', 'faq', 'האם זה חינם?', 'Is it free?', false),
  ('couplesAssessment.faq.item3A', 'couples-assessment', 'faq',
    '<p>כן, האבחון חינם לגמרי. בלי כרטיס אשראי ובלי התחייבות.</p>',
    '<p>Yes, the assessment is completely free. No credit card and no commitment.</p>', true),
  ('couplesAssessment.faq.item4Q', 'couples-assessment', 'faq', 'האם זה דיסקרטי?', 'Is it discreet?', false),
  ('couplesAssessment.faq.item4A', 'couples-assessment', 'faq',
    '<p>לחלוטין. התשובות שלכם פרטיות ומשמשות רק לבניית התמונה האישית שלכם.</p>',
    '<p>Completely. Your answers are private and used only to build your personal picture.</p>', true),
  ('couplesAssessment.faq.item5Q', 'couples-assessment', 'faq', 'למה חשוב לדעת מה המצב שלנו?', 'Why does it matter to know where we stand?', false),
  ('couplesAssessment.faq.item5A', 'couples-assessment', 'faq',
    '<p>קשה לשנות משהו שלא רואים. תמונת מצב ברורה היא הצעד הראשון לכל שיפור בזוגיות.</p>',
    '<p>It''s hard to change something you can''t see. A clear picture is the first step to any improvement.</p>', true)
ON CONFLICT (key) DO NOTHING;

COMMIT;
