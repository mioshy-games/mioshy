-- 027_seed_message_templates.sql
--
-- Seeds the 15 base templates referenced by lib/journey/engagement.ts
-- (BASE_PLAN) so buildSchedulePlan() always finds a matching template_id.
-- Copy is intentionally short + tonal (warm, second-person, present-tense
-- micro-actions). All bilingual. Admins can tune the text in the editor.
--
-- Idempotent: ON CONFLICT (key) DO NOTHING. Safe to re-run.

INSERT INTO message_templates (key, channel, subject_he, subject_en, body_he, body_en, trigger_axis, variables, is_active)
VALUES

-- ───────────────────────── Onboarding ─────────────────────────
(
  'w00_welcome_personalized',
  'email',
  'ברוכים הבאים למיאושי, {{first_name}}',
  'Welcome to Mioshy, {{first_name}}',
  'שלום {{first_name}},

השלמתם את המסע הראשוני. ציון החברות שלכם: {{friendship_score}}/100. שפת האהבה המרכזית שלכם: {{primary_love_language}}.

בשבועות הקרובים נשלח לכם תרגול אחד קצר בכל שבוע - פעולה קטנה אחת שמחקרים מראים שמחזקת את הזוגיות.

מתחילים מחר.
מיאושי',
  'Hi {{first_name}},

You finished the first journey. Your friendship score: {{friendship_score}}/100. Your primary love language: {{primary_love_language}}.

Over the coming weeks we''ll send one short practice a week - a tiny action that research shows strengthens couples.

We''re starting tomorrow.
Mioshy',
  NULL,
  '["first_name","friendship_score","primary_love_language"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 1 - Love Map ─────────────────────────
(
  'w01_love_map_deep_dive',
  'email',
  'שאלה אחת שתחזק את ההכרות שלכם',
  'One question that deepens the way you know each other',
  'היי {{first_name}},

השבוע, שאלו אחד את השנייה: "מה היה הרגע הכי טוב השבוע, ומה הרגע הכי קשה?"

אל תציעו פתרונות. רק הקשיבו. שמרו את המידע - זה "מפת האהבה" שלכם.

5 דקות לפני השינה. זה הכל.',
  'Hi {{first_name}},

This week, ask each other: "What was your best moment of the week, and what was your hardest?"

Don''t offer solutions. Just listen. Hold onto what you hear - this is your "love map".

5 minutes before bed. That''s it.',
  'love_map',
  '["first_name"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 2 - Fondness ─────────────────────────
(
  'w02_seven_day_appreciation',
  'email',
  '7 ימים, הערכה אחת ביום',
  '7 days, one appreciation a day',
  'שבוע של הערכה:

בכל יום שלחו לבן/בת הזוג שלכם הודעה אחת קצרה - משהו ספציפי שאתם מעריכים.

לא "אתה מדהים". כן "אהבתי איך שחיממת לי את הקפה הבוקר, חסכת לי חצי שעה".

פרטים. הם מה שנשאר.',
  'A week of appreciation:

Each day, send your partner one short message - something specific you appreciate.

Not "you''re amazing." Instead: "I loved that you heated my coffee this morning - it saved me half an hour."

Specifics. They''re what sticks.',
  'fondness',
  '["first_name"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 3 - Turn Toward ─────────────────────────
(
  'w03_missed_bids',
  'email',
  'הבקשות הקטנות שפספסתם',
  'The small bids you''ve been missing',
  'גוטמן מכנה אותן "bids" - רגעים קטנים שבהם בן/בת הזוג שלך מבקש/ת תשומת לב: "תראי את הציפור הזאת", "אני עייף היום".

השבוע, שימו לב. תענו גם כשאתם באמצע משהו. 3 שניות של מגע בעין, או משפט של "אני שומע/ת אותך".

זה מה שבונה אמון.',
  'Gottman calls them "bids" - small moments where your partner asks for attention: "look at that bird", "I''m tired today."

This week, notice them. Respond even when you''re in the middle of something. Three seconds of eye contact, or an "I hear you."

This is what builds trust.',
  'turn_toward',
  '["first_name"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 4 - Love Language ─────────────────────────
(
  'w04_love_language_action',
  'email',
  'השבוע: {{primary_love_language}}',
  'This week: {{primary_love_language}}',
  'שפת האהבה המרכזית שלכם היא {{primary_love_language}}. הגוף הזה פועל כשמדברים את השפה הנכונה, לא הכי הרבה.

השבוע, בחרו פעולה אחת מהשפה הזאת ועשו אותה פעמיים - בלי להזכיר אותה.

לדוגמה: אם זה "זמן איכות", 20 דקות בלי טלפון. אם זה "מגע", 30 שניות חיבוק בבוקר.

פעולה. בלי להסביר.',
  'Your primary love language is {{primary_love_language}}. The body responds when someone speaks the right language - not the loudest one.

This week, pick one action from that language and do it twice - without mentioning it.

For example: if it''s "quality time", 20 phone-free minutes. If it''s "touch", a 30-second morning hug.

Action. No explanation.',
  NULL,
  '["first_name","primary_love_language"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 5 - Repair (conditional) ─────────────────────────
(
  'w05_conflict_repair_phrases',
  'email',
  'המשפטים שמצילים ויכוחים',
  'The phrases that rescue fights',
  'ראינו במסע שלכם סימנים שוויכוחים הופכים להרסניים. זה עניין של כישור, לא של אופי.

שננו משפט אחד מהרשימה הזאת והשתמשו בו השבוע:
• "רגע, בואי ננסה מחדש."
• "צדקת, אני מתנצל/ת."
• "אני צריך/ה הפסקה קצרה, נחזור לזה בעוד 20 דקות."

משפט אחד. בזמן הנכון. מספיק.',
  'We saw signs in your journey that arguments escalate into damage. This is a skill, not a personality issue.

Memorize one phrase from this list and use it this week:
• "Wait, let''s try that again."
• "You''re right, I''m sorry."
• "I need a short break - let''s come back to this in 20 minutes."

One phrase. At the right moment. That''s enough.',
  'defensiveness',
  '["first_name"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 6 - Passion: Autonomy ─────────────────────────
(
  'w06_passion_autonomy',
  'email',
  'המרחק שמגדיל משיכה',
  'The distance that grows attraction',
  'אסתר פרל כותבת: "אי אפשר להתגעגע אל מישהו שתמיד נמצא."

השבוע, קחו שעה אחת לעצמכם בלי להודיע למה. קריאה, הליכה, שתיקה. זה לא דחייה - זה אחד הדברים שבונים משיכה לאורך זמן.',
  'Esther Perel writes: "You can''t miss someone who''s always there."

This week, take one hour for yourself without explaining why. Reading, walking, silence. This isn''t rejection - it''s one of the things that builds long-term attraction.',
  'autonomy',
  '["first_name"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 7 - Passion: Anticipation ─────────────────────────
(
  'w07_passion_anticipation',
  'email',
  'לבנות ציפייה',
  'Building anticipation',
  'משיכה גדלה בזמן שבין ההודעה לבין המפגש.

השבוע: קבעו פגישה ל-72 שעות קדימה. שלחו הודעה אחת ביום שמזכירה אותה - בלי להסגיר מה יהיה. "חמישי ב-20:00. תלבשי את הפריט האדום".

הציפייה היא מחצית מהחוויה.',
  'Desire grows in the gap between the message and the meeting.

This week: schedule something for 72 hours from now. Send one message a day that hints at it - without giving it away. "Thursday 8pm. Wear the red one."

Anticipation is half the experience.',
  'anticipation',
  '["first_name"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 8 - Play ─────────────────────────
(
  'w08_playful_rituals',
  'email',
  'הטקסים הקטנים של זוגיות שורדת',
  'The tiny rituals long couples keep',
  'זוגות ששורדים 20 שנה לא עושים פחות ריבים - יש להם יותר טקסים קטנים.

בחרו אחד:
• בדיחה פנימית חדשה השבוע
• מוזיקה ספציפית ביום חמישי בערב
• מילה מקודדת ל"אני שמח/ה שאני איתך"

מה שמשותף רק לכם. זה מה שמחבר.',
  'Couples who last 20 years don''t fight less - they have more small rituals.

Pick one:
• A new inside joke this week
• Specific music on Thursday nights
• A code word for "I''m glad I''m with you"

Something only the two of you share. That''s what holds.',
  'play',
  '["first_name"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 9 - Shared Meaning ─────────────────────────
(
  'w09_shared_meaning_goals',
  'email',
  'מה אנחנו בונים ביחד',
  'What are we building together',
  'גוטמן מכנה את זה "משמעות משותפת" - שיחה על מה שמעבר ליום-יום.

השבוע, שאלו: "איך נרצה לזכור את השנה הזאת בעוד 10 שנים?"

אין תשובה נכונה. אין לוח זמנים. רק שיחה אחת של 15 דקות.',
  'Gottman calls it "shared meaning" - conversations about what goes beyond daily logistics.

This week, ask: "How will we want to remember this year ten years from now?"

No right answer. No timeline. Just one 15-minute conversation.',
  'shared_meaning',
  '["first_name"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 10 - Mid-program check-in ─────────────────────────
(
  'w10_mid_program_checkin',
  'email',
  'אנחנו באמצע - איך הולך?',
  'We''re halfway in - how''s it going?',
  'היי {{first_name}},

עברנו 10 שבועות. רוב הזוגות באמת מרגישים שינוי בערך עכשיו.

קחו 5 דקות לבד ורישמו:
1. מה השתנה לטובה בזוגיות שלכם?
2. מה עדיין קשה?
3. מה תרצו שנתמקד בו בחצי השני?

הצוות של מיאושי כאן אם תרצו לדבר.',
  'Hi {{first_name}},

We''re 10 weeks in. Most couples actually feel the shift around now.

Take 5 minutes alone and write down:
1. What has improved?
2. What''s still hard?
3. What do you want to focus on in the second half?

The Mioshy team is here if you want to talk.',
  NULL,
  '["first_name"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 12 - Partner invite ─────────────────────────
(
  'w12_partner_invite',
  'email',
  'להזמין את בן/בת הזוג?',
  'Want to invite your partner?',
  'זוגיות מתקנים יחד. אחרי 12 שבועות של תרגול לבד, הרבה מהזוגות שלנו מזמינים את בן/בת הזוג להצטרף.

הם עונים על שאלון משלהם, ואתם מקבלים דו"ח משותף שמראה איפה יש פער בין איך אתם חווים את הזוגיות לבין איך הוא/היא חווה/ת.

אין דו"ח אחד שמגלה יותר.',
  'Relationships improve together. After 12 weeks of practicing alone, many of our users invite their partner to join.

They answer their own questionnaire, and you get a joint report showing where there''s a gap between how you experience the relationship and how they do.

No other report reveals more.',
  NULL,
  '["first_name"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 16 - Habit consolidation ─────────────────────────
(
  'w16_habit_consolidation',
  'email',
  'איזו פעולה הפכה להרגל?',
  'Which action has become a habit?',
  'עברו 16 שבועות. פעולה שחוזרת 16 פעמים הופכת להתנהגות. שלוש פעמים - לזהות.

השבוע: בחרו את הפעולה האחת שתרצו שתישאר איתכם לתמיד. הפכו אותה לטקס קבוע (זמן, מקום, טריגר).

כל השאר ישחק תפקיד פחות חשוב.',
  'It''s been 16 weeks. An action repeated 16 times becomes a behavior. Three times - an identity.

This week: pick the one action you want to keep forever. Make it a fixed ritual (time, place, trigger).

Everything else plays a smaller role.',
  NULL,
  '["first_name"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 20 - Reassess ─────────────────────────
(
  'w20_second_half_reassess',
  'email',
  'איפה אנחנו היום לעומת איפה התחלנו',
  'Where you are today vs where you started',
  'לפני 20 שבועות ציון החברות שלכם היה {{friendship_score}}.

רוב הזוגות שמגיעים עד לפה מגלים שהציון עלה ב-12 עד 20 נקודות - אבל רק אם ענו מחדש. קחו 10 דקות, ענו על השאלון מחדש, וקבלו דו"ח השוואה.

זה הרגע שמראה לכם שזה אמיתי.',
  'Twenty weeks ago your friendship score was {{friendship_score}}.

Most couples who make it here find their score has moved up 12–20 points - but only if they reassess. Take 10 minutes, retake the questionnaire, and get a comparison report.

This is the moment that shows you it''s real.',
  NULL,
  '["first_name","friendship_score"]'::jsonb,
  TRUE
),

-- ───────────────────────── Week 26 - Graduation ─────────────────────────
(
  'w26_program_graduation',
  'email',
  'סיימתם את התוכנית',
  'You completed the program',
  'היי {{first_name}},

26 שבועות. זה לא עניין של מזל.

קיבלתם את ההרגלים. עכשיו הזוגיות שלכם היא מערכת שמתחזקת את עצמה. המשיכו לתרגל את האחד/ה שהיה הכי חשוב/ה לכם - פעם בשבוע, בערב קבוע.

אנחנו כאן כשתרצו להמשיך לעומק.',
  'Hi {{first_name}},

26 weeks. That''s not luck.

You''ve got the habits. Your relationship is now a system that maintains itself. Keep practicing the one that mattered most to you - once a week, on a fixed evening.

We''re here when you want to go deeper.',
  NULL,
  '["first_name"]'::jsonb,
  TRUE
)

ON CONFLICT (key) DO NOTHING;
