# SECURITY-PROGRESS — שלב 1 (ממצאים קריטיים)

ענף: `security/phase-1-critical`
בסיס: `origin/game` (49643ce) — **לא** `main`. `main` תקוע ב-19.5.2026;
`origin/HEAD` מצביע על `origin/game`, וזה הבסיס החי.

---

## Baseline — לפני שנגעתי בכלום

הורץ על העץ הנקי (`origin/game`) לפני התיקון הראשון.

| בדיקה | תוצאה |
|---|---|
| `pnpm lint` | ✅ עבר — `✔ No ESLint warnings or errors` |
| `pnpm exec tsc --noEmit` | ✅ עבר — exit 0, ללא פלט |
| `pnpm test:run` | ❌ **נכשל כבר בבסיס** — `Test Files 11 failed \| 14 passed (25)` · `Tests 6 failed \| 163 passed (169)` |
| `pnpm build` | ✅ עבר — exit 0 |

### פירוט הכשלים שהיו קיימים לפני שנגעתי (11 קבצים)

**(א) 7 קבצים שלא נטענים בכלל (`0 test`) — בעיות סביבת טסט, לא לוגיקה:**

| קובץ | סיבה |
|---|---|
| `tests/auth/signup-with-consent.test.ts` | `app/actions/auth-actions.ts:6` מייבא `server-only` → "This module cannot be imported from a Client Component module" |
| `tests/journey/short-coverage.test.ts` | `lib/journey/questions-db.ts:244` → `TypeError: cache is not a function` |
| `tests/journey/render-from-db-parity.test.ts` | אותו `cache is not a function` |
| `tests/journey/scoring-source-parity.test.ts` | אותו `cache is not a function` |
| `tests/journey/journey-questions-cms.test.ts` | אותו `cache is not a function` |
| `tests/journey/phase-flow.test.ts` | אותו `cache is not a function` (דרך `lib/journey/phase.ts`) |
| `tests/cms/sanitize.test.ts` | `vi.mock` hoisting — `ReferenceError: Cannot access 'tagAsRegisteredMock' before initialization` |
| `tests/journey/hero-fallback.test.ts` | אותה בעיית `vi.mock` |

**(ב) 6 טסטים שנכשלים על assertion:**

| קובץ | טסט |
|---|---|
| `tests/api/brevo-unsubscribe-webhook.test.ts:241` | `non-unsubscribe event` — קיבל `non_actionable_event`, ציפה ל-`non_unsubscribe_event` |
| `tests/email/brevo-segments-sync.test.ts:435` | `addProductToContact` merges without duplicates |
| `tests/journey/questionnaire.test.ts:28` | `has exactly 32 questions` |
| `tests/journey/questionnaire.test.ts:43` | `auth gate is set after q27` |
| `tests/journey/questionnaire.test.ts:56` | `locked domain distribution (7-3-3-5-7 + 7 null)` |
| `tests/journey/questionnaire.test.ts:76` | `priority ranking question is the last item` |

> **מכאן והלאה:** אלה הכשלים היחידים שמתקבלים. כל כשל נוסף = משהו ששברתי.
> שים לב ש-`tests/auth/signup-with-consent.test.ts` (הרלוונטי ל-C5) **לא נטען כבר בבסיס** —
> זה משפיע על איך אפשר לאמת את C5. ראה ברשומה של C5.

---

## C1 — user_sessions RLS

- **סטטוס:** הקוד הושלם · **המיגרציה טרם הורצה — דורש אימות ידני**
- **קבצים שהשתנו:** `supabase/migrations/199_security_rls_hardening.sql`
- **מה נעשה:** המדיניות `user_sessions_service_all` נוצרה ב-020 בלי `TO`, ולכן
  חלה על `PUBLIC` כולל `anon`. המיגרציה מצמצמת אותה ל-`TO service_role`, מבצעת
  `REVOKE ALL ... FROM anon, authenticated` ומפעילה `FORCE ROW LEVEL SECURITY`.

  **עדכון 6.8:** ה-`GRANT SELECT ... TO authenticated` שהיה בטיוטת האודיט **הוסר**
  (בביקורת שלך). הוא לא שירת אף מסך — אין קורא לטבלה מחוץ ל-`session-enforcement`,
  שכולו service-role — ובזמן שהיה קיים, כל משתמש מחובר יכול היה לקרוא את השורה
  שלו כולל `session_token` דרך PostgREST. המדיניות `user_sessions_select_own`
  נשארה בכוונה, כך שהחזרת ה-GRANT בעתיד תהיה החלטה מודעת ולא תאונה.
- **איך אימתתי:**
  - שה-`REVOKE` לא ישבור התחברות — `grep -rn "user_sessions"` על כל `app/`, `lib/`,
    `components/`, `middleware.ts` מחזיר **רק** את `lib/auth/session-enforcement.ts`,
    וכל ארבע הפעולות שם (`upsert`, שתי קריאות, `delete`) עוברות דרך
    `createAdminSupabaseClient()` = service role (`lib/supabase/admin.ts:11` קורא
    `SUPABASE_SERVICE_ROLE_KEY`). כלומר אין אף קורא ב-`anon`/`authenticated`.
  - בדיקת מבנה של ה-SQL: איזון סוגריים 0, 10 הצהרות, כולן נפרשות כצפוי.
  - `pnpm lint` ✅ · `pnpm exec tsc --noEmit` ✅ · `pnpm build` ✅ ·
    `pnpm test:run` — 11 קבצים / 6 טסטים נכשלים, **זהה בדיוק ל-baseline**
    (`diff` על רשימת ה-FAIL מול ה-baseline החזיר ריק).
- **מה שברתי / שינוי התנהגות:** כלום בקוד. אחרי הרצת המיגרציה, כל קריאה עתידית
  ל-`user_sessions` ממפתח anon תיכשל — זו המטרה.
- **שאלות פתוחות:** `FORCE ROW LEVEL SECURITY` חל גם על בעל הטבלה. אם תפקיד
  `postgres` בפרויקט הזה **אינו** `BYPASSRLS`, שאילתות שתריץ ב-SQL editor על
  הטבלה יחזירו 0 שורות (המדיניות היחידה שתחול עליו היא `user_sessions_select_own`,
  ו-`auth.uid()` שם הוא NULL). לבדיקה מהירה:
  ```sql
  SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname IN ('postgres','service_role');
  ```
  אם `postgres` מחזיר `rolbypassrls = false`, הסר את שורת ה-`FORCE` — כל שאר
  התיקון עומד בפני עצמו.

### אימות שנותר לך (אני לא מריץ SQL על פרודקשן)

אין סביבת staging — פרויקט Supabase אחד משרת את כל הסביבות (מתועד ב-CLAUDE.md),
ואין Postgres/Docker/Supabase-CLI מקומיים. לכן המיגרציה **לא הורצה**.
אחרי ההרצה, עם **מפתח ה-anon בלבד**:

```bash
curl "$SUPABASE_URL/rest/v1/user_sessions?select=*" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# ציפייה: [] או שגיאת הרשאה. אם חוזרות שורות — התיקון לא עבד.
```

ואז: התחברות רגילה לאתר עדיין עובדת (זה מה שכותב ל-`user_sessions`).

### אחרי הפריסה — פעולה שדורשת תיאום איתך

```sql
TRUNCATE public.user_sessions;
```
יש להניח שהטוקנים הקיימים דלפו. זה מנתק את **כל** המשתמשים ומאלץ התחברות מחדש.
**לא ביצעתי ולא אבצע בלי אישור ותיאום שעה.**

---

## C2 — admin_users_overview + analytics_daily_summary

- **סטטוס:** הקוד הושלם · **המיגרציה טרם הורצה — דורש אימות ידני**
- **קבצים שהשתנו:**
  - `supabase/migrations/199_security_rls_hardening.sql`
  - `app/api/admin/users/route.ts`
  - `app/api/admin/users/[id]/route.ts`
  - `app/api/admin/messages/send/route.ts`
  - `app/dashboard/users/[id]/page.tsx`
  - `app/api/engagement/tick/route.ts`
- **מה נעשה:** `admin_users_overview` (026:367) היה `GRANT SELECT ... TO authenticated`
  ואינו `security_invoker`, כלומר כל משתמש מחובר יכול היה לקרוא מייל, מנוי
  וניתוח זוגיות (`friendship_score`, `passion_risk`, `four_horsemen_flag`) של כל
  משתמש. `analytics_daily_summary` (038:43) נוצר בלי `REVOKE` מעל טבלה שה-RLS
  שלה service-role בלבד. שניהם צומצמו ל-service_role.
- **הבעיה שמצאתי ולא הייתה במסמך:** חמישה מקומות קראו את ה-view דרך client של
  `authenticated` (עוגייה), לא service-role — ולכן ה-`REVOKE` היה שובר אותם:
  `api/admin/users`, `api/admin/users/[id]`, `api/admin/messages/send`,
  `dashboard/users/[id]/page.tsx`, `api/engagement/tick`.
  `getAdminSession()` מחזיר `createServerSupabaseClient()`, שהוא client של המשתמש.
  באישורך הועברו החמישה ל-service-role **רק עבור קריאת ה-view**; שער ההרשאה
  (`getAdminSession`/`requireAdmin`/סוד cron) לא נגעתי בו, וכל שאר השאילתות
  בקבצים האלה נשארו על ה-client המקורי שלהן.
- **איך אימתתי:**
  - מיפוי כל 32 קריאות ה-`.from("admin_users_overview")` בריפו והקליינט של כל אחת.
    אחרי השינוי: `grep -rn 'supabase\.from("admin_users_overview")'` מחזיר ריק,
    ובדיקה פרטנית של חמשת הקבצים מראה `createAdminClient()` בכל אחד.
  - `analytics_daily_summary` — אפס קריאות בקוד האפליקציה (`grep` על `app`,
    `components`, `lib`, `scripts`), ולכן גם `security_invoker` עליו חסר סיכון.
  - `pnpm lint` ✅ · `tsc` ✅ · `build` ✅ · `test:run` זהה ל-baseline.
- **מה שברתי / שינוי התנהגות:** `dashboard/users/[id]` ו-`api/engagement/tick`
  יזרקו כעת אם `SUPABASE_SERVICE_ROLE_KEY` חסר (`createAdminClient` זורק), במקום
  להיכשל בשקט. בפרודקשן המשתנה קיים.
- **שאלות פתוחות:** אין. `security_invoker` על `admin_users_overview` הושמט
  בהחלטתך — הנימוק ב-`FOLLOWUPS.md` F2. אם תרצה אותו בכל זאת, הרץ קודם:
  ```sql
  SELECT has_table_privilege('service_role','auth.users','SELECT') AS can_read_auth_users;
  ```
  `true` → אפשר להוסיף `ALTER VIEW public.admin_users_overview SET (security_invoker = on);`
  `false` → אסור, זה ישבור ~25 קריאות כולל מיילים.

### הביקורת על כל ה-views (הנדרשת ב-C2)

8 views ייחודיים ב-10 הצהרות `CREATE VIEW` (המסמך אמר 9 — ראה FOLLOWUPS F7).

| # | View | מוגדר ב- | סטטוס לפני | פעולה |
|---|---|---|---|---|
| 1 | `admin_users_overview` | 026:326 | ❌ `GRANT ... TO authenticated` (026:367) | **תוקן ב-199** |
| 2 | `analytics_daily_summary` | 038:43 | ❌ ללא `REVOKE` כלל | **תוקן ב-199** |
| 3 | `v_user_last_login` | 132:37 | ✅ `REVOKE FROM anon, authenticated` + `GRANT TO service_role` (132:197-208) | תקין |
| 4 | `v_user_activity_level` | 132:53 | ✅ אותו בלוק | תקין |
| 5 | `v_chapter_funnel` | 132:80 | ✅ אותו בלוק | תקין |
| 6 | `v_service_dwell` | 132:107 | ✅ אותו בלוק | תקין |
| 7 | `v_abandonment` | 132:129 | ✅ אותו בלוק | תקין |
| 8 | `v_user_directory` | 133:30, 137:18, 142:14 | ✅ `REVOKE`+`GRANT` אחרי כל אחת משלוש ההגדרות | תקין |

אין materialized views (`grep -i "materialized view"` מחזיר רק הערה ב-133:27).

### אימות שנותר לך

```bash
curl "$SUPABASE_URL/rest/v1/admin_users_overview?select=*" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# ציפייה: שגיאת הרשאה
```
וכן עם טוקן של משתמש רגיל מחובר — אמור להיכשל גם כן.
ובאפליקציה: `/dashboard/users`, `/dashboard/users/[id]`, ושליחת הודעת אדמין —
**חייבים להיטען אחרי הפריסה.** אם הם ריקים, הקוד והמיגרציה לא נפרסו יחד.

---

## C3 — קולבק Cardcom סומך על ReturnValue

- **סטטוס:** ✅ **הושלם ואומת בטסטים**
- **קבצים שהשתנו:**
  - `app/api/billing/cardcom/indicator/route.ts`
  - `lib/billing/process-trial-lowprofile.ts`
  - `tests/billing/cardcom-indicator-session-binding.test.ts` (חדש)
- **מה נעשה:** `low_profile_code` הפך למקור הסמכותי לבחירת הסשן. `ReturnValue`
  נבדק רק כשאין סשן שנושא את הקוד, ומתקבל רק אם ה-`low_profile_code` המאוחסן
  הוא `NULL` (סשנים ישנים). אי-התאמה נרשמת כ-`[indicator:LP_MISMATCH]` ונדחית.
  אותו תיקון במסלול הניסיון.
- **איך אימתתי:** 4 טסטים חדשים, ו**הוכחתי שהם תופסים את הבאג** — החזרתי זמנית
  את הקוד הפגיע והרצתי:
  ```
  × ignores a forged ReturnValue and settles the session the code really belongs to
  × grants nothing when the code matches no session and ReturnValue mismatches
   Test Files  1 failed (1)   Tests  2 failed | 2 passed (4)
  ```
  ואחרי החזרת התיקון:
  ```
   ✓ tests/billing/cardcom-indicator-session-binding.test.ts (4 tests) 113ms
   Test Files  1 passed (1)   Tests  4 passed (4)
  ```
  שני הטסטים של המסלול התקין (רכישה רגילה, וסשן legacy בלי קוד) עוברים בשתי
  הגרסאות — כלומר התיקון לא שינה את ההתנהגות האמיתית.
  `pnpm lint` ✅ · `tsc` ✅ · `build` ✅.
- **מה שברתי / שינוי התנהגות:** קולבק שבו `ReturnValue` מצביע על סשן עם
  `low_profile_code` **אחר** כבר לא מזוהה — הוא נדחה ונרשם. זה התיקון עצמו.
  רכישה תקינה, רכישת ניסיון וסשן legacy ללא קוד — ללא שינוי.
- **שאלות פתוחות:** השוואת הסכום **לא בוצעה, במכוון.**
  `pullLowProfileIndicator` מחזירה `{ paid, operationResponse, dealNumber, parsed, raw }`
  ואין בה שדה סכום; `grep` על כל הריפו לא מצא שום חילוץ סכום מתשובת Cardcom.
  לפי הוראת העבודה לא המצאתי שדה. פירוט ב-`FOLLOWUPS.md` F1.

### שאילתת החקירה — להרצה על פרודקשן (אני לא מריץ)

```sql
SELECT cs.id, cs.user_id, cs.amount, cs.low_profile_code, cs.status, cs.created_at
FROM checkout_sessions cs
WHERE cs.status = 'paid'
  AND cs.low_profile_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM billing_events be
    WHERE be.idempotency_key = 'lp:' || cs.low_profile_code
  )
ORDER BY cs.created_at DESC;
```
כל שורה = סשן "שולם" בלי אירוע חיוב תואם. **אם חוזרות שורות — עצור והחזר לי,
לא לגעת בהן** (נספח ג' סעיף 6).

---

## C4 — כל expert קורא את כל ההודעות

- **סטטוס:** הקוד הושלם · **המיגרציה טרם הורצה — דורש אימות ידני**
- **קבצים שהשתנו:** `supabase/migrations/200_expert_scope_messaging.sql`
- **מה נעשה:** נוספה `is_expert_for_user(uuid)` — אותה בדיקה כמו
  `is_expert_for_couple` אבל מנקודת מוצא של משתמש (דרך `couple_members`) — ושלוש
  המדיניות נכתבו מחדש סביבה. `is_expert()` הוסרה משלושתן.
- **המיפוי, כפי שאומת מול המיגרציות (לא לפי התיאור במסמך):**
  - `journey_messages` — XOR: `scheduled_item_id` או `channel_user_id` (056:105).
    - per-item → `journey_scheduled_items.assignment_id` (035:230) → `journey_assignments`
    - channel → `channel_user_id` הוא user id → `couple_members`
  - **`journey_assignments` הוא עצמו XOR: `user_id` או `couple_id` (035:196).**
    זו הנקודה שבה ה-snippet במסמך היה שוגה: מסלול סולו נושא `couple_id IS NULL`,
    ולכן `is_expert_for_couple(a.couple_id)` לבדה הייתה מסתירה מהמאמן **כל
    מסע סולו**. שני הענפים מטופלים.
  - `journey_user_channels` — מפתח `user_id` → `couple_members`.
  - `journey_notifications` — `recipient_user_id` → `couple_members`.
    שורות `expert_pool`/`admin_pool` נושאות `recipient_user_id = NULL` ואי אפשר
    לקשור אותן לזוג; ה-`payload` שלהן מכיל `preview` — קטע מגוף ההודעה של
    המשתמש (`app/actions/journey-messages.ts:324,583`). באישורך: **אדמינים בלבד.**
- **איך אימתתי:**
  - שאין סיכון לרוקן מסך: כל קריאה בקוד לשלוש הטבלאות עוברת ב-client של
    service-role (שעוקף RLS). בדקתי כל קובץ; `createServerSupabaseClient()`
    מופיע בהם רק לזיהוי המשתמש (`auth.getUser()`), לא לשאילתה על הטבלאות.
    לוח המאמן (`lib/experts/queries.ts:63`) פותר לקוחות דרך
    `expert_couples → couples → couple_members` ב-service-role — לא נוגע במדיניות.
  - ש-056 היא ההגדרה היחידה של שלוש המדיניות (`grep` על כל המיגרציות) — כלומר
    אני מתקן את הגרסה הפעילה ולא גרסה שנדרסה.
  - בדיקת מבנה SQL: איזון סוגריים 0, 9 הצהרות.
- **מה שברתי / שינוי התנהגות:** מאמן יאבד גישה ישירה ב-REST להודעות של זוגות
  שאינם שלו ולשורות ה-pool. במסכי האפליקציה — אין שינוי (הכל service-role).
- **שאלות פתוחות:** אין. שאלת שורות ה-pool הוכרעה על ידך.

### אימות שנותר לך

לא הרצתי — אין staging ואין Postgres מקומי. אחרי ההרצה, לפי המסמך:
2 מאמנים, 2 זוגות, מאמן A מקושר לזוג 1 בלבד; עם הטוקן של A לקרוא
`journey_messages` → רק זוג 1; קריאה מפורשת לפי `id` של הודעת זוג 2 → 0 שורות;
אדמין → הכל; המשתמש עצמו → ההודעות שלו.
ובאפליקציה: **מסך המאמן עדיין נטען ומציג נתונים** (צפוי — הוא service-role).

### שאילתת החקירה — רדיוס הפגיעה

```sql
SELECT u.id, u.email, p.role
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE p.role IN ('expert','admin');
```
(תיקנתי את השאילתה שבמסמך: שם היא בחרה `id, email, role` בלי קידומת, מה
שנכשל על `id`/`email` מעורפלים אחרי ה-JOIN.)

---

## C5 — XSS מאוחסן בדשבורד

- **סטטוס:** ✅ **הושלם ואומת בטסטים** (שכבות 1-2 מלאות; שכבה 3 — ראה "שאלות פתוחות")
- **קבצים שהשתנו:**
  - `components/dashboard/journey/AdminAlertsBanner.tsx`
  - `app/api/journey/reminders/route.ts`
  - `lib/validations.ts`
  - `app/actions/auth-actions.ts`
  - `app/actions/otp-auth.ts`
  - `lib/auth/otp-core.ts`
  - `tests/auth/full-name-validation.test.ts` (חדש)
  - `tests/dashboard/admin-alerts-banner-xss.test.tsx` (חדש)
- **מה נעשה:** שלוש השכבות.
  1. **רינדור** — ה-banner מפצל את ה-preview על `<br>` ומרנדר כל שורה כטקסט.
     `dangerouslySetInnerHTML` הוסר.
  2. **כתיבה** — `escapeHtml` על כל ערך שמקורו במשתמש לפני שרשור ל-digest.
  3. **קלט** — `fullNameSchema` (אותיות, סימנים, רווח, `'`, `-`, `.`; עד 80)
     ב-`signupAction`, ב-`verifyAuthSignupOtp` וב-`sendEmailOtp`.
     `sendEmailOtp` היא נקודת הכניסה המשותפת לכל ארבעת מסלולי ה-OTP
     (auth, journey, assessment, survey), כך ששלב השליחה מכוסה בכולם.
- **איך אימתתי:** 9 טסטים חדשים, ו**הוכחתי שהם תופסים את הבאג**.
  - `tests/auth/full-name-validation.test.ts` — 7 טסטים:
    ```
     ✓ tests/auth/full-name-validation.test.ts (7 tests) 12ms
    ```
    כולל `<img src=x onerror="alert(1)">` נדחה, ו**"יצחק בר-לב" מתקבל** (וגם
    `O'Brien`, `Jean-Luc Picard`, `محمد`, `José Álvarez`).
  - `tests/dashboard/admin-alerts-banner-xss.test.tsx` — רינדור אמיתי של הרכיב
    ב-`react-dom/server`. מול הקוד הפגיע:
    ```
    × escapes an injected <img> instead of emitting it as an element
    × still splits the digest's <br> separators into separate lines
     Test Files  1 failed (1)   Tests  2 failed (2)
    ```
    ואחרי התיקון:
    ```
     ✓ tests/dashboard/admin-alerts-banner-xss.test.tsx (2 tests) 56ms
    ```
    הפלט בפועל מכיל `&lt;img src=x onerror=&quot;alert(1)&quot;&gt;` — טקסט, לא אלמנט.
  - `pnpm lint` ✅ · `tsc` ✅ · `build` ✅ · `test:run` — זהה ל-baseline
    (11/6 נכשלים), פלוס 13 טסטים עוברים חדשים.
- **מה שברתי / שינוי התנהגות:** הרשמה עם שם שמכיל `<`, `>`, `"`, `&` או ספרות
  תידחה עם הודעה בעברית. שמות עבריים/לועזיים רגילים עוברים (מכוסה בטסטים).
- **עדכון 6.8 — שלושה מסלולי כתיבה נוספים נסגרו** (commit `30662e9`):
  - `app/[locale]/account/profile/actions.ts:41` — `saveProfileDetails`. זה היה
    הפער המשמעותי: עדכון `profiles.full_name` מאחורי בדיקת `length >= 2` בלבד,
    **בלי OTP בכלל**. הרשמה עם שם תקין ואז עריכה בעמוד הפרופיל הייתה מגיעה לאותו
    דשבורד אדמין. בדיקת האורך והודעת השגיאה המקוריות נשמרו, `fullNameSchema` נוסף מעליהן.
  - `app/actions/otp-assessment.ts:63`
  - `app/actions/otp-survey.ts:75`

  שלושתם כותבים כעת את הפלט המנוקה של הסכמה (`nameCheck.data`) ולא `.trim()` משלהם.
- **שאלות פתוחות:** אין. משטח הכתיבה ל-`profiles.full_name` **סגור** — ראה המפה למטה.

### מפת כל מסלולי הכתיבה ל-`profiles.full_name` — סגורה (אימות משותף, 6.8.2026)

נסרקה על ידך ואומתה מולי. **אין צורך לחפש שוב.**

| # | מסלול | קובץ | סטטוס |
|---|---|---|---|
| 1 | הרשמה בסיסמה | `app/actions/auth-actions.ts:68` (`signupAction`) | ✅ `fullNameSchema` לפני `createUser` — מכסה גם את `user_metadata` וגם את ה-upsert |
| 2 | הרשמת OTP ראשית | `app/actions/otp-auth.ts:80` (`verifyAuthSignupOtp`) | ✅ מאומת בכתיבה |
| 3 | הרשמת אבחון | `app/actions/otp-assessment.ts:61` | ✅ מאומת בכתיבה |
| 4 | הרשמת סקר | `app/actions/otp-survey.ts:72` | ✅ מאומת בכתיבה |
| 5 | עריכת פרופיל | `app/[locale]/account/profile/actions.ts:41` (`saveProfileDetails`) | ✅ **המסלול היחיד בלי OTP** — בדיקת אורך קיימת + סכמה |
| 6 | journey inline | `lib/journey/finalize-journey-signup.ts:70` | ✅ מאומת; שם פסול מושמט מה-upsert + `console.error` (לפונקציה אין ערוץ שגיאה) |

**נבדקו ונמצאו מחוץ להיקף:**

- `lib/auth/otp-core.ts:84` — כותב `full_name` ל-`user_metadata`, אבל מכוסה
  ע"י בדיקת `fullNameSchema` שמעליו באותה פונקציה תחת `mode === "signup"`.
- `app/api/leads/upsert/route.ts:159` — כותב לטבלת **`leads`**, לא `profiles`.
  שרשרת ה-XSS של C5 קוראת מ-`profiles` דרך `getStuckUsers`, ולכן מחוץ לשרשרת.
- `components/SubscriptionModal.tsx` ו-`components/marathon/MarathonForm.tsx` —
  שולחים ל-`/api/leads/upsert`. **אין כתיבת `profiles` מהלקוח.**

### ביקורת כל שימושי `dangerouslySetInnerHTML` (הנדרשת ב-C5)

הרצתי `grep -rn "dangerouslySetInnerHTML" app/ components/ lib/`. אף אחד מהם,
פרט לזה שתוקן, לא מקבל מידע שמקורו במשתמש קצה:

| קבוצה | מקומות | מקור המידע | מסקנה |
|---|---|---|---|
| **תוקן** | `AdminAlertsBanner.tsx:82` | `full_name` של משתמש → cron → payload | ✅ **זו הייתה החולשה** |
| JSON-LD דרך `safeJsonLd()` | `layout.tsx:120,124`, `page.tsx:357`, `mioshy-sex/[slug]:383`, `mioshy-sex:310`, `articles:147`, `articles/[slug]:356`, `journey:479`, `about/founder:141`, `games:584`, `games/[slug]:298,320`, `FAQ.tsx:107` | תוכן DB שנכתב בידי אדמין | בטוח — `lib/seo/jsonLd.ts:12` מבצע `JSON.stringify` + escaping של `<` |
| בלוקי `<style>` סטטיים | `loading.tsx:67`, `games:538,1082`, `pricing:130`, `journey:964`, `mioshy-sex/[slug]/play:442`, `AuthBackground:30`, `AdultsHeroBuy:448`, `AdultsMarketingSections:611`, `AdultsMarketingHero:330`, `SexHeroBlobs:57`, `PlayAmbience:137`, `SnakesGameBoard:1346`, `JourneyAmbience:186`, `AdultsAmbience:268`, `HomeBackground:41`, `JourneyStages:226`, `GamesPageAtmosphere:58` | template literal קבוע בקוד | בטוח — אפס קלט |
| SVG דרך `fitSvgToContainer()` | `Wheel.tsx:639`, `AppearanceTab.tsx:87`, `WheelPreview.tsx:161` | הגדרת גלגל שנכתבה בידי אדמין | שלב 4 לפי המסמך — **לא נגעתי** |
| CMS rich text | `CmsTextRow.tsx:712`, `MaybeRichText.tsx:86`, `CmsText.tsx:159`, `LiveDemoHero.tsx:392,406`, `mioshy-sex/page.tsx:429` | `cms_texts`, נכתב בידי אדמין | שלב 4 לפי המסמך — **לא נגעתי** |
| סקריפט GTM | `GoogleTagManager.tsx:46` | סקריפט consent קבוע + מזהה מ-env | בטוח |

### אימות שנותר לך (דורש הרצת cron + מסך)

שלבים 1-3 של המסמך (יצירת משתמש עם שם זדוני, הרצת ה-cron, פתיחת
`/dashboard/journey/health`) לא בוצעו — הם דורשים כתיבה לפרודקשן.
הטסט של הרכיב מכסה בדיוק את אותו תרחיש ברמת הרינדור.
שלבים 4-5 (הרשמה עם שם זדוני נדחית / שם עברי עובר) **כן** מכוסים בטסטים.

---

## סיכום שלב 1

| משימה | קוד | אומת מקומית | דורש הרצה שלך |
|---|---|---|---|
| C1 user_sessions | ✅ | מיפוי קוראים + מבנה SQL | הרצת מיגרציה 199 + curl anon + `TRUNCATE` בתיאום |
| C2 views | ✅ | מיפוי 32 קריאות + מבנה SQL | הרצת מיגרציה 199 + curl anon + בדיקת מסכי אדמין |
| C3 Cardcom | ✅ | **4 טסטים, נופלים על הקוד הישן** | שאילתת חקירה + רכישת sandbox |
| C4 expert scope | ✅ | מיפוי קוראים + מבנה SQL | הרצת מיגרציה 200 + בדיקת 2 מאמנים |
| C5 XSS | ✅ | **9 טסטים, נופלים על הקוד הישן** | cron + מסך health (אופציונלי) |

**עדכון 6.8 (אחרי הביקורת):** שלושה commits נוספים —
`30662e9` ולידציית שם בשלושה מסלולי כתיבה, `b90ce07` הסרת ה-GRANT מ-199,
`d0ca2cb` תיעוד F10/F11. lint/tsc/build ירוקים, ורשימת הטסטים הנכשלים עדיין
זהה ל-baseline (`diff` ריק).

**לא ביצעתי merge. לא פרסתי. לא הרצתי SQL על פרודקשן.**
שתי המיגרציות (199, 200) כתובות ומקומיטות אך **לא הורצו**.

⚠️ **סדר פריסה חשוב:** את הקוד של C2 ואת מיגרציה 199 יש לפרוס **יחד**.
הרצת ה-`REVOKE` מול הקוד הישן שוברת את רשימת המשתמשים, עמוד המשתמש ושליחת
הודעת אדמין.
