# FOLLOWUPS

דברים שעלו תוך כדי שלב 1 ו**לא** נכנסו לקוד, כדי לא לחרוג מההיקף.
כל שורה כאן היא החלטה מודעת, לא שכחה.

---

## נובע ישירות משלב 1

### F1 — השוואת סכום בקולבק של Cardcom (המשך C3)
`pullLowProfileIndicator` (`lib/cardcom.ts:87-105`) מחזירה
`{ paid, operationResponse, dealNumber, parsed, raw }` — **אין בה שדה סכום**,
ו-`grep` על כל הריפו לא מצא שום מקום שמחלץ סכום מתשובת Cardcom.
לפי הוראת העבודה ("אם אין בה שדה סכום, אל תמציא אחד") בוצע רק תיקון הקישור.

כדי להשלים צריך: לקרוא תשובת indicator אמיתית מהסנדבוקס, לזהות את שם השדה
בפועל (מועמדים: `Sum`, `DealSum`, `ExtShvaParams.Sum36`), לחשוף אותו כ-`amount`
מ-`pullLowProfileIndicator`, ואז להוסיף את בדיקת `Math.abs(paid - expected) > 0.01`
בשני המסלולים. **זה נוגע במסלול תשלום — לתאם לפני.**

### F2 — `security_invoker` על `admin_users_overview` (המשך C2)
לא הוגדר, בהחלטה. ה-view קורא `auth.users`; עם invoker הקורא (service_role)
צריך הרשאת SELECT על `auth.users`, ואי אפשר היה לאמת בלי פרודקשן, בעוד
כישלון היה שובר ~25 קריאות כולל מיילים של journey.
אחרי ה-`REVOKE` ה-view נגיש רק ל-service_role, ש-bypass-RLS ממילא — כלומר
ההגדרה לא מוסיפה הגנה. אם בכל זאת רוצים אותה, השאילתה לבדיקה מוקדמת נמצאת
ב-`SECURITY-PROGRESS.md` תחת C2.

### F3 — `/api/engagement/tick` עדיין רץ כ-anon
הנתיב מוגן ב-`ENGAGEMENT_CRON_SECRET` אבל משתמש ב-`createServerSupabaseClient()`
בלי סשן — כלומר תפקיד `anon` — לכל הקריאות שלו (`engagement_schedules`,
`subscriptions`, `journey_analysis`, `message_templates`, `sent_messages`,
`activity_logs`). בשלב 1 הועברה **רק** קריאת ה-view לשירות, כי זו הייתה
הקריאה שה-`REVOKE` היה שובר.
בקוד עצמו יושבת הערה שאומרת בדיוק את זה: "In production, swap to
`createSupabaseAdminClient` with the service role key".
**כדאי לבדוק אם ה-cron הזה בכלל עובד היום** — אם RLS חוסם את
`engagement_schedules` ל-anon, הוא no-op שקט.

### F4 — ולידציית שם בשני מסלולי הרשמה שלא היו ברשימה (המשך C5)
`fullNameSchema` הוחל בארבעת הקבצים שהמסמך נקב בהם. שני מסלולים נוספים כותבים
`full_name` ל-`profiles` בשלב ה-verify ולא נגעתי בהם:

- `app/actions/otp-assessment.ts:63`
- `app/actions/otp-survey.ts:75`

שניהם עוברים דרך `sendEmailOtp` בשלב השליחה, ששם הוולידציה **כן** חלה — אז שם
עם markup ייחסם בכניסה. מה שלא מכוסה: קריאה ישירה ל-action של ה-verify עם
`fullName` אחר. ה-XSS עצמו כבר מת בשכבות 1 ו-2, אז זו הקשחה בלבד.
שורה אחת בכל קובץ.

### F5 — `describeError`/loop-guard בסוויפ של `reminders`
לא קשור לאבטחה, אבל בזמן העבודה על C5 ראיתי ש-`app/api/journey/reminders/route.ts`
כן אוסף `summary.errors` — כדאי להשוות מול הדפוס ב-`cycle-engine.ts`
(`reportLoopFailures` + סף התראה) שה-CLAUDE.md מגדיר כרפרנס.

---

## ממצאים שאינם במסמך האודיט

### F6 — `admin_pool` לא היה ב-CHECK המקורי
`056` הגדיר `recipient_kind IN ('user','expert_pool')`, ו-`060` הרחיב ל-
`('user','expert_pool','admin_pool')`. לא באג — רק לציין שהמסמך מפנה ל-056
כמקור, וההגדרה בפועל של הטבלה עודכנה ב-060. המדיניות עצמה מעולם לא הוגדרה
מחדש אחרי 056, כך שהתיקון ב-200 נכון.

### F7 — מספר ה-views
המסמך אומר "יש 9 views בסך הכל". בפועל יש **8 views ייחודיים** ב-10 הצהרות
`CREATE VIEW` (ל-`v_user_directory` יש שלוש הצהרות: 133, 137, 142).
הרשימה המלאה עם הסטטוס נמצאת ב-`SECURITY-PROGRESS.md` תחת C2.

### F8 — פער בין `main` ל-`game`
`main` תקוע ב-19.5.2026 ו-`origin/HEAD` מצביע על `game`. מי שיקרא את הוראת
העבודה כפשוטה ("פתח מ-main") יפתח ענף מבסיס בן חודשיים וחצי. שווה למחוק את
`main` או ליישר אותו, כדי שהמלכודת לא תחזור.
