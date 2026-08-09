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

---

# שלב 2 — סגירת פערים מבניים

ענף: `security/phase-2-hardening`
בסיס: `game` @ `0b6ee17` (המיזוג של PR #51). מיגרציות 199 ו-200 כבר רצו בפרודקשן.
המיגרציה הבאה היא **201**.

## Baseline — שלב 2

הורץ על העץ הנקי לפני התיקון הראשון.

| בדיקה | תוצאה |
|---|---|
| `pnpm lint` | ✅ עבר (exit 0) |
| `pnpm exec tsc --noEmit` | ✅ עבר (exit 0) |
| `pnpm test:run` | ❌ נכשל — `Test Files 11 failed \| 17 passed (28)` · `Tests 6 failed \| 176 passed (182)` |
| `pnpm build` | ✅ עבר (exit 0) |

רשימת הכשלים **זהה בדיוק** ל-baseline של שלב 1 (`diff` על רשימת ה-FAIL החזיר ריק) —
אותם 7 קבצים שלא נטענים (`server-only`, `cache is not a function`, hoisting של
`vi.mock`) ואותם 6 כשלי assertion. שלב 1 לא הוסיף ולא הסיר אף כשל; 13 הטסטים
שנוספו בו עוברים (163 → 176 עוברים).

מכאן והלאה, אלה הכשלים היחידים שמתקבלים.

---

## ⚠️ משתני סביבה — להגדיר לפני המיזוג

**זו התלות הקשה של שלב 2.** שני תיקונים נכשלים-סגור בכוונה, ולכן אם הקוד עולה
לפני שהסודות מוגדרים — Brevo יחזיר 503 וכל ה-cron יחזירו 401.
**סוד קודם, קוד אחרי.** אני לא מגדיר ולא נוגע ב-Vercel.

| משתנה | ערך מצופה | סביבות | מי תלוי בו |
|---|---|---|---|
| `BREVO_WEBHOOK_SECRET` | מחרוזת אקראית 40 תווים, **אותיות וספרות בלבד** (סימנים מיוחדים נשברים בתוך URL) | Production (+ Preview) | `/api/brevo/unsubscribe-webhook`. **בלעדיו הנתיב מחזיר 503 והסרות/הקפצות לא נרשמות.** יש להגדיר אותו **גם ב-Brevo וגם בוורסל, ובסדר הנכון** — ראה `docs/brevo-webhook-secret-runbook.md`. הדרך המומלצת אינה כותרת HTTP אלא **פרמטר בכתובת ה-webhook** (`?secret=…`), כי היא אינה תלויה בשום יכולת מיוחדת של Brevo. |
| `JOURNEY_CRON_SECRET` | מחרוזת אקראית ≥32 תווים | Production, Preview | 16 נתיבי ה-cron/תפעול תחת `app/api/journey/*` ו-`app/api/whatsapp/*` |
| `BILLING_CRON_SECRET` | מחרוזת אקראית ≥32 תווים, **שונה** מהקודם | Production, Preview | `billing/renewals/run`, `billing/repair-missing-invoices` בלבד |
| `CRON_SECRET` | **כבר קיים** — לא לגעת | Production | Vercel Cron מצרף אותו אוטומטית לכל הרצה מתוזמנת. זה מה שמאמת בפועל את 17 העבודות. |

**למה אין סיכון להשבתה:** ה-helper מקבל `CRON_SECRET` **בנוסף** לסוד הייעודי.
כלומר גם אם `JOURNEY_CRON_SECRET`/`BILLING_CRON_SECRET` עדיין לא מוגדרים,
Vercel Cron ימשיך לאמת דרך `CRON_SECRET` והעבודות ימשיכו לרוץ. הסוד הייעודי
נחוץ רק להפעלה ידנית/חיצונית. **היוצא מן הכלל הוא `BREVO_WEBHOOK_SECRET`** —
שם אין ערך חלופי, וההגדרה שלו חוסמת השבתה של רישום ההסרות.

**משתנים שאינם בשימוש יותר** (אפשר להסיר מ-Vercel אחרי הפריסה, לא דחוף):
`JOURNEY_REMINDERS_CRON_SECRET`, `JOURNEY_CADENCE_CRON_SECRET`,
`JOURNEY_UNLOCK_CRON_SECRET`, `JOURNEY_GRACE_CRON_SECRET`,
`JOURNEY_SCORES_CRON_SECRET`, `MAILING_TEST_SECRET`,
`CARDCOM_BILLING_CRON_SECRET`, `CARDCOM_CRON_SECRET` (הטעות).
**אל תסיר אותם לפני שהסודות החדשים מוגדרים ואומתו.**

מנספח א' שעדיין פתוח ולא נגעתי בו: `BREVO_API_KEY` מוגדר פעמיים ב-`.env.local`
(השני דורס), ו-`NEXT_PUBLIC_BILLING_TEST_PRICE` — לוודא שאינו קיים בפרודקשן.

---

## H2 — סודות cron

- **סטטוס:** ✅ הושלם (קוד + טסטים) · **דורש הגדרת משתנים לפני מיזוג**
- **קבצים:** `lib/auth/cron-auth.ts` (חדש), `tests/auth/cron-auth.test.ts` (חדש),
  18 נתיבים תחת `app/api/billing/`, `app/api/journey/`, `app/api/whatsapp/`
- **מה נעשה:** כל נתיב גלגל `authOk` משלו עם שרשרת `||` שונה מתוך שישה סודות.
  `CARDCOM_BILLING_CRON_SECRET` ישב ב-fallback של עשרה נתיבי תוכן, כך שדליפה של
  סוד תוכן אחד הגיעה למסלולי הכסף. כל ההשוואות היו `===`.
  עכשיו: helper אחד, שני ערכים לכל נתיב (`CRON_SECRET` + הסוד של התחום),
  `timingSafeEqual`, ובלי יציאה מוקדמת מהלולאה.
- **איך אימתתי:**
  - `tests/auth/cron-auth.test.ts` — 10 טסטים עוברים. כוללים בידוד תחומים
    (סוד journey **נדחה** בנתיב billing ולהפך), קבלת `CRON_SECRET` בשני התחומים,
    דחיית prefix/extension של הסוד, ושימור ההתנהגות בהיעדר הגדרה
    (סגור בפרודקשן, פתוח ב-preview/local).
  - `grep` — אפס אזכורים של ששת הסודות הישנים בכל `app/api`.
  - `pnpm lint` ✅ · `tsc` ✅ · `build` ✅ · `test:run` ללא כשלים חדשים.
- **מה שברתי:** הפעלה ידנית של נתיב שהשתמשה ב-`MAILING_TEST_SECRET` או באחד
  מסודות ה-`JOURNEY_*` הישנים תפסיק לעבוד. יש להשתמש ב-`JOURNEY_CRON_SECRET`
  (או ב-`CRON_SECRET`).

### תיקון להנחת המסמך — ארבעת הנתיבים "שמעולם לא רצו"

המסמך קובע ש-`d1-reminders`, `drift-sweep`, `pact-honoured` ו-`weekly-recap`
"מחזירות 401 בכל הרצה ומעולם לא רצו". **זה כמעט בוודאות לא נכון.**
הטעות `CARDCOM_CRON_SECRET` ישבה **בסוף שרשרת `||`**, אחרי
`JOURNEY_REMINDERS_CRON_SECRET`. אם הראשון מוגדר, `expected` נפתר אליו והטעות
בלתי-נגישה — קוד מת, לא 401.

הראיה יושבת בקוד עצמו, ב-`marketing-sequence/route.ts:87`:
*"the cron auth was already working (CRON_SECRET matched the journey secret —
the 18:00Z run authenticated and sent results_ready)"*.

**שאילתה מכריעה — להרצה אצלך:**
```sql
SELECT 'd1-reminders'  AS job, count(*), max(created_at) FROM journey_reminder_log
UNION ALL SELECT 'drift-sweep',   count(*), max(created_at) FROM journey_drift_alerts
UNION ALL SELECT 'pact-honoured', count(*), max(updated_at) FROM journey_couple_pacts
UNION ALL SELECT 'weekly-recap',  count(*), max(created_at) FROM journey_weekly_recaps;
```
`max` עדכני = הן רצו, והתיקון הוא ניקוי. אפסים = המסמך צדק, וצריך לבדוק למה.

### FOLLOWUPS F3 — התשובה

`/api/engagement/tick` **כלל אינו ב-`vercel.json`**. הוא לא "רץ כ-anon" — הוא
לא רץ בכלל. זה נתיב נטוש, לא בעיית הרשאות. מחוץ לתחום H2 (לא תחת שלוש
התיקיות שהמסמך מונה), לא נגעתי.

---

## H1 — סוד webhook של Brevo

- **סטטוס:** ✅ הושלם (קוד + טסטים) · **דורש `BREVO_WEBHOOK_SECRET` לפני מיזוג**
- **קבצים:** `app/api/brevo/unsubscribe-webhook/route.ts`,
  `tests/api/brevo-unsubscribe-webhook.test.ts`
- **מה נעשה:** שתי בעיות. (1) הבדיקה **נכשלה-פתוח**: בלי המשתנה היא החזירה
  `ok:true` ועיבדה את הבקשה — והמשתנה לא הוגדר באף סביבה, כלומר זה היה המצב החי.
  עכשיו 503 + `timingSafeEqual`. (2) התשובה `{ ok, matched: true|false }` גילתה
  לכל קורא לא-מאומת אם כתובת מייל רשומה אצלנו — **אורקל מניית חשבונות** על כל
  בסיס המשתמשים. כל תוצאה מאומתת מחזירה כעת `{ ok: true }` זהה, וגם סוד שגוי
  מחזיר את אותו גוף במקום 401.
- **איך אימתתי:** 16 טסטים עוברים, כולל שני טסטים חדשים שמשווים **את גוף התשובה
  עצמו** (`res.text()`) בין כתובת רשומה ללא-רשומה, ובין סוד תקין לשגוי.
  ```
   ✓ tests/api/brevo-unsubscribe-webhook.test.ts (16 tests) 40ms
  ```
- **מה שברתי / שינוי התנהגות:** חוזה התשובה השתנה (אין יותר `matched`/`ignored`/
  `hardBounce`). Brevo לא קורא את הגוף, רק את הסטטוס — אין השפעה תפעולית.
  **כשל אחד מה-baseline נעלם:** הטסט `non-unsubscribe event` ציפה ל-
  `ignored === "non_unsubscribe_event"` בעוד הקוד תמיד החזיר `"non_actionable_event"`,
  כלומר הוא נכשל עוד לפני הענף הזה. השדה כולו הוסר.

---

## H5 — Redaction בלוגים

- **סטטוס:** ✅ הושלם (קוד + טסטים) לנתיבים שבמסמך
- **קבצים:** `lib/observability/redact.ts` (חדש), `lib/observability/log.ts`,
  `tests/observability/redact.test.ts` (חדש), `app/actions/auth-actions.ts`,
  `app/api/billing/renewals/run/route.ts`, `app/api/billing/cardcom/indicator/route.ts`
- **מה נעשה:** redactor בשתי שכבות ב-`emit()` — מפתחות מזהים נמחקים לגמרי
  (לא ממוסכים), וכל מחרוזת שנותרת עוברת ניקוי של תבניות מייל ו-E.164.
  `body`/`text`/`answer` ברשימה כי הטקסט החופשי כאן הוא תוכן זוגי אינטימי.
  המודול נפרד מ-`log.ts` כי זה מייבא `server-only` ולא ניתן לטעינה מטסט.
- **מעבר למסמך:** המסמך ביקש למחוק את שורת `[loginAction] attempting sign-in`.
  מצאתי ש-`[loginAction] sign-in failed` **גם** רושם מייל — והיא גרועה יותר, כי
  היא נורית בכל התחברות **כושלת**, כלומר תיעדה את היעד של כל ניסיון
  credential-stuffing. הוסרה גם היא, ובאותו קובץ גם שורת התביעה של test-user.
- **איך אימתתי:** 10 טסטים עוברים. `grep` על מסלול ההתחברות/OTP — אפס מיילים
  בקריאות `console`. `grep` על `url.search` בלוגים — NONE.
- **שאלות פתוחות:** חמישה מקומות נוספים רושמים מייל דרך `console` ישיר
  (עוקפים את ה-redactor): `my/page.tsx:292`, `my/journey/page.tsx:232,526`,
  `between-us-couple.ts:183`, `content-health.ts:168`. מחוץ לרשימת הקבצים של H5
  — `FOLLOWUPS.md` F12.

---

## H4 — Open redirect

- **סטטוס:** ✅ הושלם (קוד + טסטים)
- **קבצים:** `lib/auth/safe-next.ts`, `components/auth/OtpFlow.tsx`,
  `app/[locale]/account/profile/page.tsx`, `tests/auth/safe-next.test.ts` (חדש)
- **מה נעשה:** `safeNext` היה קיים ונכון-בערך אבל **ללא קוראים**; שני משטחי
  ה-auth הטמיעו בדיקה משלהם שחסמה `//` והחמיצה `/\`. דפדפנים מנרמלים `\` ל-`/`
  בעת פרסור authority, ולכן `/\evil.com` יוצא מהמקור בדיוק כמו `//evil.com`.
  שניהם עברו ל-`safeNext`, ובו נוספה דחיית תווי בקרה (CR/LF = response
  splitting) ודחיית backslash בכל מקום.
- **איך אימתתי:** 7 טסטים עוברים, כולל **כל** המטענים מטבלת האימות
  (`//evil.com`, `/\evil.com`, `/\/evil.com`, `%2F%5Cevil.com`, ו-CRLF),
  לצד סט שמוודא שנתיבים פנימיים תקינים (כולל locale, query, fragment) עוברים.

---

## H7 — Hash למזהה של Meta

- **סטטוס:** ✅ הושלם (קוד + טסטים)
- **קבצים:** `lib/analytics/meta-event-id.ts`, `components/survey/PollRegister.tsx`,
  `app/actions/otp-survey.ts`, `tests/analytics/meta-lead-event-id.test.ts` (חדש)
- **מה נעשה:** `eventID: "lead.someone@example.com"` — מייל גלוי שנשלח ל-Meta
  מהדפדפן. עכשיו `lead.<sha256(trim+lowercase)>` דרך helper משותף אחד.
  Web Crypto ולא `node:crypto`, כי הקובץ מיובא משני הצדדים.
- **באג נוסף שנמצא ותוקן:** הצד הלקוח העביר את הכתובת **כפי שהוקלדה** בעוד
  השרת העביר `trim().toLowerCase()` — כלומר כל קלט עם אות גדולה או רווח ייצר
  שני מזהים שונים ו-Meta **כבר ספרה כל ליד פעמיים**. שני הצדדים עוברים כעת
  באותה פונקציה.
- **איך אימתתי:** 5 טסטים עוברים, כולל טסט שמאשר שכל וריאנטי האותיות/הרווחים
  מתכנסים למזהה אחד, וטסט שמשווה את הנרמול לזה של `hash()` ב-`meta-capi.ts`
  כדי שהשניים לא יסטו בעתיד.

---

## CSV — נטרול נוסחאות

- **סטטוס:** ✅ הושלם (קוד + טסטים)
- **קבצים:** `lib/csv-escape.ts` (חדש), `tests/csv-escape.test.ts` (חדש),
  ארבעת נתיבי הייצוא
- **מה נעשה:** ארבעה העתקים של אותו helper, אף אחד לא ניטרל נוסחאות. כל שדה
  בייצואים האלה נכתב על ידי משתמש. גרש מוביל לערך שמתחיל ב-`= + - @ TAB CR`,
  ואז הציטוט הקיים — **בסדר הזה**, אחרת הגרש נופל מחוץ למרכאות.
- **איך אימתתי:** 7 טסטים עוברים, כולל המטען מהמסמך
  (`=cmd|' /C calc'!A0`), מטעני `HYPERLINK`/DDE, וסט שמוודא ששמות רגילים
  (עברית כלולה), מיילים ומספרים יוצאים ללא שינוי.
- **הערה:** `-` כלול, ולכן `-5` מיוצא כטקסט. זו בחירה מודעת —
  `-2+3+cmd|...` גם מתחיל ב-`-`, כך ש"דלג אם זה נראה מספר" הוא עקיפה ולא שיפור.

---

## H3 — זיהוי IP ו-rate limiting

- **סטטוס:** חלק 1 ✅ הושלם · **חלק 2 חסום — דורש החלטת תשתית**
- **קבצים:** `lib/rate-limit.ts`, `tests/rate-limit-ip.test.ts` (חדש)
- **מה נעשה (חלק 1):** `getClientIp` החזיר את הערך **השמאלי** ב-XFF. כל proxy
  **מוסיף** לכותרת, ולכן השמאלי הוא בדיוק מה שהלקוח שלח. בקשה עם
  `X-Forwarded-For: 1.2.3.4` קיבלה דלי חדש, וסיבוב הכותרת נתן ניסיונות בלתי
  מוגבלים בכל נתיב מוגבל — כולל הקולבק של Cardcom.
  עכשיו `cf-connecting-ip` → `x-real-ip` → הערך **הימני** ב-XFF.
- **איך אימתתי:** 8 טסטים עוברים, כולל שרשרת מזויפת ארוכה וטסט שמוודא
  ש-שלוש כותרות מזויפות שונות נותנות **אותו** מפתח דלי.
- **חלק 2 — לא בוצע:** אין בפרויקט שום תלות KV/Redis (`package.json` נקי,
  אין `KV_REST_*`/`UPSTASH_*`). התקנת שירות חיצוני היא בדיוק תנאי העצירה מס' 10.
  ההצעה למטה.

---

## H6 — הסכמה בשליחות אדמין

- **סטטוס:** חלק `to_address` ✅ הושלם · **שער ההסכמה חסום — עצרתי כפי שהמסמך מורה**
- **קבצים:** `app/api/admin/messages/send/route.ts`
- **מה נעשה:** `to_address` בגוף הבקשה **דרס** את הנמען, כך שמי שמגיע לנתיב
  יכול היה לשלוח תוכן שרירותי לכתובת שרירותית עם המוניטין והתבניות שלנו —
  והשליחה נרשמה ב-`sent_messages` תחת `user_id` **לא קשור**, כלומר גם שוביל
  הביקורת הצביע על האדם הלא נכון. השרת שולח כעת תמיד לכתובת שעל הקובץ, וערך
  שונה נדחה ב-400 מפורש במקום להיבלע בשקט.
- **למה שער ההסכמה לא בוצע — עצירה לפי הוראה:**
  המסמך מורה "חסום אלא אם התבנית `category='transactional'`". בדקתי:
  **ל-`message_templates` אין עמודת `category` כלל.** היא מעולם לא נוצרה
  באף מיגרציה — הסכמה (026:124) היא
  `id, key, channel, subject_he/en, body_he/en, variables, trigger_axis, is_active`.
  יישום כלשונו היה מעריך `undefined !== 'transactional'` לכל תבנית ו**חוסם כל
  שליחת אדמין**, כולל התפעוליות. זה בדיוק תנאי העצירה 9 והאזהרה בגוף המשימה.
- **שאלות פתוחות — צריך את ההחלטה שלך.** ראה "החלטות פתוחות" בסוף.

---

## H8 — הרשאות RPC

- **סטטוס:** (א),(ב),(ד) ✅ קוד הושלם · **המיגרציה טרם הורצה** · (ג) דורש החלטה
- **קבצים:** `supabase/migrations/201_rpc_permissions_hardening.sql`
- **מה נעשה:**
  - **(א)** `pact_record_honoured_week` — `SECURITY DEFINER`, מקבלת `p_pact_id`,
    מוענקת ל-`authenticated`, **ללא שום בדיקת בעלות**. כל משתמש מחובר יכול היה
    לסמן ברית של כל זוג כ"מקוימת" לפי מספר שבוע שרירותי. נוספה בדיקה:
    בעל הברית / חבר הזוג / המאמן של הזוג / אדמין.
  - **(ב)** `ensure_couple_for_user` — `REVOKE EXECUTE ... FROM authenticated`.
    היא `SECURITY DEFINER` על `p_user_id` שרירותי, כלומר כל משתמש מחובר יכול
    היה ליצור זוג ו-pair code בשם מישהו אחר. שני הקוראים האמיתיים הם service-role.
  - **(ד)** trigger חדש שחוסם `is_default_coach`, `is_test_user`,
    `expert_specialties` למי שאינו אדמין — משתמש יכול לעדכן את שורת הפרופיל
    שלו תחת `profiles_update_own`, כך שהשדות האלה היו self-settable.
- **דפוס ה-service-role:** כל בדיקה מתירה `auth.uid() IS NULL` — בדיוק כמו
  `profiles_enforce_role_change` (002:44). בלי הזרוע הזו הייתי שובר את הקרונים
  שקוראים לפונקציות האלה בלגיטימיות.
- **איך אימתתי:** בדיקת מבנה — איזון סוגריים תקין, 4 בלוקי `$$` (זוגי).
  `lint`/`tsc`/`build`/`test` ירוקים (שינוי SQL בלבד).
  **לא הרצתי** — אין staging ואין Postgres מקומי.
- **(ג) לא בוצע** — משנה מסלול חי. ההצעה למטה.

---

## F10 · F11 — סגירת משימות משלב 1

- **F10 — `DROP FUNCTION public.is_expert()`** (במיגרציה 201).
  הוכחת אפס מפנים: `grep` על כל המיגרציות מחזיר רק את 056 (ששלוש המדיניות שלה
  הוחלפו במיגרציה 200) ואת ההערות ב-200 עצמה; `grep` על כל הקוד — אפס.
  **בכוונה בלי `CASCADE`** — אם בכל זאת נותרה תלות, Postgres יסרב לבצע את
  ההצהרה במקום למחוק מדיניות בשקט. שאילתת האימות נמצאת בקובץ המיגרציה.
- **F11 — אינדקס ייחודי חלקי** על `checkout_sessions.low_profile_code`
  (במיגרציה 201, **אחרון בקובץ בכוונה**: אם יש כפילויות הוא ייכשל, וכל השאר
  כבר הוחל). שאילתת בדיקת הכפילויות בקובץ.

---

# החלטות פתוחות — שלוש, ואני עוצר עליהן

## 1. H6 — שער ההסכמה בלי עמודת `category`

`message_templates` חסרת `category`. שלוש דרכים:

- **(א) מיגרציה 202 שמוסיפה `category`** עם ברירת מחדל `'transactional'`,
  ואז לסווג ידנית את התבניות השיווקיות. בטוח (ברירת המחדל לא חוסמת כלום),
  אבל שווה בדיוק כמו איכות הסיווג הידני.
- **(ב) לחסום לפי ערוץ במקום לפי קטגוריה** — כל שליחת `whatsapp` דורשת
  `whatsapp_opt_in`, כל `email` דורשת `marketing_consent`, ופטור מפורש
  לרשימת `template.key` תפעוליות. לא דורש מיגרציה; דורש ממך את רשימת המפתחות.
- **(ג) לדחות את H6 לשלב 3** ולחבר אותו ל-P5 (הפרדת ההסכמות), שנוגע באותו אזור.

**אני ממליץ על (א).** ברירת מחדל `'transactional'` פירושה שהפריסה לא חוסמת
כלום ביום הראשון, והחסימה נכנסת לתוקף בקצב שבו אתה מסווג. אבל זו חשיפה לסעיף
30א (1,000 ₪ להודעה) ולכן ההחלטה שלך.

## 2. H8(ג) — תפוגה ומונה ניסיונות ל-`join_couple_by_pair_code`

הצעה לאישור לפני שאני כותב מיגרציה:

- **מרחב:** 6 תווים מתוך 32 סימנים = ~1.07 מיליארד. בלי הגבלה, ניחוש
  מבוזר הוא ריאלי; עם 5 ניסיונות ל-15 דקות למשתמש הוא לא.
- **תפוגה:** הקוד תקף **14 יום** מיצירת הזוג, ומתחדש בכל בקשה מפורשת של
  "צור קוד חדש". **זוגות קיימים:** לא לפסול רטרואקטיבית — `expires_at` מחושב
  כ-`GREATEST(created_at + 14d, now() + 14d)`, כלומר כל קוד קיים מקבל 14 יום
  מרגע הרצת המיגרציה.
- **מונה ניסיונות:** 5 כישלונות ל-15 דקות לכל `auth.uid()` (לא לכל קוד —
  אחרת תוקף מסובב קודים). מעבר לכך → שגיאה ידידותית, בלי נעילת חשבון.
- **טבלה:** `couple_join_attempts(user_id, attempted_at, succeeded)`, ניקוי
  בסוויפ הלילי.
- **מה לא משתנה:** צירוף מוצלח, וקוד שהוזן נכון בתוך החלון.

**שאלה אחת פתוחה אליך: 14 יום מתאים, או שזוגות מצטרפים לאט יותר בפועל?**

## 3. H3 חלק 2 — מעבר ה-rate limiting ל-KV

- **המצב:** הדליים ב-`Map` בזיכרון. מתאפסים בכל cold start ומוכפלים במספר
  ה-instances, כך שהמגבלה בפועל היא `limit × instances`.
- **אין בפרויקט שום KV/Redis.** זה שירות חדש = תנאי עצירה 10.
- **הצעה:** Upstash Redis דרך Vercel Marketplace, tier חינם
  (10k פקודות/יום) — הנתיבים המוגבלים מייצרים הרבה פחות. שתי בקשות לכל
  בדיקה. **להתחיל רק בנתיבי החיוב + auth**, לא בכל מה שמוגבל.
- **עלות:** 0 ₪ בטווח החינם; ~$10/חודש אם נחרוג.
- **בלי זה:** תיקון ה-IP (חלק 1) כבר סגר את העקיפה המוחלטת. מה שנשאר הוא
  מגבלה **רופפת**, לא מגבלה **עקיפה**. זה הבדל משמעותי — לכן חלק 2 לא דחוף.

---

# תיקונים ותשובות — 6.8.2026 (סבב ביקורת שני)

## (א) הטסט שנכשל ב-baseline ועובר עכשיו — התשובה המדויקת

**הטסט:** `tests/api/brevo-unsubscribe-webhook.test.ts`
→ `non-unsubscribe event > returns 200 + ignored marker without flipping consent`

**למה הוא נכשל, לפי ההיסטוריה ולא לפי השערה:**

```
$ git log --oneline -S "non_actionable_event" -- app/api/brevo/unsubscribe-webhook/route.ts
acf04d5 security(H1): ...            ← ההסרה שלי
165351d feat(email): hard-bounce suppression guard (mailing diagnostics step 3.2)

$ git show 165351d -- app/api/brevo/unsubscribe-webhook/route.ts
-    return NextResponse.json({ ok: true, ignored: "non_unsubscribe_event" });
+    return NextResponse.json({ ok: true, ignored: "non_actionable_event" });

$ git show --stat 165351d | grep test
(אין — קובץ הטסט לא נגע באותו commit)
```

ב-**6.7.2026**, commit `165351d` (הוספת תמיכה ב-hard bounce) שינה את שם הסמן
מ-`non_unsubscribe_event` ל-`non_actionable_event` — **שינוי נכון**, כי הענף
הזה כיסה מאותו רגע גם hard bounces ו"non-unsubscribe" הפך לא מדויק.
קובץ הטסט לא עודכן באותו commit. מאותו יום הטסט טען על מחרוזת שהקוד לא ייצר,
ונכשל ברציפות **חודש** לפני שהענף הזה נוצר.

**למה הוא עובר עכשיו:** H1 הסיר את שדה `ignored` לגמרי (גוף אחיד `{ ok: true }`),
ואני שכתבתי את הטענה ל-`expect(await res.json()).toEqual({ ok: true })`.

**הנקודה שחשובה לביקורת:** הטענה החדשה **מחמירה** יותר מהישנה — היא בודקת את
הגוף **כולו** ב-`toEqual` במקום שדה בודד. הטסט לא "רוכך כדי לעבור"; הוא היה
טסט מת שבדק מחרוזת שהוסרה מהקוד לפני חודש, וההתנהגות שהוא אמור היה להגן עליה
(אין שינוי הסכמה באירוע לא-רלוונטי) עדיין נבדקת, בשורה שאחריה.

---

## (ב) הכפילות ב-Meta — ממצא עסקי, לא רק באג

**מה קרה.** מזהה האירוע של Lead נגזר משני צדדים בנרמול שונה:

| צד | קוד | מה נשלח עבור `Itzik@Uxellent.com ` |
|---|---|---|
| דפדפן (Pixel) | `PollRegister.tsx` — `metaEventId.lead(email)` **כפי שהוקלד** | `lead.Itzik@Uxellent.com ` |
| שרת (CAPI) | `otp-survey.ts` — `metaEventId.lead(email.trim().toLowerCase())` | `lead.itzik@uxellent.com` |

מזהים שונים → **Meta לא ביצעה dedup** → כל ליד כזה נספר **פעמיים**.

**ההשלכה העסקית:**
- מספרי הלידים המדווחים ב-Meta **מנופחים**, בשיעור שתלוי בכמה משתמשים הקלידו
  אות גדולה או רווח — לא ניתן לשחזר רטרואקטיבית מהצד שלנו.
- **עלות-לליד (CPL) שדווחה נמוכה מדי** באותו יחס. כל החלטת תקציב שהתבססה
  עליה התבססה על נתון שגוי.
- **אלגוריתם האופטימיזציה של Meta עבר אימון על אירועים מנופחים** — הוא מיטב
  לכיוון קהלים שייצרו כפילויות, לא בהכרח לקוחות.

**⚠️ ציפייה לאחר הפריסה — לא תקלה בקמפיין.**
מרגע שהתיקון עולה, מספר הלידים המדווח **יירד**. הירידה היא **תיקון מדידה**,
לא ירידה בביצועים. אין להסיק ממנה שהקמפיין נשבר, ואין להגיב עליה בשינוי תקציב
או יצירתיות.

- **התיקון:** commit `f3cb7f3` — `security(H7): hash the Meta Lead event id`.
- **תאריך פריסה לפרודקשן:** ______ ← **למלא ביום המיזוג.**
- **המלצה:** לסמן annotation בתאריך הזה ב-Meta Ads Manager וב-GA4, ולהשוות
  CPL רק בין חלונות שנמצאים כולם לפני או כולם אחרי התאריך.
- **תקופת ההשפעה:** מאז שנוצר מסלול ה-Lead של הסקר ועד תאריך הפריסה.

---

## (ג) ארבע העבודות — תיקון שיטת המדידה

**צדקת, והשאילתה הראשונה שלי הייתה פסולה.** `journey_couple_pacts.updated_at`
מתעדכן גם מ-`app/actions/journey-pact.ts` (פעולת משתמש), כך שספירה לא-אפסית
לא מוכיחה דבר על ה-cron. זו בדיוק מלכודת המדידה של C3 מחדש — מספר סביר
שאינו מודד את מה שחשבתי.

**בדקתי מי כותב לכל טבלה, ויש ראיה ברמת עמודה שמשתמש אינו יכול לזייף:**

| Job | ראיה קבילה | למה |
|---|---|---|
| `d1-reminders` | כל שורה ב-`journey_reminder_log` | **הכותב היחיד** בכל הריפו הוא `d1-reminders/route.ts` |
| `weekly-recap` | כל שורה ב-`journey_weekly_recaps` | **הכותב היחיד** הוא `weekly-recap/route.ts` |
| `pact-honoured` | `journey_couple_pacts.honoured_through_week > 0` | העמודה נכתבת **רק** ע"י ה-RPC `pact_record_honoured_week`, שנקראת רק מה-cron. `updated_at` — לא קביל. |
| `drift-sweep` | שורות ב-`journey_drift_alerts` עם `coach_checked_in_at IS NULL` | פעולת האדמין (`drift-check-in.ts`) **תמיד** מציבה `coach_checked_in_at`; ה-cron לעולם לא |

```sql
SELECT 'd1-reminders'  AS job, count(*) AS rows, max(created_at) AS newest
  FROM journey_reminder_log
UNION ALL
SELECT 'weekly-recap', count(*), max(created_at)
  FROM journey_weekly_recaps
UNION ALL
SELECT 'pact-honoured', count(*), max(updated_at)
  FROM journey_couple_pacts WHERE coalesce(honoured_through_week, 0) > 0
UNION ALL
SELECT 'drift-sweep', count(*), max(updated_at)
  FROM journey_drift_alerts WHERE coach_checked_in_at IS NULL;
```

**אבל הראיה הראשית נשארת Vercel.** בדקתי — אף אחת מארבע העבודות לא כותבת
שורת לוג ייחודית בהרצה מוצלחת (`pact-honoured` ו-`weekly-recap` לא כותבות
לוג בכלל; לשתיים האחרות יש רק לוגי שגיאה). לכן:
**Vercel → Project → Cron Jobs → last run + status** הוא המקור הסמכותי,
והשאילתה למעלה היא אישוש שני. אם השניים סותרים — Vercel קובע.

---

## H6 — שלב 1: רשימת התבניות לסיווג ידני

לפי החלטתך: **אין** ברירת מחדל `'transactional'`. הרץ והחזר לי את הפלט; אני
לא כותב את המיגרציה לפני שהסיווג חוזר.

```sql
SELECT
  t.key,
  t.channel,
  coalesce(t.subject_he, t.subject_en, '(no subject)') AS subject,
  t.is_active,
  count(m.id)      AS times_sent,
  max(m.created_at) AS last_sent_at
FROM public.message_templates t
LEFT JOIN public.sent_messages m ON m.template_id = t.id
GROUP BY t.id, t.key, t.channel, t.subject_he, t.subject_en, t.is_active
ORDER BY last_sent_at DESC NULLS LAST, t.key;
```

**מה שאני צריך בחזרה:** רשימת ה-`key` שהם **`transactional`** בלבד.
כל השאר יסווגו `marketing` — כולל תבניות שלא נשלחו מעולם וכולל כל תבנית
שתיווצר בעתיד.

**המיגרציה שאכתוב אחר כך (202), לפי מה שקבעת:**
```sql
ALTER TABLE public.message_templates
  ADD COLUMN category text NOT NULL DEFAULT 'marketing';
ALTER TABLE public.message_templates
  ADD CONSTRAINT message_templates_category_check
  CHECK (category IN ('transactional', 'marketing'));
UPDATE public.message_templates
   SET category = 'transactional'
 WHERE key IN ( … הרשימה שתחזיר, מפורשת בשמות … );
```
וב-gate: `category !== 'transactional'` → נדרשת הסכמה. `NULL` בלתי אפשרי
(`NOT NULL`), וערך לא מוכר נחסם ע"י ה-`CHECK` — כלומר **נכשל-סגור** בשתי
שכבות, ותבנית חדשה היא שיווקית עד שמישהו יסווג אותה אחרת.

---

## H8(ג) — שלושת הדברים שקובעים אם התיקון עובד

בדקתי את שלושתם מול הקוד. **שניים מהם חמורים יותר מהתפוגה.**

### 1. מונה הניסיונות — לפי קורא, לא לפי קוד ✅
צדקת, וכך תוכנן מלכתחילה: `couple_join_attempts(user_id, attempted_at, succeeded)`,
5 כישלונות ל-15 דקות **לכל `auth.uid()`**. מונה לכל קוד לא היה עוצר enumeration —
תוקף מנחש קודים אקראיים, כל ניסיון נופל על קוד אחר, ואף מונה לא מתקרב לסף.
מכיוון ש-`join_couple_by_pair_code` דורשת `auth.uid()` (זורקת `not authenticated`),
יש תמיד קורא מזוהה ואין צורך ב-fallback ל-IP.

### 2. האם הקוד נפסל אחרי שימוש — **לא. וזה גרוע יותר מהיעדר תפוגה.** ❌

`join_couple_by_pair_code` (029:182) מוסיפה שורה ל-`couple_members` ומחזירה.
**`couples.pair_code` לא מתאפס, לא מסובב, ולא מסומן כמנוצל — לעולם.**

יש חסם עקיף בלבד: `couple is full` כשיש 2 חברים. אבל הוא לא תחליף לפסילה:

- **הודעות השגיאה עצמן הן אורקל.** `pair_code not found` מול `couple is full`
  מבדילות בין "קוד לא קיים" ל"קוד אמיתי של זוג מלא". עם ניסיונות בלתי מוגבלים,
  זה ממפה את מרחב הזוגות הקיימים — גם בלי אף הצטרפות מוצלחת.
- **אם חבר עוזב**, הזוג חוזר ל-1 חבר והקוד שנאסף פעם הופך שמיש שוב.
- **הקוד מוצג ב-UI ומשותף בוואטסאפ/צילומי מסך** ואינו פג לעולם.

**מה שאני מציע להוסיף ל-H8(ג):** לפסול את הקוד ברגע שהזוג מגיע ל-2 חברים
(`pair_code = NULL` או `pair_code_used_at`), **ולאחד את הודעות השגיאה** —
`pair_code not found` אחת לכל מקרה כושל, בלי להבדיל בין "לא קיים" ל"מלא".
זה סוגר את האורקל, וזה בעיניי התיקון החשוב מבין השלושה.

### 3. דרך לייצר קוד חדש — **לא קיימת.** ❌

`grep` על כל המיגרציות והקוד: **אין שום `UPDATE` על `couples.pair_code`.**
הוא נקבע פעם אחת ב-`ensure_couple_for_user`/`generate_pair_code` ומוצג לקריאה
בלבד ב-UI.

**המסקנה מעשית:** תפוגה בלי יצירה מחדש = כל זוג שלא התחבר תוך 14 יום נתקע
לצמיתות ופונה לתמיכה. וגם הפסילה-אחרי-שימוש (סעיף 2) דורשת את זה, אחרת זוג
שנפרד לא יוכל להתחבר מחדש.
**לכן: `rotate_pair_code(couple_id)` — RPC לבעל הזוג בלבד, שמייצר קוד חדש
ומאפס את מונה הניסיונות — חייב להישלח באותה מיגרציה, לא אחריה.**

**סיכום ההיקף המעודכן של H8(ג), לאישורך לפני שאני כותב את 203:**
1. תפוגה 14 יום (`GREATEST(created_at + 14d, now() + 14d)` — אף קוד קיים לא נפסל רטרואקטיבית) ✅ אושר
2. מונה 5/15 דקות לפי `auth.uid()` ✅ אושר
3. **פסילת הקוד בהגעה ל-2 חברים** ← חדש, נובע משאלתך
4. **איחוד הודעות השגיאה** לסגירת האורקל ← חדש, נובע משאלתך
5. **`rotate_pair_code` RPC** ← חדש, תנאי הכרחי ל-1 ול-3

---

## טריאז' ה-baseline — 10 הקבצים הכושלים

לא תוקן, רק מופה. **אף אחד אינו ממצא אבטחה, ואף אחד לא נשבר בשלב 1 או 2.**

### חמשת כשלי ה-assertion

| טסט | מתי נשבר | למה, בשורה |
|---|---|---|
| `email/brevo-segments-sync > addProductToContact > merges…` | עם שדרוג Node ל-22 (הריפו רץ v22.21.1) — **לא שינוי מוצר** | ה-mock בונה `new Response("", { status: 204 })` (שורות 122,125); Node 22 אוסר גוף ב-204 וזורק, ה-fetch המדומה נכשל, `getContactAttributes` מחזיר null, והערך הקיים `adults` אובד מהמיזוג. **הוכחה:** `node -e "new Response('x',{status:204})"` → `REJECTED: Invalid response status code 204`. תיקון: `new Response(null, …)`. |
| `journey/questionnaire > has exactly 32 questions` | **8.5.2026**, `e78fbf4` "update corrctio on flow heb" | הבנק ירד 32 → 29. הטסט נכתב 5.5.2026 (`219d710`) ומעולם לא עודכן. |
| `journey/questionnaire > auth gate after q27 / idx 30` | אותו commit | נגזר מאותו שינוי גודל בנק (29 פריטים, לא 30). |
| `journey/questionnaire > locked domain distribution 7-3-3-5-7` | אותו commit | ההתפלגות השתנתה יחד עם הבנק. |
| `journey/questionnaire > priority ranking is last` | אותו commit | הסדר השתנה יחד עם הבנק. |

**הבנק זז חמש פעמים מאז:** 32 (6.5) → 29 (8.5) → 26 (21.5) → 29/30 (1.6) →
28 (2.6) → 29 (24.6, נוכחי). ארבעת הטסטים נועלים מפרט שהמוצר נטש **לפני
שלושה חודשים**. הם נקראים "locked domain distribution" ו-"post love-language
removal" — כלומר נכתבו במפורש כשומר. **השומר אדום שלושה חודשים ולכן אינו שומר
על דבר.** ההכרעה הנדרשת אינה טכנית: או שהמפרט עדיין תקף והמוצר סטה, או
שהמפרט השתנה והטסט צריך להתעדכן. **זו שאלה למוצר, לא לי.**

### חמשת כשלי האיסוף (הקובץ לא נטען, `0 test`)

| קבצים | שורש | הסבר |
|---|---|---|
| `journey/journey-questions-cms`, `journey/phase-flow`, `journey/render-from-db-parity`, `journey/scoring-source-parity`, `journey/short-coverage` | `TypeError: cache is not a function` | `lib/journey/questions-db.ts:244` קורא ל-`cache()` של React. תחת סביבת `node` של vitest הייצוא הזה אינו פונקציה. בעיית סביבת בדיקה, לא באג מוצר. |
| `cms/sanitize`, `journey/hero-fallback` | `This module cannot be imported from a Client Component module` | שרשרת ייבוא מגיעה למודול עם `import "server-only"`. אותה משפחה — vitest טוען קוד שרת מחוץ להקשר שלו. |
| `auth/signup-with-consent` | `Cannot access 'tagAsRegisteredMock' before initialization` | `vi.mock` מורם לראש הקובץ, וה-factory מפנה למשתנה top-level שטרם אותחל. תיקון: `vi.hoisted()` או factory בלי משתנים חיצוניים. |

**הערה שנוגעת אליי:** כשל `server-only` הוא הסיבה שבשלב 1 וב-2 הוצאתי לוגיקה
לקבצים נפרדים כדי שתהיה בת-בדיקה — `lib/observability/redact.ts` (כי `log.ts`
מייבא `server-only`) ו-`lib/auth/cron-auth.ts`. זה עקף את המגבלה במקום לתקן
אותה.

---

# H8(ג) — הועבר ל-PR נפרד

> **מיגרציה 203 אינה בענף הזה.** היא הועברה ל-`security/pair-code-hardening`
> (PR ב') יחד עם הטסטים שלה ועם השינוי הנלווה ב-`between-us-couple.ts`.
> הסיבה: H1, H2 ו-H5 מוכנים ומאומתים, ואין סיבה שיחכו להכרעה על מודל
> הייחודיות ולתשתית טסטים. הניתוח שלמטה נשאר כאן לצורך רצף התיעוד; הקוד
> וההרצה נמצאים ב-PR ב'.

# H8(ג) — חמשת התנאים לחתימה

## 1. ערובת הייחודיות — התשובה, והיא גרועה ממה שרמזתי

**כן, יש אינדקס ייחודי — אבל הוא חלקי:**
```sql
-- 029:40
CREATE UNIQUE INDEX IF NOT EXISTS couples_pair_code_key
  ON public.couples (pair_code)
  WHERE is_active = true;          -- ← החלקיות
```
**והמחולל בדק את אותו תנאי בדיוק:**
```sql
SELECT 1 FROM public.couples WHERE pair_code = code AND is_active = true
```

כלומר: **הייחודיות נאכפה רק בין זוגות פעילים.** קוד של זוג שהושבת כבר היה
ניתן להנפקה מחדש — עוד לפני שנגעתי במשהו.

**וסיבוב הופך את זה לחמור בהרבה.** כל סיבוב **דורס** את `couples.pair_code`,
כך שהערך הישן נעלם מהטבלה לגמרי והופך פנוי להנפקה מחדש **לזוג אחר**.
מי שצילם קוד לפני שנה היה יכול להצטרף לזוג של זרים. צדקת — זה חמור מכל
מה שתיקנו ב-H8.

**ובנוסף:** המחולל היה גם **racy** — `SELECT EXISTS` ואז שימוש, בלי נעילה.
שני מחוללים במקביל יכלו לצאת עם אותו קוד.

## 2. שמירת קודים שנפסלו — בחרתי בדרך הראשונה, בגרסה חזקה יותר

לא "להרחיב את האינדקס" ולא "שהמחולל ישלול" — אלא **טבלת הזמנה שה-PRIMARY KEY
שלה הוא האוכף**, והמחולל **תופס** את הקוד ב-`INSERT`:

```sql
CREATE TABLE public.pair_codes_issued (code text PRIMARY KEY, issued_at timestamptz …);

-- בתוך generate_pair_code, בלולאה:
INSERT INTO public.pair_codes_issued (code) VALUES (code)
ON CONFLICT (code) DO NOTHING;
GET DIAGNOSTICS claimed = ROW_COUNT;
EXIT WHEN claimed = 1;
```

למה זו הדרך העדיפה על השתיים שהצעת:
- **מכסה את כל ההיסטוריה**, לא רק שורות חיות — כולל קודים שסובבו והוחלפו
  ולכן כבר לא קיימים בשום מקום אחר.
- **אטומית** — סוגרת גם את מרוץ ההנפקה, שהיה קיים מ-029.
- **לא נוגעת באינדקס הקיים**, שנשאר כשכבה שנייה לשורות חיות. אין סיכון
  שמיגרציה תיפול על נתונים היסטוריים שכבר מפרים ייחודיות מלאה.
- backfill מזין את כל הקודים הקיימים, כך שאף אחד מהם לא יונפק שוב.

## 3. הוכחה שהמונה צובר — **חלקית. לא יכולתי להריץ.**

**מה כן הובטח בקוד:**
- ה-`INSERT` ל-`couple_join_attempts` הוא **המשפט הראשון** אחרי בדיקת
  ההזדהות, לפני כל ולידציה.
- **אפס `RAISE` אחריו.** אימות אוטומטי:
  ```
  RAISE after the attempt INSERT: 0 (must be 0)
  ```
  כולל המקרה "כבר בזוג", שהפך ל-`RETURN NULL` בדיוק כדי לא לשבור את הכלל.
  בקוד יושבת הערת INVARIANT שאוסרת להוסיף `RAISE` מתחת לנקודה הזו.

**מה לא הצלחתי:** אין לי מסד נתונים. `psql`, `initdb`, `postgres`, Docker,
Supabase CLI, `pglite`, `pg-mem` — **אף אחד מהם אינו מותקן**, ובדקתי את כולם.
לכן **לא הרצתי את הטסט ואין לי פלט אמיתי להציג.** לפי הכלל שלך, זה
"דורש אימות ידני" ולא "הושלם".

**מה שכן הכנתי:** `supabase/migrations/203_pair_code_hardening.verify.sql` —
סקריפט שמריץ שישה ניסיונות עם קוד לא קיים ואז סופר את השורות, כולו בתוך
`BEGIN … ROLLBACK` כך שאינו משאיר שובל. הפלט שאתה אמור לראות:
`attempts_recorded = 6, failures = 6`. **אם זה מחזיר 0 — `RAISE` חזר פנימה
והמגבלה מתה.**

**אם תרצה את זה כטסט אוטומטי ב-CI** אצטרך `@electric-sql/pglite` כ-devDependency
(Postgres בתהליך, בלי Docker). זו תלות חדשה = תנאי עצירה 10, ולכן **לא התקנתי
ואני שואל.**

## 4. האלפבית — 32 סימנים, ואין בו תווים מתבלבלים

```
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```
- אורך: **32** ✓
- אותיות חסרות: **I, O**
- ספרות חסרות: **0, 1**

כלומר אין `0/O`, אין `1/I/l`. משתמש שקורא קוד נכון לא יכול להקליד אותו לא
נכון בגלל דמיון תווים, ולכן **5 ניסיונות ל-15 דקות הוגן** — הוא מכסה שגיאות
הקלדה אמיתיות בלי לתת מרחב לניחוש. (הקלט גם עובר `upper()` בשרת ו-
`toUpperCase()` בלקוח, כך שאותיות קטנות אינן נחשבות שגיאה.)

## 5. הצעת נוסח ל-`between-us-couple.ts` — לא בוצע

היום הקוד ממפה ארבע הודעות לפי מחרוזות שגיאה. אחרי 203 כל הכשלים חוזרים
כ-`NULL`, ולכן המיפוי הזה מת ויש מחיר מוצרי אמיתי.

**ההצעה — שתי הודעות, לא אחת, בלי להחזיר מידע:**

```
א. המשתמש כבר בזוג (נבדק בשרת לפני קריאת ה-RPC, על השורה של המשתמש עצמו):
   "את/ה כבר מחובר/ת לבן/בת זוג. כדי להתחבר לזוג אחר יש קודם לנתק את החיבור הקיים."

ב. כל השאר:
   "הקוד לא תקף. ייתכן שהוא שגוי, שכבר נעשה בו שימוש, או שפג תוקפו.
    בקש/י מבן/בת הזוג קוד חדש מתוך המסך שלהם."
```

**למה זה לא מדליף:** מקרה (א) מתבסס על חברות המשתמש **בעצמו** ב-`couple_members` —
מידע שכבר שלו, נקרא בשרת לפני ה-RPC, ואינו אומר דבר על קודים של אחרים.
כל מה שנוגע **לקוד** מקבל הודעה אחת בלבד.

**המשתמש שנחסם — זו הנקודה שהעלית, וזו החולשה בהצעה.** הוא מקבל את הודעה (ב)
בלי לדעת שהוא חסום. הצעתי, בסדר עדיפויות:

1. **מסלול המשך במקום הסבר.** להוסיף להודעה (ב) קישור קבוע: "לא מצליח? כתוב/י
   לנו" → תמיכה. זה נותן דרך קדימה בלי להחזיר שום מידע, ועובד זהה למי שטעה
   בהקלדה ולמי שנחסם.
2. **השהיה בצד הלקוח, לא בשרת.** אחרי 3 כשלים **באותו סשן דפדפן**, ה-UI
   משהה את הכפתור ל-60 שניות ומציג "נסה שוב בעוד דקה". זה מיידע את המשתמש
   הלגיטימי בלי שהשרת יאמר דבר — תוקף פשוט יתעלם מה-UI, ולא מעניין אותנו,
   כי המגבלה האמיתית נאכפת בשרת ממילא.
3. **מה לא לעשות:** להחזיר 429 או "חסום עד HH:MM". זה מאשר לתוקף שהניחושים
   הגיעו לנקודת אמת, וזה בדיוק האורקל שסגרנו.

**צריך את אישורך על הנוסח לפני שאני נוגע בקובץ.**

## מספור — אין תלות בין 202 ל-203

בדקתי: 203 יוצרת `pair_codes_issued`, `couple_join_attempts`,
`couple_pair_code_rotations`, ומשנה את `couples`, `generate_pair_code`,
`join_couple_by_pair_code`. **202 (H6) נוגעת רק ב-`message_templates`** — אין
שום אובייקט משותף, ואפשר להריץ אותן בכל סדר.

---

# ‏#52 — פריסה והרצת SQL הן שני צעדים נפרדים

**מאושר במפורש: מיזוג ופריסה של #52 אינם מריצים את 201, והקוד ב-#52 אינו
תלוי ב-201 כדי לעבוד.** אין מיגרציות אוטומטיות בפרויקט — אין כלי, אין CI
שמריץ SQL, ואין רישום (זו בדיוק F21). כל הרצה היא ידנית בעורך.

בדקתי את שלושת האובייקטים היחידים שנוגעים בקבצים שהשתנו ב-#52:

| אובייקט | הקובץ | למה זה עובד בשני הכיוונים |
|---|---|---|
| `pact_record_honoured_week` | `journey/pact-honoured/route.ts` (השתנה ל-H2 + לוגים) | נקרא דרך `createServiceRoleClient()` (שורה 47). בלי 201 — אין בדיקת בעלות בכלל. עם 201 — `auth.uid()` הוא NULL ל-service role, וזרוע ה-`IS NULL` מתירה. **זהה בשני המצבים.** |
| `ensure_couple_for_user` | `billing/cardcom/indicator/route.ts` (השתנה ל-H5) | נקרא דרך `createAdminClient()` (שורה 104). 201 מבצע `REVOKE` מ-`authenticated` **בלבד** — service_role לא נוגע. |
| `low_profile_code` | אותו קובץ | הקוד עושה `.eq("low_profile_code", …)`. אינדקס ייחודי הוא **הגנה**, לא תלות — השאילתה זהה עם או בלעדיו. |

`is_expert`, `is_default_coach`, `expert_specialties` — **אפס אזכורים** בכל
הקבצים שהשתנו.

**המסקנה:** אפשר למזג ולפרוס עכשיו, ולהריץ את 201 בנפרד ובזמנך.
התלות היחידה שכן קיימת ב-#52 היא `BREVO_WEBHOOK_SECRET`, ש**חייב** להיות
מוגדר לפני הפריסה — לא בגלל 201, אלא כי H1 נכשל-סגור.

## אם האינדקס הייחודי נכשל — השאילתה, מוכנה מראש

צדקת שזו לא הצהרה שמדלגים עליה. שתי רשומות תשלום עם אותו `low_profile_code`
אומרות שהקישור שתיקנו ב-C3 **עמום בדיוק במקום שבו הוא אמור להיות חד** —
`maybeSingle()` יחזיר שגיאה, וה-fallback ל-`ReturnValue` יכריע איזה סשן נבחר.

```sql
-- כל קבוצת סשנים שחולקת low_profile_code, עם כל מה שצריך כדי להבין מיד
-- במה מדובר: מי, כמה, מתי, באיזה סטטוס, והאם נרשם אירוע חיוב תואם.
SELECT cs.low_profile_code,
       count(*) OVER (PARTITION BY cs.low_profile_code) AS sessions_in_group,
       cs.id,
       cs.user_id,
       cs.email,
       cs.amount,
       cs.currency,
       cs.product,
       cs.plan,
       cs.status,
       cs.is_trial,
       cs.deal_number,
       cs.created_at,
       cs.updated_at,
       EXISTS (
         SELECT 1 FROM public.billing_events be
          WHERE be.idempotency_key = 'lp:' || cs.low_profile_code
       ) AS has_billing_event
  FROM public.checkout_sessions cs
 WHERE cs.low_profile_code IN (
         SELECT low_profile_code
           FROM public.checkout_sessions
          WHERE low_profile_code IS NOT NULL
          GROUP BY low_profile_code
         HAVING count(*) > 1
       )
 ORDER BY cs.low_profile_code, cs.created_at;
```

**איך לקרוא את התוצאה:**

| מה רואים | מה זה אומר |
|---|---|
| כל השורות בקבוצה `status <> 'paid'` | סשנים נטושים שחלקו קוד. לא נגע בכסף. הכי שפיר. |
| שורה אחת `paid` והשאר לא | המצב הצפוי — הקוד שויך לסשן אחד שהצליח. עדיין צריך לנקות לפני האינדקס. |
| **יותר משורה אחת `paid` באותה קבוצה** | **עצור.** שני תשלומים תחת אותו קוד — לבדוק מול Cardcom לפי `deal_number` מה באמת חויב. |
| `amount` שונה בין שורות באותה קבוצה | **עצור.** זה בדיוק תרחיש C3: קוד אחד, שני מחירים. |
| `has_billing_event = false` על שורת `paid` | סשן שסומן שולם בלי אירוע חיוב — שאילתת החקירה של C3, שכבר חזרה ריקה. |

**אל תמחק ואל תסובב כלום לפני שתחזיר לי את הפלט.**

---

# הדפוס: קוד שלא הורץ הוא לא-מאומת

**זה הכלל, לא תחושה.** שלושה קבצים בשלב הזה נכתבו, נקראו בביקורת, אושרו —
**ומעולם לא היו עובדים.** אף אחד מהם לא נתפס בקריאה, על ידי אף אחד משנינו:

| מה | הכשל | מה היה קורה בפועל |
|---|---|---|
| `generate_pair_code` (203) | המשתנה `code` התנגש בעמודה `code` | `column reference "code" is ambiguous` — **המחולל לא היה רץ בכלל**, כלומר יצירת זוג הייתה נשברת בכל רכישה |
| `203…verify.sql` | לא הגדיר `request.jwt.claims` | `auth.uid()` הוא NULL בעורך → `not authenticated`. הקובץ שנועד לאמת את המגבלה **לא היה יכול לרוץ** |
| `203…postrun.sql` | הכיל `\gset`, פקודת psql | נכשל בעורך של Supabase. וגם: בדיקה 4 סובבה זוג אמיתי בלי טרנזקציה |

**מה שמשותף לשלושתם:** כולם *נראים* נכונים. הביקורת בדקה **כוונה**, והכשל היה
ב**ביצוע** — התנגשות שמות, הקשר הרצה חסר, תחביר של כלי אחר. אלה שגיאות
שקריאה לא תופסת כי הן לא נראות כשגיאות לוגיות.

**המסקנה המחייבת:** *קוד שלא הורץ הוא לא-מאומת, בלי קשר לכמה עיניים עברו
עליו.* מספר הסבבים לא משנה את זה. זה ההצדקה ל-pglite ולאינווריאנט ח'
(שמריץ את קובץ הבדיקות עצמו), והוא חל גם על SQL וגם על סקריפטים תפעוליים —
**לא רק על קוד אפליקציה.**

**הנגזרת המעשית לשלבים הבאים:** כל קובץ SQL שאני מבקש ממך להריץ ידנית עובר
קודם הרצה מול pglite. אם אי אפשר להריץ אותו שם — זו אינדיקציה שהוא תלוי
במשהו שלא הבנתי, ולא סיבה לוותר על ההרצה.


---

# ‏Brevo webhook — הגדרת הסוד ככותרת (החלטה, 9.8.2026)

**נבחרה כותרת `Authorization: Bearer` דרך ה-API, ולא פרמטר בכתובת.**
הנימוק: סוד בתוך URL נכנס ליומני גישה, ל-proxy ולכותרות `Referer` — סתירה
ישירה ל-H5, שזה עתה ניקה סודות מהלוגים. הפשרה שהצעתי כחלופה **נדחתה, ובצדק.**

המדריך המלא: `docs/brevo-webhook-secret-runbook.md`.

## אימות מקדים: הקוד הפרוס גוזר נכון את הטוקן מהכותרת

שאלה חוסמת שנשאלה לפני ההרצה — ובצדק: Brevo שולחת
`Authorization: Bearer <token>`. אם הקוד היה משווה את **הערך המלא של הכותרת**
מול הסוד, שום דבר לא היה מתאים וכל ההסרות היו נפסקות בשקט אחרי המיזוג.

מתוך `game` (הקוד החי), שורות 70-81:

```ts
const auth = req.headers.get("authorization") ?? "";
const bearer = auth.toLowerCase().startsWith("bearer ")
  ? auth.slice(7).trim()
  : null;

const url = new URL(req.url);
const queryParam = url.searchParams.get("secret");

if (bearer === expected || queryParam === expected) {
  return { ok: true };
}
return { ok: false, reason: "invalid_secret" };
```

**המסקנה: תקין.** `slice(7)` מסיר בדיוק את `"Bearer "` (7 תווים — אומת:
`"Bearer abc123".slice(7) === "abc123"`), וההשוואה היא מול **הטוקן בלבד**.
בנוסף: הקידומת מזוהה ב-`toLowerCase()` ולכן `bearer` באות קטנה גם יעבוד,
ו-`.trim()` סופג רווח נגרר.

אותה גזירה קיימת גם בקוד החדש ב-#52, שם עם `timingSafeEqual`.

## ‏ארטיפקט שחזור — הגדרת ה-webhook לפני השינוי

> **⚠️ לפני הדבקה:** Brevo מחזירה את `auth.token` **במלואו, בלי מיסוך**.
> הרץ את פקודה 1 עם `| jq 'del(.auth.token)'`, או החלף ידנית כל
> `"token": "..."` ב-`"token": "<REDACTED>"`. **אל תדביק סוד חי לגיט.**

```json
⬜ להדביק כאן את פלט פקודה 1 (בלי הטוקן), לפני הרצת פקודה 2
```

## אימות שהכותרת נשמרה

פלט פקודה 3 — בטוח להדבקה, הוא לא מכיל את הסוד:

```json
⬜ להדביק כאן את פלט פקודה 3.
   חייב להראות auth_type = "bearer", ו-token_len השווה לאורך הסוד בפועל
   (לא מספר קבוע — האורך שנרשם בשלב 0 של הרנבוק).
```

## הסיכון שנוצר מהבחירה, ומה מגן עליו

**הכותרת אינה נראית בממשק הגרפי של Brevo.** עריכה של ה-webhook דרך המסך —
אפילו שינוי תיאור — עלולה למחוק אותה בשקט, והתוצאה היא שכל בקשות ההסרה
נזרקות בלי שגיאה גלויה.

שלוש שכבות הגנה:
1. **כלל תפעולי:** את ה-webhook הזה עורכים אך ורק דרך ה-API.
2. **האזהרה כתובה בתוך `description` של ה-webhook עצמו**, כך שמי שפותח אותו
   במסך רואה אותה שם ולא רק במסמך הזה.
3. **כל דחייה כותבת שורת שגיאה** (`event=rejected scope=brevo.webhook`) שנספרת
   ב-error rate של Vercel — כך שהכשל השקט הופך לנראה בלי שמישהו יזכור לבדוק.
