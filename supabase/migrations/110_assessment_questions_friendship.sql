-- 110_assessment_questions_friendship.sql
-- =============================================================================
-- Seed assessment 2 — friendship (חברות וקרבה רגשית), 21 questions.
-- Idempotent (ON CONFLICT DO NOTHING). Mirrors the intimacy seed (migration 109).
-- =============================================================================

INSERT INTO public.assessment_questions
  (assessment_id, slug, position, dimension_key, type, reverse, is_open, text_he, text_en, source_slugs)
VALUES
  ('friendship','q01',1,'daily_us_moments','likert5',false,false,'יש לנו רגעי חיבור קטנים ביום-יום, בלי תכנון מראש','We have small moments of connection in daily life, without planning','fri-tool-sliding;csv-s1-friendship-033'),
  ('friendship','q02',2,'daily_us_moments','likert5',false,false,'אנחנו צוחקים יחד','We laugh together','csv-s1-friendship-036;csv-s3-friendship-175'),
  ('friendship','q03',3,'daily_us_moments','likert5',false,false,'כשאני נכנס/ת הביתה, מחכה לי רגע של מבט, חיבוק או שאלה אישית - לא רק לוגיסטיקה','When I come home, a look, a hug or a personal question is waiting for me - not just logistics','fri-tool-sliding;friend-02-show-curiosity'),
  ('friendship','q04',4,'daily_us_moments','likert5',false,false,'ערב רגיל עם בן/בת הזוג מרגיש לי כיף','An ordinary evening with my partner feels fun to me','fri-tool-magic5;csv-s1-friendship-039'),
  ('friendship','q05',5,'appreciative_gaze','likert5',false,false,'כשבן/בת הזוג עושה משהו טוב, אני שם/ה לב ואומר/ת לו/ה','When my partner does something good, I notice and tell them','csv-s1-emotional_connection-024;fri-tool-cherish'),
  ('friendship','q06',6,'appreciative_gaze','likert5',false,false,'אני מודע/ת לתכונות שאני מעריך/ה בבן/בת הזוג','I''m aware of the traits I appreciate in my partner','csv-s3-emotional_connection-162;fri-tool-bank'),
  ('friendship','q07',7,'appreciative_gaze','likert5',false,false,'בן/בת הזוג מוקיר/ה אותי על דברים ספציפיים - לא רק ''תודה'' כללי','My partner cherishes me for specific things - not just a general thanks','csv-s2-friendship-108;csv-s1-emotional_connection-024'),
  ('friendship','q08',8,'appreciative_gaze','likert5',false,false,'כשאני חושב/ת על בן/בת הזוג, עולה בי משהו חיובי','When I think about my partner, something positive comes up in me','fri-tool-cherish;love-03-falling-back-in-love'),
  ('friendship','q09',9,'mutual_vulnerability','likert5',false,false,'אני מרגיש/ה נוח לחלוק עם בן/בת הזוג פחדים או חולשות','I feel comfortable sharing fears or weaknesses with my partner','csv-s1-emotional_connection-022;csv-s3-emotional_connection-168'),
  ('friendship','q10',10,'mutual_vulnerability','likert5',false,false,'אני מרגיש/ה שבן/בת הזוג נוח/ה לשתף אותי בדברים פנימיים, לא רק תפעוליים','I feel my partner is comfortable sharing inner things with me, not just logistics','csv-s1-emotional_connection-030;emo-tool-rawspot'),
  ('friendship','q11',11,'mutual_vulnerability','likert5',false,false,'אחרי שיחה אינטימית אני מרגיש/ה קרוב/ה יותר לבן/בת הזוג','After an intimate conversation I feel closer to my partner','emo-tool-htc;csv-s3-emotional_connection-161'),
  ('friendship','q12',12,'mutual_vulnerability','likert5',false,false,'אנחנו מצליחים להתגבר מהר על ויכוח ולחזור לשגרה בלי טעם רע','We manage to recover quickly from an argument and return to routine without a bad aftertaste','emo-tool-forgive;csv-s2-emotional_connection-085'),
  ('friendship','q13',13,'knowing_partner_today','likert5',false,false,'בן/בת הזוג שלי מרגיש/ה בנוח לשתף אותי בדברים מהותיים בחייו/ה','My partner feels comfortable sharing meaningful things in their life with me','friend-02-show-curiosity;csv-s1-emotional_connection-030'),
  ('friendship','q14',14,'knowing_partner_today','likert5',false,false,'אנחנו אוהבים לבלות את הזמן הפנוי שלנו יחד','We love spending our free time together','csv-s1-friendship-039;fri-tool-magic5'),
  ('friendship','q15',15,'knowing_partner_today','likert5',false,false,'אני מכיר/ה את החברים הקרובים של בן/בת הזוג עכשיו','I know my partner''s close friends right now','friend-02-show-curiosity;csv-s2-friendship-099'),
  ('friendship','q16',16,'knowing_partner_today','likert5',false,false,'אני שם/ה לב לשינויים שבן/בת הזוג עבר/ה בשנה האחרונה','I notice the changes my partner has been through in the past year','csv-s4-friendship-233;fri-tool-detective'),
  ('friendship','q17',17,'couple_rituals','likert5',false,false,'יש לנו טקסים יומיים שרק שלנו (קפה בבוקר, שיחה לפני שינה וכד'')','We have daily rituals that are just ours (morning coffee, a talk before bed, etc.)','csv-s1-friendship-033;fri-tool-connection-hour'),
  ('friendship','q18',18,'couple_rituals','likert5',false,false,'יש לנו דייט שבועי קבוע - או משהו דומה','We have a regular weekly date - or something similar','csv-s3-friendship-184;fri-tool-magic5'),
  ('friendship','q19',19,'couple_rituals','likert5',false,false,'אנחנו חוגגים יחד גם הצלחות קטנות','We celebrate even small successes together','csv-s3-emotional_connection-160;csv-s3-friendship-179'),
  ('friendship','q20',20,'couple_rituals','likert5',false,false,'יש לנו ''דברים שלנו'' - בדיחות פנימיות, מקומות, שירים שרק אנחנו מבינים','We have ''our things'' - inside jokes, places, songs only we get','csv-s4-friendship-237;csv-s4-friendship-238'),
  ('friendship','q21_open',21,NULL,'reflection',false,true,'מתי הייתה הפעם האחרונה שהרגשת קרוב/ה לבן/בת הזוג שלך באמת? מה קרה ברגע ההוא?','When was the last time you truly felt close to your partner? What happened in that moment?','csv-s3-emotional_connection-161;csv-s4-emotional_connection-227')
ON CONFLICT (assessment_id, slug) DO NOTHING;
