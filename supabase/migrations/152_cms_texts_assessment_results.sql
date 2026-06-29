-- 152_cms_texts_assessment_results.sql
--
-- Seed the new static copy of the redesigned short-assessment results screen
-- (components/journey/AnalysisSummary.tsx, route /journey/assessment) so it is
-- editable from the admin. Namespace: journeyAssessment.results.*
--
-- The component carries the same strings as bilingual inline fallbacks, so the
-- page renders correctly even before this runs; once seeded, an admin edit to
-- a row overrides the fallback (blanking a row falls back to the literal).
--
-- NOT seeded here (by design): prices, cadences, and the AI/scored content —
-- those are DATA, not CMS. Additive: new keys only, ON CONFLICT DO NOTHING.

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('journeyAssessment.results.eyebrow', 'journey-assessment', 'results',
    'תוצאות האבחון שלכם', 'Your assessment results', false),
  ('journeyAssessment.results.heroSub', 'journey-assessment', 'results',
    'השלמת את האבחון. ניתחנו את הנתונים שלך, ובנינו עבורך תמונת מצב אישית שמראה איפה הזוגיות חזקה, ואיפה נמצא הפוטנציאל הגדול ביותר לשיפור.',
    'You completed the assessment. We analysed your answers and built a personal picture showing where the relationship is strong, and where the biggest potential to improve is.', false),
  ('journeyAssessment.results.heroLink', 'journey-assessment', 'results',
    'להצטרף לייעוץ הזוגי עם מיאושי', 'Join couples coaching with Mioshy', false),
  ('journeyAssessment.results.feedbackLabel', 'journey-assessment', 'results',
    'המשוב האישי שלכם', 'Your personal feedback', false),
  ('journeyAssessment.results.categoriesLabel', 'journey-assessment', 'results',
    'מה התשובות שלכם מספרות', 'What your answers tell', false),
  ('journeyAssessment.results.continueLabel', 'journey-assessment', 'results',
    'מכאן ממשיכים יחד', 'From here we continue together', false),
  ('journeyAssessment.results.continueP1', 'journey-assessment', 'results',
    'על כל אחד מהתחומים האלה נעבוד יחד, פרק חדש בכל שבוע, ואתם קובעים את הסדר.',
    'We''ll work on each of these areas together, a new chapter every week, and you set the order.', false),
  ('journeyAssessment.results.continueP2', 'journey-assessment', 'results',
    'את האבחון המלא, לתמונה מדויקת ולתוצאות עמוקות יותר, נשלים יחד מיד אחרי ההצטרפות לתוכנית הייעוץ הזוגי של מיאושי.',
    'We''ll complete the full assessment together, for a more accurate picture and deeper results, right after you join Mioshy''s couples coaching.', false),
  ('journeyAssessment.results.improvementsLabel', 'journey-assessment', 'results',
    'מה תקבלו בליווי', 'What you get in the program', false),
  ('journeyAssessment.results.improve1', 'journey-assessment', 'results',
    'האינטימיות תגדל', 'Intimacy will grow', false),
  ('journeyAssessment.results.improve2', 'journey-assessment', 'results',
    'הפרפרים יחזרו לבטן', 'The butterflies will return', false),
  ('journeyAssessment.results.improve3', 'journey-assessment', 'results',
    'הסקס יהיה עוצמתי מתמיד', 'Sex will be better than ever', false),
  ('journeyAssessment.results.improve4', 'journey-assessment', 'results',
    'החברות ביניכם תתחזק', 'Your friendship will strengthen', false),
  ('journeyAssessment.results.improve5', 'journey-assessment', 'results',
    'הריבים יפחתו והשקט יחזור', 'Arguments will ease and calm returns', false),
  ('journeyAssessment.results.improve6', 'journey-assessment', 'results',
    'האהבה תחזור', 'Love will return', false),
  ('journeyAssessment.results.priceTitle', 'journey-assessment', 'results',
    'איזו חבילה מתאימה לכם?', 'Which plan fits you?', false),
  ('journeyAssessment.results.included1', 'journey-assessment', 'results',
    'פרק חדש כל שבוע', 'A new chapter every week', false),
  ('journeyAssessment.results.included2', 'journey-assessment', 'results',
    'מומחה זוגיות פרטי בצ''אט', 'A private relationship expert in chat', false),
  ('journeyAssessment.results.included3', 'journey-assessment', 'results',
    'משחקי זוגות אונליין', 'Online couples games', false),
  ('journeyAssessment.results.included4', 'journey-assessment', 'results',
    'הסקס של מיאושי', 'Mioshy''s sex games', false),
  ('journeyAssessment.results.included5', 'journey-assessment', 'results',
    'ייעוץ זוגי עם מיאושי', 'Couples coaching with Mioshy', false),
  ('journeyAssessment.results.fullAssessmentNote', 'journey-assessment', 'results',
    'מיד עם ההצטרפות נשלים את האבחון המלא, לתמונה מדויקת יותר ולצעדים שמתאימים בדיוק אליכם.',
    'Right after you join, we''ll complete the full assessment, for a more accurate picture and steps tailored exactly to you.', false),
  ('journeyAssessment.results.stopNote', 'journey-assessment', 'results',
    'אפשר לעצור בכל עת בלחיצת כפתור.', 'Cancel anytime with one tap.', false),
  ('journeyAssessment.results.anchorLead', 'journey-assessment', 'results',
    'פגישת ייעוץ מתחילה ב-₪500 מינימום ויכולה להגיע לאלפי שקלים.',
    'A counselling session starts at ₪500 minimum and can reach thousands.', false),
  ('journeyAssessment.results.anchorBold', 'journey-assessment', 'results',
    'איתנו תקבלו ליווי צמוד, כל החודש.', 'With us you get close guidance, all month long.', false),
  ('journeyAssessment.results.cadenceMonthly', 'journey-assessment', 'results',
    'חודשי', 'Monthly', false),
  ('journeyAssessment.results.cadenceQuarterly', 'journey-assessment', 'results',
    'רבעוני', 'Quarterly', false),
  ('journeyAssessment.results.cadenceYearly', 'journey-assessment', 'results',
    'שנתי', 'Yearly', false),
  ('journeyAssessment.results.cadenceWeekly', 'journey-assessment', 'results',
    'שבועי', 'Weekly', false),
  ('journeyAssessment.results.promoTag', 'journey-assessment', 'results',
    'מבצע', 'Promo', false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
