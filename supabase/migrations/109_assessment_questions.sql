-- 109_assessment_questions.sql
-- =============================================================================
-- Editable question bank for the Assessments product line.
--
-- Questions move OUT of the static TS bank and INTO the DB so the admin can
-- edit / add / delete and import/export them as CSV (Itzik 2026-06-07). The
-- static bank (lib/assessments/banks/*.ts) remains the seed-of-record and a
-- runtime fallback if this table is empty for an assessment.
--
-- Dimensions stay structural in code (lib/assessments/catalog); a question
-- references its dimension by `dimension_key`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  text NOT NULL,
  slug           text NOT NULL,                 -- stable per-assessment id (q01..q21_open)
  position       int  NOT NULL DEFAULT 0,       -- display order
  dimension_key  text,                          -- null for the open question
  type           text NOT NULL DEFAULT 'likert5'
                   CHECK (type IN ('likert5','reflection')),
  reverse        boolean NOT NULL DEFAULT false, -- reverse-scored [הפוך] item
  is_open        boolean NOT NULL DEFAULT false, -- the open Q21 (not scored)
  text_he        text NOT NULL DEFAULT '',
  text_en        text NOT NULL DEFAULT '',
  source_slugs   text NOT NULL DEFAULT '',       -- grounding content items (semicolon list)
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, slug)
);

CREATE INDEX IF NOT EXISTS assessment_questions_order_idx
  ON public.assessment_questions (assessment_id, position);

ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

-- Questions are shown to every visitor, so public read is fine. All writes go
-- through the admin via the service-role client (server actions), which
-- bypasses RLS.
DROP POLICY IF EXISTS assessment_questions_read ON public.assessment_questions;
CREATE POLICY assessment_questions_read
  ON public.assessment_questions FOR SELECT USING (true);

-- ── Seed: assessment 1 — intimacy (21 questions) ─────────────────────────────
INSERT INTO public.assessment_questions
  (assessment_id, slug, position, dimension_key, type, reverse, is_open, text_he, text_en, source_slugs)
VALUES
  ('intimacy','q01',1,'frequency_availability','likert5',false,false,'תדירות הסקס שלנו מספקת אותי','The frequency of our sex satisfies me','csv-s2-intimacy-069;int-tool-schedule'),
  ('intimacy','q02',2,'frequency_availability','likert5',false,false,'כשבן/בת הזוג שלי יוזם/ת סקס, אני נענה/ית ברצון','When my partner initiates sex, I respond willingly','csv-s1-intimacy-018'),
  ('intimacy','q03',3,'frequency_availability','likert5',false,false,'בדרך כלל אני זה/זאת שיוזם/ת סקס','I''m usually the one who initiates sex','csv-s1-intimacy-013;int-tool-turnon'),
  ('intimacy','q04',4,'frequency_availability','likert5',false,false,'אני מצליח/ה לפנות מקום לסקס גם בחיים העמוסים שלנו','I manage to make room for sex even in our busy life','csv-s4-intimacy-217;csv-s4-intimacy-213'),
  ('intimacy','q05',5,'physical_satisfaction','likert5',false,false,'אני מסופק/ת גופנית מהסקס שלנו','I''m physically satisfied with our sex','int-tool-stress;csv-s3-intimacy-145'),
  ('intimacy','q06',6,'physical_satisfaction','likert5',false,false,'אני יודע/ת מה מסב לי הנאה גופנית, וקשוב/ה לאותות הגוף בסקס','I know what gives me physical pleasure, and I''m attuned to my body''s signals during sex','csv-s3-intimacy-146;csv-s1-intimacy-011'),
  ('intimacy','q07',7,'physical_satisfaction','likert5',false,false,'אני מרגיש/ה שהסקס שלנו מתנהל בקצב שמתאים לי','I feel our sex moves at a pace that suits me','csv-s3-intimacy-145;csv-s3-intimacy-146'),
  ('intimacy','q08',8,'physical_satisfaction','likert5',false,false,'אני מרגיש/ה נינוח/ה גופנית בסקס שלנו','I feel physically at ease during our sex','csv-s3-intimacy-153;int-tool-stress'),
  ('intimacy','q09',9,'sexual_communication','likert5',false,false,'אני מצליח/ה לדבר על הסקס שלנו בלי בושה ובלי שזה הופך לריב','I can talk about our sex without shame and without it turning into a fight','csv-s1-intimacy-015;csv-s3-intimacy-151'),
  ('intimacy','q10',10,'sexual_communication','likert5',false,false,'אני יכול/ה לבקש בנוחות מבן/בת הזוג שלי משהו חדש במיטה, ולהרגיש בנוח עם זה','I can comfortably ask my partner for something new in bed, and feel at ease with it','int-tool-menu;csv-s2-intimacy-072'),
  ('intimacy','q11',11,'sexual_communication','likert5',false,false,'אני מחזר/ת אחרי בן/בת הזוג שלי גם מחוץ למיטה','I court my partner outside the bedroom too','csv-s1-intimacy-013;int-tool-bridges'),
  ('intimacy','q12',12,'sexual_communication','likert5',false,false,'אני יודע/ת בוודאות מה בן/בת הזוג שלי אוהב/ת','I know for sure what my partner likes','int-tool-inventory;csv-s1-intimacy-011'),
  ('intimacy','q13',13,'mystery_desire','likert5',false,false,'אני מרגיש/ה משיכה לבן/בת הזוג שלי','I feel attracted to my partner','csv-s2-intimacy-077;csv-s1-intimacy-019'),
  ('intimacy','q14',14,'mystery_desire','likert5',false,false,'הסקס שלנו מרגיש כחוויה חדשה, לא חזרה','Our sex feels like a new experience, not a repeat','csv-s3-intimacy-155;csv-s4-intimacy-214'),
  ('intimacy','q15',15,'mystery_desire','likert5',false,false,'אני מגלה צדדים מפתיעים בבן/בת הזוג שלי','I discover surprising sides of my partner','int-tool-third;csv-s4-intimacy-214'),
  ('intimacy','q16',16,'mystery_desire','likert5',false,false,'בן/בת הזוג שלי רואה אותי כאדם נחשק/ת - לא רק כהורה או שותף/ה','My partner sees me as desirable - not just as a parent or a partner','int-tool-identity;int-tool-cet'),
  ('intimacy','q17',17,'emotional_intimacy','likert5',false,false,'אני חש/ה שהסקס שלנו אינטימי ולא רק טכני','I sense our sex is intimate, not just technical','csv-s4-intimacy-220;csv-s1-intimacy-017'),
  ('intimacy','q18',18,'emotional_intimacy','likert5',false,false,'אחרי סקס אני מרגיש/ה קרוב/ה רגשית לבן/בת הזוג','After sex I feel emotionally close to my partner','intim-05-after-care;csv-s1-intimacy-017'),
  ('intimacy','q19',19,'emotional_intimacy','likert5',false,false,'אני מרשה לעצמי להיות פגיע/ה בסקס','I allow myself to be vulnerable during sex','csv-s2-intimacy-067;csv-s2-intimacy-074'),
  ('intimacy','q20',20,'emotional_intimacy','likert5',false,false,'הסקס מרגיש לי כחלק טבעי מהזוגיות, לא משימה','Sex feels to me like a natural part of the relationship, not a chore','csv-s2-intimacy-071;csv-s4-intimacy-213'),
  ('intimacy','q21_open',21,NULL,'reflection',false,true,'מה הדבר שהכי היית רוצה שיהיה שונה בחיי המין שלכם - ולא דיברתם עליו עד עכשיו?','What''s the one thing you''d most want to be different in your sex life - that you haven''t talked about yet?','csv-s2-intimacy-072;csv-s1-intimacy-015')
ON CONFLICT (assessment_id, slug) DO NOTHING;
