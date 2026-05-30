-- 098_cms_texts_app_shell.sql
--
-- Backfill cms_texts for the 69 strings shipped with the post-login
-- AppShell (Studio v12 — 2026-05-29). After this runs, every nav
-- label / page title / empty-state / share-channel button is editable
-- live from /admin/content under the page tag 'app-shell'.
--
-- Without this migration the public site keeps rendering correctly
-- via the next-intl fallback to messages/{he,en}.json — but admins
-- can't edit copy without a deploy. Same pattern as migrations 085-094.
--
-- Section groupings inside the admin UI:
--   • rootCrumb / logout / askExpert / moreTab — shell chrome
--   • group   — sidebar group headings
--   • nav     — the 7 navigation items
--   • today   — /my/today page strings
--   • lessons — /my/lessons page strings
--   • expert  — /my/expert page strings
--   • share   — /my/share page strings
--   • settings — /my/settings page strings
--
-- ON CONFLICT (key) DO NOTHING — safe to re-run; existing admin edits
-- win. Same convention as 085-094.

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('appShell.rootCrumb', 'app-shell', 'rootCrumb', 'מיאושי שלי', 'My Mioshy', false),
  ('appShell.logout', 'app-shell', 'logout', 'התנתקות', 'Sign out', false),
  ('appShell.askExpert', 'app-shell', 'askExpert', 'שאלה למומחה', 'Ask your expert', false),
  ('appShell.moreTab', 'app-shell', 'moreTab', 'עוד', 'More', false),
  ('appShell.group.journey', 'app-shell', 'group', 'המסע שלי', 'My Journey', false),
  ('appShell.group.games', 'app-shell', 'group', 'משחקים', 'Games', false),
  ('appShell.group.account', 'app-shell', 'group', 'החשבון', 'Account', false),
  ('appShell.nav.today', 'app-shell', 'nav', 'היום', 'Today', false),
  ('appShell.nav.lessons', 'app-shell', 'nav', 'השיעורים שלי', 'My Lessons', false),
  ('appShell.nav.expert', 'app-shell', 'nav', 'צ׳אט עם מומחה', 'Chat with expert', false),
  ('appShell.nav.games', 'app-shell', 'nav', 'משחקי הזוגות', 'Couples Games', false),
  ('appShell.nav.adults', 'app-shell', 'nav', 'מיאושי למבוגרים', 'Mioshy Adults', false),
  ('appShell.nav.share', 'app-shell', 'nav', 'שיתוף עם בן/בת זוג', 'Share with partner', false),
  ('appShell.nav.settings', 'app-shell', 'nav', 'הגדרות', 'Settings', false),
  ('appShell.today.pageTitle', 'app-shell', 'today', 'היום', 'Today', false),
  ('appShell.today.focusPrefix', 'app-shell', 'today', 'המוקד הנוכחי', 'Current focus', false),
  ('appShell.today.currentLessonChip', 'app-shell', 'today', 'השיעור הנוכחי', 'Current lesson', false),
  ('appShell.today.openLessonCta', 'app-shell', 'today', 'פתחו את השיעור', 'Open the lesson', false),
  ('appShell.today.freshTag', 'app-shell', 'today', 'נפתח עכשיו', 'Just opened', false),
  ('appShell.today.minutesSuffix', 'app-shell', 'today', 'דקות', 'min', false),
  ('appShell.today.historyTitle', 'app-shell', 'today', 'ההיסטוריה שלכם', 'Your history', false),
  ('appShell.today.historyAllLink', 'app-shell', 'today', 'הכל', 'View all', false),
  ('appShell.today.emptyTitle', 'app-shell', 'today', 'אין שיעור פתוח כרגע', 'No lesson open right now', false),
  ('appShell.today.emptyBody', 'app-shell', 'today', 'המומחית מכינה את השיעור הבא — נחזור אליכם בקרוב.', 'Your expert is preparing the next one — we''ll be back soon.', false),
  ('appShell.lessons.pageTitle', 'app-shell', 'lessons', 'השיעורים שלי', 'My Lessons', false),
  ('appShell.lessons.assessmentsTitle', 'app-shell', 'lessons', 'האבחונים שלכם', 'Your assessments', false),
  ('appShell.lessons.assessmentsCount', 'app-shell', 'lessons', '{count} כרגע · עוד בהמשך', '{count} right now · more to come', false),
  ('appShell.lessons.assessmentOpen', 'app-shell', 'lessons', 'לפתוח', 'Open', false),
  ('appShell.lessons.activeTitle', 'app-shell', 'lessons', 'פעיל עכשיו', 'Active now', false),
  ('appShell.lessons.activeCountOne', 'app-shell', 'lessons', '1 פתוח', '1 open', false),
  ('appShell.lessons.activeChip', 'app-shell', 'lessons', 'המשך', 'Continue', false),
  ('appShell.lessons.continueCta', 'app-shell', 'lessons', 'המשיכו בשיעור', 'Continue the lesson', false),
  ('appShell.lessons.completedTitle', 'app-shell', 'lessons', 'הושלמו', 'Completed', false),
  ('appShell.lessons.totalLabel', 'app-shell', 'lessons', '{count} סה״כ', '{count} total', false),
  ('appShell.lessons.upcomingTitle', 'app-shell', 'lessons', 'בקרוב', 'Coming up', false),
  ('appShell.lessons.waitingSuffix', 'app-shell', 'lessons', 'ממתינים', 'waiting', false),
  ('appShell.expert.pageTitle', 'app-shell', 'expert', 'צ׳אט עם מומחה', 'Chat with expert', false),
  ('appShell.expert.statusLine', 'app-shell', 'expert', 'המומחית שלכם · online · מענה תוך 24 שעות', 'Your expert · online · replies within 24h', false),
  ('appShell.expert.composerPlaceholder', 'app-shell', 'expert', 'כתבו הודעה למומחה…', 'Write a message to the expert…', false),
  ('appShell.expert.emptyLabel', 'app-shell', 'expert', 'עוד לא שלחתם הודעה. כתבו את ההודעה הראשונה כאן — נחזור אליכם תוך 24 שעות.', 'No messages yet. Send the first one here — we''ll be back within 24 hours.', false),
  ('appShell.expert.todayLabel', 'app-shell', 'expert', 'היום', 'Today', false),
  ('appShell.expert.sendLabel', 'app-shell', 'expert', 'שליחה', 'Send', false),
  ('appShell.share.pageTitle', 'app-shell', 'share', 'שיתוף עם בן/בת זוג', 'Share with partner', false),
  ('appShell.share.title', 'app-shell', 'share', 'הזמינו את בן/בת הזוג למסע', 'Invite your partner to the journey', false),
  ('appShell.share.body', 'app-shell', 'share', 'הם יקבלו גישה מלאה לכל מה שיש לכם — שיעורים, צ׳אט עם המומחית, ובעתיד גם משחקים. בלי תוספת תשלום, רק בני זוג בלבד.', 'They''ll get full access to everything you have — lessons, the expert chat, and eventually games. No extra payment, partners only.', false),
  ('appShell.share.copyLabel', 'app-shell', 'share', 'העתקת קישור', 'Copy link', false),
  ('appShell.share.copiedLabel', 'app-shell', 'share', 'הועתק ✓', 'Copied ✓', false),
  ('appShell.share.whatsappLabel', 'app-shell', 'share', 'WhatsApp', 'WhatsApp', false),
  ('appShell.share.smsLabel', 'app-shell', 'share', 'SMS', 'SMS', false),
  ('appShell.share.emailLabel', 'app-shell', 'share', 'Email', 'Email', false),
  ('appShell.share.qrLabel', 'app-shell', 'share', 'QR', 'QR', false),
  ('appShell.share.qrCaption', 'app-shell', 'share', 'סרקו את הקוד מהטלפון של בן/בת הזוג כדי להצטרף.', 'Scan the code from your partner''s phone to join.', false),
  ('appShell.share.closeLabel', 'app-shell', 'share', 'סגירה', 'Close', false),
  ('appShell.share.emailSubjectLabel', 'app-shell', 'share', 'הזמנה למיאושי', 'Mioshy invite', false),
  ('appShell.share.pairedTitle', 'app-shell', 'share', 'אתם כבר זוג עם {name} 💛', 'You''re paired with {name} 💛', false),
  ('appShell.share.pairedBody', 'app-shell', 'share', 'הזיווג נסגר. שניכם תיהנו עכשיו מאותו מסע, מאותו צ׳אט עם המומחית ומכל המשחקים. אם תרצו לבטל זיווג — דרך הגדרות החשבון.', 'You''re both on the same journey now — same chat with the expert, same access to the games. To un-pair, head to account settings.', false),
  ('appShell.settings.pageTitle', 'app-shell', 'settings', 'הגדרות', 'Settings', false),
  ('appShell.settings.profileTitle', 'app-shell', 'settings', 'פרופיל', 'Profile', false),
  ('appShell.settings.personalDetailsTitle', 'app-shell', 'settings', 'פרטים אישיים', 'Personal details', false),
  ('appShell.settings.personalDetailsDefault', 'app-shell', 'settings', 'שם, אימייל, טלפון', 'Name, email, phone', false),
  ('appShell.settings.notificationsTitle', 'app-shell', 'settings', 'התראות', 'Notifications', false),
  ('appShell.settings.notificationsSub', 'app-shell', 'settings', 'אימייל / SMS / push', 'Email / SMS / push', false),
  ('appShell.settings.securityTitle', 'app-shell', 'settings', 'פרטיות וביטחון', 'Privacy & security', false),
  ('appShell.settings.securitySub', 'app-shell', 'settings', 'סיסמה, חיבורים פעילים', 'Password, active sessions', false),
  ('appShell.settings.subscriptionTitle', 'app-shell', 'settings', 'מנוי וחיוב', 'Subscription & billing', false),
  ('appShell.settings.subscriptionRowTitle', 'app-shell', 'settings', 'המנוי שלכם', 'Your subscription', false),
  ('appShell.settings.subscriptionEmpty', 'app-shell', 'settings', 'אין מנוי פעיל כרגע', 'No active subscription', false),
  ('appShell.settings.invoicesTitle', 'app-shell', 'settings', 'היסטוריית חיובים', 'Billing history', false),
  ('appShell.settings.invoicesSub', 'app-shell', 'settings', 'חשבוניות וקבלות', 'Invoices and receipts', false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
