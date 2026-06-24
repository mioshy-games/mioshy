-- ───────────────────────────────────────────────────────────────────────────
-- 140_cms_texts_journey_weekly.sql
--
-- Seed the new "weekly guidance" section on the journey marketing page
-- (app/[locale]/journey/page.tsx, the first cream section under the hero) so its
-- copy is editable from the admin without a deploy. Lives under page='journey'
-- — the same bucket every other journeyHub.* key uses and that the page loads
-- via loadCmsTextsForPage("journey"). Plain text (is_rich=false): no markup, so
-- CmsText renders escaped text nodes.
-- Defaults mirror the next-intl JSON fallback (messages/{he,en}.json →
-- journeyHub.weekly.*), which is what the public site renders until this runs.
-- Idempotent. The DO UPDATE sets is_rich too, so re-runs enforce plain mode
-- (per the cms_texts seed contract).
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('journeyHub.weekly.eyebrow', 'journey', 'weekly',
   'הליווי השבועי שלכם', 'Your weekly guidance', false),
  ('journeyHub.weekly.title', 'journey', 'weekly',
   'כל שבוע, פרק חדש בזוגיות.', 'Every week, a new chapter in your relationship.', false),
  ('journeyHub.weekly.titleAccent', 'journey', 'weekly',
   'ומומחה צמוד.', 'And an expert by your side.', false),
  ('journeyHub.weekly.lede', 'journey', 'weekly',
   'כל שבוע נחזק אתכם בתחום אחר בזוגיות, עם שאלות ומשימות קטנות לאורך השבוע. אתם משתפים בחוויות ובמה שעולה לכם בצ׳אט עם המומחים שלנו, והם שם בשבילכם, נותנים כלים מעשיים ומלווים אתכם יד ביד בכל שלב בדרך לזוגיות עוצמתית יותר.',
   'Each week we strengthen a different area of your relationship, with small questions and tasks along the way. You share your experiences and whatever comes up in the chat with our experts, and they are there for you, giving practical tools and walking with you hand in hand at every step toward a stronger relationship.', false),
  ('journeyHub.weekly.cats.0.h', 'journey', 'weekly',
   'אינטימיות ומיניות', 'Intimacy and sexuality', false),
  ('journeyHub.weekly.cats.0.p', 'journey', 'weekly',
   'לבנות קרבה פיזית שמרגישה בטוחה וטבעית לשניכם.', 'Build physical closeness that feels safe and natural for you both.', false),
  ('journeyHub.weekly.cats.1.h', 'journey', 'weekly',
   'תקשורת זוגית', 'Couple communication', false),
  ('journeyHub.weekly.cats.1.p', 'journey', 'weekly',
   'לדבר ולהקשיב כך שתרגישו שבאמת שומעים אתכם.', 'Talk and listen in a way that leaves you feeling truly heard.', false),
  ('journeyHub.weekly.cats.2.h', 'journey', 'weekly',
   'חברות ושותפות', 'Friendship and partnership', false),
  ('journeyHub.weekly.cats.2.p', 'journey', 'weekly',
   'להחזיר את ההנאה מהדברים הקטנים שאתם עושים יחד.', 'Bring back the joy in the small things you do together.', false),
  ('journeyHub.weekly.cats.3.h', 'journey', 'weekly',
   'משפחה ושגרה', 'Family and routine', false),
  ('journeyHub.weekly.cats.3.p', 'journey', 'weekly',
   'להתמודד יחד עם הלחצים של היומיום והבית.', 'Face the pressures of everyday life and home together.', false),
  ('journeyHub.weekly.cats.4.h', 'journey', 'weekly',
   'קשר רגשי', 'Emotional connection', false),
  ('journeyHub.weekly.cats.4.p', 'journey', 'weekly',
   'לחזק את הקרבה והביטחון שביניכם ביומיום.', 'Strengthen the closeness and trust between you, every day.', false)
ON CONFLICT (key) DO UPDATE
  SET page    = EXCLUDED.page,
      section = EXCLUDED.section,
      he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text,
      is_rich = EXCLUDED.is_rich;
