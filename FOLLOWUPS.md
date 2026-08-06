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

### F4 — ✅ נסגר (2026-08-06)
`otp-assessment.ts`, `otp-survey.ts` ו-`account/profile/actions.ts` קיבלו
`fullNameSchema`. נשאר מסלול אחד — ראה F9.

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

### F9 — ✅ נסגר (2026-08-06)
`lib/journey/finalize-journey-signup.ts` קיבל `fullNameSchema` (commit `37c1ad8`).
משטח הכתיבה ל-`profiles.full_name` סגור — המפה המלאה של ששת המסלולים, ושל מה
שנבדק ונמצא מחוץ להיקף, נמצאת ב-`SECURITY-PROGRESS.md` תחת C5.

### F10 — `is_expert()` הפכה לפונקציה מתה אחרי מיגרציה 200
אחרי 200, `public.is_expert()` (043:45) כבר לא בשימוש באף מדיניות. היא נשארת
בסכמה כפיתיון: היא נראית כמו בדיקת הרשאה תקינה, ומי שיכתוב מדיניות חדשה בעוד
חצי שנה עלול לתפוס אותה שוב ולשחזר בדיוק את CRITICAL #4.

**בשלב 2:** לוודא ב-`pg_policies` ובקוד שאין יותר קוראים, ואז
`DROP FUNCTION public.is_expert();`. אם עדיין רוצים לשמור אותה, לפחות
`COMMENT ON FUNCTION` שאומר "לא לשימוש ב-RLS — השתמש ב-is_expert_for_couple/user".

לבדיקה לפני DROP:
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE qual::text LIKE '%is_expert()%' OR with_check::text LIKE '%is_expert()%';
```

### F11 — `checkout_sessions.low_profile_code` ללא אינדקס ייחודי (הקשחה, לא דחוף)
`016:30` מגדיר אינדקס **חלקי אך לא ייחודי**:
```sql
CREATE INDEX checkout_sessions_low_profile_idx ON checkout_sessions(low_profile_code)
  WHERE low_profile_code IS NOT NULL;
```

**תוקן 6.8 — ההערכה הראשונית שלי הייתה מחמירה מדי.** מה שקורה בפועל אם יש כפילות:

1. `maybeSingle()` מחזיר `error` (PGRST116) ו-`data = null`. הקוד מפרק רק
   `{ data: byLp }` ומתעלם מה-error → `byLp` הוא `null`.
2. `session` נשאר null → נכנס ה-fallback לפי `ReturnValue`.
3. השורה הכפולה נושאת **אותו** `low_profile_code`, ולכן
   `byId.low_profile_code === lowProfileCode` מתקיים → הסשן הנכון נפתר.

כלומר אין אובדן. אובדן שקט דורש כפילות **וגם** `ReturnValue` ריק —
ו-`ReturnValue` נשלח ל-Cardcom תמיד, משני נתיבי היצירה:
`lib/cardcom.ts:57` (LowProfile.aspx) ו-`lib/cardcom.ts:296` (v11 CreateTokenOnly),
בשניהם כשדה חובה לא-אופציונלי (`returnValue: string`), ושני ה-callers
(`checkout/create:540`, `checkout/create-trial:375`) מעבירים `sessionId`.
ה-indicator קורא אותו חזרה case-insensitive (`getParamCI`).

בנוסף, כפילות בכלל דורשת ש-Cardcom יחזיר את אותו `LowProfileCode` לשתי עסקאות
שונות — הקוד שלנו חותם אותו ב-`.update().eq("id", sessionId)` אחרי קריאה נפרדת.

**מסקנה:** האינדקס הייחודי הוא **הגנת עומק, לא מצב חירום.** לא נוגע בשלב 1.
בשלב 2, לפי הסדר:
1. לבדוק כפילויות בפועל:
   ```sql
   SELECT low_profile_code, count(*), array_agg(id ORDER BY created_at)
   FROM checkout_sessions
   WHERE low_profile_code IS NOT NULL
   GROUP BY low_profile_code HAVING count(*) > 1;
   ```
2. אם ריק — `CREATE UNIQUE INDEX CONCURRENTLY` על אותה הגדרה חלקית.
3. אם לא ריק — לנקות קודם.

**זה נוגע במסלול תשלום — לתאם לפני שינוי.**
