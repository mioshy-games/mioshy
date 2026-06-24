-- ───────────────────────────────────────────────────────────────────────────
-- 143_cms_marathon_days_seed.sql
--
-- Seeds the 7-day marathon copy as CMS rows (page='marathon', section='days')
-- so Itzik edits domain + activity per day from /admin/content WITHOUT a deploy.
-- Two keys per day:
--   marathon.dayN.domain   → WhatsApp template variable {{2}} (the day's theme)
--   marathon.dayN.activity → WhatsApp template variable {{3}} (the 5-min task)
-- The fixed template scaffolding ("יום {{1}} מתוך 7 · {{2}} … {{3}} …") lives in
-- the Meta-approved template, so editing these variables needs NO re-approval.
--
-- Values are PROVISIONAL placeholders (brand voice) — Itzik finalises the copy.
-- ON CONFLICT DO NOTHING: never overwrite admin edits when the migration re-runs.
-- Domain arc per the handoff: חברות · תקשורת · אהבה · אינטימיות · משפחתיות · מיניות · סיכום.
-- ───────────────────────────────────────────────────────────────────────────

insert into public.cms_texts (key, page, section, he_text, en_text, is_rich) values
  ('marathon.day1.domain',   'marathon', 'days', 'חברות',      'Friendship',   false),
  ('marathon.day1.activity', 'marathon', 'days',
   'ספרו זה לזה על רגע אחד מהשבוע שבו הרגשתם גאווה אחד בשני, קטן או גדול.',
   '[placeholder] Day 1 activity', false),

  ('marathon.day2.domain',   'marathon', 'days', 'תקשורת',     'Communication', false),
  ('marathon.day2.activity', 'marathon', 'days',
   '[נוסח זמני] שאלו זה את זה שאלה אחת שתמיד רציתם לשאול, והקשיבו בלי לקטוע.',
   '[placeholder] Day 2 activity', false),

  ('marathon.day3.domain',   'marathon', 'days', 'אהבה',       'Love',          false),
  ('marathon.day3.activity', 'marathon', 'days',
   '[נוסח זמני] אמרו זה לזה דבר אחד שאתם אוהבים, שעוד לא אמרתם בקול.',
   '[placeholder] Day 3 activity', false),

  ('marathon.day4.domain',   'marathon', 'days', 'אינטימיות',  'Intimacy',      false),
  ('marathon.day4.activity', 'marathon', 'days',
   '[נוסח זמני] שבו קרוב, בלי מסכים, וחלקו דבר אחד שמרגיש לכם קרוב היום.',
   '[placeholder] Day 4 activity', false),

  ('marathon.day5.domain',   'marathon', 'days', 'משפחתיות',   'Family',        false),
  ('marathon.day5.activity', 'marathon', 'days',
   '[נוסח זמני] דמיינו יחד רגע משפחתי אחד שתרצו ליצור בשנה הקרובה.',
   '[placeholder] Day 5 activity', false),

  ('marathon.day6.domain',   'marathon', 'days', 'מיניות',     'Sexuality',     false),
  ('marathon.day6.activity', 'marathon', 'days',
   '[נוסח זמני] שתפו דבר אחד שמושך אתכם בבן/בת הזוג, בעדינות ובכנות.',
   '[placeholder] Day 6 activity', false),

  ('marathon.day7.domain',   'marathon', 'days', 'סיכום',      'Celebration',   false),
  ('marathon.day7.activity', 'marathon', 'days',
   '[נוסח זמני] הסתכלו אחורה על השבוע ובחרו יחד רגע אחד שתרצו לשמר.',
   '[placeholder] Day 7 activity', false)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
