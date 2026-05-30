-- 100_cms_texts_shell_upsell_notifications.sql
--
-- Backfill cms_texts for the 13 strings added after migration 098
-- shipped:
--
--   • appShell.today.upsell*   — "no journey" upsell card on /my/today
--                                + /my/lessons (Step B7).
--   • appShell.notifications.* — the new /my/notifications inbox page
--                                that the bell icon now points at
--                                (Step B6).
--
-- Same convention as 098: page='app-shell', sections grouped by the
-- second segment of the key. ON CONFLICT (key) DO NOTHING so this is
-- safe to re-run alongside 098 — existing admin edits win.

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  -- ── B7: no-journey upsell (rendered on /my/today + /my/lessons) ──
  ('appShell.today.upsellChip',    'app-shell', 'today',
    'מסע הזוגיות', 'Relationship Journey', false),
  ('appShell.today.upsellTitle',   'app-shell', 'today',
    'התחילו את מסע הזוגיות שלכם',
    'Start your relationship journey', false),
  ('appShell.today.upsellBody',    'app-shell', 'today',
    'אבחון מקיף, שיעורים מותאמים אישית, וצ׳אט פתוח עם מומחה זוגיות — הכל במנוי שבועי אחד. אפשר לעצור בכל רגע.',
    'A full assessment, personalized lessons, and an open chat with a relationship expert — all in one weekly subscription. Stop anytime.', false),
  ('appShell.today.upsellBullet1', 'app-shell', 'today',
    'אבחון של 10 דקות שמראה איפה החיבור שלכם חזק ואיפה כדאי לעבוד',
    'A 10-minute assessment that maps where your connection is strong — and where to work', false),
  ('appShell.today.upsellBullet2', 'app-shell', 'today',
    'שיעור חדש בכל יום-יומיים, מותאם למוקד שבחרתם',
    'A new lesson every day or two, tuned to the focus you pick', false),
  ('appShell.today.upsellBullet3', 'app-shell', 'today',
    'מומחה זוגיות פרטי, זמין בצ׳אט 7 ימים בשבוע',
    'Your own relationship expert, available 7 days a week', false),
  ('appShell.today.upsellCta',     'app-shell', 'today',
    'להתחיל אבחון חינם', 'Start the free assessment', false),

  -- ── B6: notifications page (/my/notifications) ──────────────────
  ('appShell.notifications.pageTitle',        'app-shell', 'notifications',
    'התראות', 'Notifications', false),
  ('appShell.notifications.markAllLabel',     'app-shell', 'notifications',
    'סמן הכל כנקרא', 'Mark all read', false),
  ('appShell.notifications.markingLabel',     'app-shell', 'notifications',
    'מסמן…', 'Marking…', false),
  ('appShell.notifications.emptyTitle',       'app-shell', 'notifications',
    'אין התראות חדשות', 'No new notifications', false),
  ('appShell.notifications.emptyBody',        'app-shell', 'notifications',
    'כל הודעה ממומחה, כל פתיחת שיעור, כל ציון דרך — הכל ירוכז כאן כשיהיה.',
    'Every expert reply, lesson unlock, and milestone will land here.', false),
  ('appShell.notifications.nothingLeftLabel', 'app-shell', 'notifications',
    'הכל נקרא', 'All read', false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
