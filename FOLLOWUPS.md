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

### F9 — מסלול כתיבה חמישי ל-`profiles.full_name` שעדיין לא מאומת
`lib/journey/finalize-journey-signup.ts:72` כותב
`full_name: args.fullName.trim()` ב-upsert ל-`profiles`, בלי ולידציה.
זה מסלול ההרשמה המוטמע של ה-journey (`otp-journey.ts` → `finalizeJourneySignup`).

מכוסה חלקית: שלב השליחה עובר ב-`sendEmailOtp`, שם `fullNameSchema` כן חלה, אז
שם עם markup נחסם בכניסה הרגילה. מה שלא מכוסה — קריאה ישירה ל-action של
ה-verify עם `fullName` אחר.

**לא נגעתי** כי הוא לא היה ברשימה של שלושת המסלולים שביקשת. שורה אחת, אותו
דפוס בדיוק כמו בשני האחרים. אמור מילה ואוסיף.

`app/api/leads/upsert/route.ts:159` גם כותב `full_name`, אבל לטבלת `leads` —
לא ל-`profiles`. שרשרת ה-XSS של C5 קוראת מ-`profiles` (דרך `getStuckUsers`),
אז הוא מחוץ להיקף. שווה בכל זאת מבט בשלב 2, כי הוא נכתב מנתיב ציבורי.

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

### F11 — `checkout_sessions.low_profile_code` אינו ייחודי, וה-C3 החדש רגיש לזה
`016:30` מגדיר אינדקס **חלקי אך לא ייחודי**:
```sql
CREATE INDEX checkout_sessions_low_profile_idx ON checkout_sessions(low_profile_code)
  WHERE low_profile_code IS NOT NULL;
```
התיקון של C3 מריץ עכשיו
`.eq("low_profile_code", lowProfileCode).maybeSingle()` על **כל** קולבק, בעוד
שקודם החיפוש הזה רץ רק כש-`ReturnValue` היה ריק. אם אי פעם יישמרו שתי שורות עם
אותו קוד, `maybeSingle()` יחזיר שגיאה (PGRST116) ולא שורה — ה-handler ייפול
לענף "session not found", יסמן `processed: true`, ויחזיר 200 ל-Cardcom.
כלומר **תשלום שהתקבל אצל Cardcom לא יזוכה אצלנו**, בשקט.

זה לא רגרסיה שהכנסתי (הקוד הישן היה קורס באותו אופן במסלול ה-fallback), אבל
התיקון הרחיב את החשיפה מ"רק כשאין ReturnValue" ל"תמיד".

**מה לעשות בשלב 2, לפי הסדר:**
1. לבדוק אם יש כפילויות בפועל:
   ```sql
   SELECT low_profile_code, count(*), array_agg(id ORDER BY created_at)
   FROM checkout_sessions
   WHERE low_profile_code IS NOT NULL
   GROUP BY low_profile_code HAVING count(*) > 1;
   ```
2. אם ריק — להוסיף `CREATE UNIQUE INDEX CONCURRENTLY` על אותה הגדרה חלקית,
   וזה סוגר את הבעיה מהשורש.
3. אם לא ריק — לנקות קודם, ובינתיים להחליף את `maybeSingle()` ב-
   `.order("created_at", { ascending: false }).limit(1).maybeSingle()`
   כדי שהקולבק ייקח את הסשן העדכני במקום ליפול.

**זה נוגע במסלול תשלום — לתאם לפני שינוי.**
