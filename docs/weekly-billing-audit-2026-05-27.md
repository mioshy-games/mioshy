# Audit חיוב שבועי — 2026-05-27

מסמך מקדים לפיצ'ר שיתוף מנוי זוגי (`pair_code` → partner). מטרת ה-audit: לוודא שמנגנון החיוב השבועי יציב לפני שמרחיבים אותו לפרטנרים.

---

## ארכיטקטורה בפועל

המערכת בנויה משני זרמים נפרדים, ושניהם מסונכרנים סביב טבלת `subscriptions`:

**זרם 1 — תשלום ראשוני (initial purchase):**
המשתמש לוחץ "קנייה" → `POST /api/billing/checkout/create` (`app/api/billing/checkout/create/route.ts`) פותח LowProfile session ב-Cardcom → המשתמש מוזרם ל-Cardcom → אחרי תשלום, Cardcom שולח webhook ל-`POST /api/billing/cardcom/indicator` (`app/api/billing/cardcom/indicator/route.ts`). ה-webhook יוצר את ה-subscription, שומר את ה-token המוצפן ב-`customer_payment_methods`, ויוצר חשבונית.

**זרם 2 — חיובים חוזרים (renewals):**
**Vercel cron יומי** ב-06:00 UTC קורא ל-`POST /api/billing/renewals/run` (`app/api/billing/renewals/run/route.ts`). ה-endpoint שולף עד **20 מנויים** עם `next_billing_date <= now()` ועובר עליהם אחד-אחד, מחייב את Cardcom דרך `chargeToken()` (לא דרך Cardcom recurring API — זה חיוב יזום אצלנו, באמצעות הטוקן השמור).

מקור האמת לתזמון: `vercel.json` שורות 4-6:
```json
{ "path": "/api/billing/renewals/run", "schedule": "0 6 * * *" }
```

---

## 0.1 — קוד שמתזמן את החיוב

| מה | איפה | הערה |
|---|---|---|
| Cron definition | `vercel.json:4-6` | יומי 06:00 UTC |
| Renewal handler | `app/api/billing/renewals/run/route.ts` | 234 שורות, runs serially |
| Webhook indicator | `app/api/billing/cardcom/indicator/route.ts` | initial payment + idempotency |
| חישוב תקופה | `lib/billing.ts:77-81` (`addPlanPeriod`) | תמיד +7 ימים |
| Idempotency key | `lib/billing.ts:87-91` (`makeAsmachta`) | פורמט: `m:<userId12>:<YYYYMMDD>` |
| Grace period קבוע | `lib/billing.ts:94` | `GRACE_PERIOD_DAYS = 7` |
| Cardcom API client | `lib/cardcom.ts` (chargeToken) | called from renewals/run:104 |
| Token encryption | `lib/tokenCrypto.ts` (decrypt/encrypt) | AES-256-GCM |

**איפה נשמר `next_billing_date`:**
- בטבלה `subscriptions` (טור `next_billing_date timestamptz`, הוגדר ב-`supabase/migrations/016_cardcom_billing.sql:94`)
- **כותב ראשוני:** indicator route ביצירת מנוי (קובע ל-`now + 7d`)
- **כותב בחידוש מוצלח:** `renewals/run:143` (`next_billing_date = periodEnd`, שזה `current_period_end + 7d`)
- **לא מתעדכן בכישלון** — לכן ה-cron יבחר את המנוי שוב ביום הבא
- **קורא:** `renewals/run:40` (`lte('next_billing_date', now.toISOString())`)

**טבלאות עזר:**
- `billing_events` — idempotency ל-webhook (`migrations/016_cardcom_billing.sql:54-61`)
- `subscription_charges` — לוג כל ניסיון חיוב, unique על `uniq_asmachta` (`migrations/016:64-81`)
- `mioshy_billing_failures` — כשל פוסט-תשלום בקריאה לחשבונית uxellent (`migrations/048_billing_failures.sql:25-35`)
- `customer_payment_methods` — טוקנים מוצפנים (`migrations/016:35-49`)

---

## 0.3 — Retry, alerting, monitoring

| בדיקה | מצב | פרטים |
|---|---|---|
| Retry ל-webhook נכשל? | ⚠️ חלקי | Cardcom חוזר רק כשהפרודקציה מחזירה != 200. ה-indicator מחזיר 200 גם אחרי שגיאות פנימיות (`indicator/route.ts:714`), כך שלא יהיו ניסיונות חוזרים. |
| Retry לחיוב נכשל ב-cron? | ✅ קיים אבל יומי | `next_billing_date` לא מתקדם בכשל → cron הבא (היום הבא) ינסה שוב. אין retry בתוך אותו cycle. |
| Alerting אם cron לא רץ? | ❌ **לא קיים** | אין endpoint סטטוס, אין heartbeat. אם Vercel דילג על הרצה, אף אחד לא יודע. |
| Alerting אם חיוב כשל? | ❌ **לא קיים** | רק `console.error` ב-`renewals/run:212-221`. אין מייל לאדמין, אין Slack, אין PagerDuty. |
| Alerting אם חשבונית לא נוצרה? | ⚠️ דרך repair cron בלבד | `repair-missing-invoices` רץ ב-06:30 UTC ויוצר את החשבוניות שחסרות. בלי התראה. |
| מבוסס cron או trigger? | **Cron פנימי** | לא Cardcom recurring. כל חיוב יזום על-ידינו דרך chargeToken. |
| Monitoring שה-cron רץ? | ❌ **לא קיים** | אין דשבורד, אין metric, אין אזעקה. |
| לוג של כל ניסיון | ✅ קיים ב-DB | `subscription_charges` (status: created/succeeded/failed) + `raw_response` JSONB |

**🔴 הסיכון העיקרי בקטגוריה הזו:**
**`.limit(20)` בשורה 42 של `renewals/run/route.ts`** — ה-cron מטפל ב-**עד 20 מנויים בלבד לכל הרצה**, וההרצה היא פעם ביום. זה אומר תקרת קיבולת קשיחה: **20 חידושים ביום, ≈140 בשבוע**. ברגע שתגיעו ל-141 מנויים פעילים שכולם מתחדשים באותו יום, חלקם יחויבו באיחור של יום-יומיים-שלושה. זה לא בעיה היום (אתה לפני השקה), אבל זו פצצת זמן ברגע שתגדלו.

מעבר לזה: `.limit(20)` מסודר ב-`order('next_billing_date', { ascending: true })` — כלומר הוותיקים ביותר נטענים קודם, מה שמונע "תור רעבון" אבל גם מבטיח שמי שמאחר יתועדף.

---

## 0.4 — Edge cases

**שדרוג מסלול (Games → Journey):** ✅ נתמך ב-`indicator/route.ts:497-551`. כשמשתמש עם Games active קונה Journey, ה-Games sub מסומן `cancelled` עם `cancellation_reason = 'upgraded_to_journey'`. לא נכלל אוטומטית בחיוב הבא (cron בודק רק `status IN ('active','past_due')`).

**הורדה (downgrade Journey → Games):** ❌ **לא ממומש**. אין flow כזה בקוד. אם תוסיף — צריך לזכור שגם זה צריך טיפול דומה (cancel sub אחד, יצור חדש).

**ביטול וחידוש באותו יום:** ⚠️ **חלקית מסוכן**. ביטול מוצדק עובר ב-`/dashboard/subscriptions` (component `SubscriptionActions`), אבל אם המשתמש קונה שוב מיד — נוצרת subscription חדשה ולא משוחזרת הישנה. ייתכן רשומה כפולה זמנית בטבלה.

**מעבר חודשים (28/29/30/31):** ✅ **לא בעיה**. `addPlanPeriod` משתמש ב-`d.setDate(d.getDate() + 7)`, ש-JavaScript מטפל בו אוטומטית (חודש פברואר → מרץ עובד נכון, סוף שנה גם).

**שעון קיץ/חורף (DST):** ✅ **לא בעיה**. כל התאריכים נשמרים כ-`timestamptz` ומשוווים ב-UTC (`now.toISOString()`). Vercel runtime ב-UTC. אין שום שימוש ב-timezone של ישראל בלוגיקת התזמון.

**אם ה-webhook של Cardcom נכשל:** Cardcom יחזור לנסות רק אם נחזיר status != 200. הקוד שלנו מחזיר 200 גם אחרי שגיאות פנימיות (`indicator/route.ts:714`). זה pattern נכון ל-idempotency, **אבל** משמעו שצריך monitoring טוב על שגיאות פנימיות אחרי 200 — וכרגע אין.

**אם השרת היה למטה כשcron אמור היה לרוץ:** Vercel cron לא מבטיח at-least-once. אם הפרודקציה הייתה במצב deploy ב-06:00 UTC, ה-cron פשוט נדלג. אין catch-up אוטומטי. **המנויים יחויבו פשוט יום אחרי.**

**failed_attempts אינסופי:** ה-counter `failed_attempts` עולה ללא תקרה. השרשור היחיד שעוצר חיוב הוא `grace_until <= now` שהופך את ה-status ל-`blocked`. זה תקין, אבל יש subscriptions שעלולים לצבור 10-20 failed_attempts לפני שה-grace נגמרת — שווה בדיקה.

---

## 0.2 — שאילתות SQL להצלבה מול Cardcom

הרץ את אלה ב-Supabase SQL Editor. הראשונה היא המרכזית — היא תיתן לך טבלה של "מה היה אמור לקרות מול מה באמת קרה" עבור כל המנויים הפעילים.

### A. רשימת מנויים פעילים + מתי חויבו לאחרונה

```sql
-- 1. מנויים פעילים, היסטוריית חיובים, ופערי תזמון
SELECT
  s.id AS subscription_id,
  s.email,
  s.product,
  s.plan,
  s.status,
  s.plan_amount,
  s.currency,
  s.created_at::date AS sub_started,
  s.current_period_end,
  s.next_billing_date,
  s.failed_attempts,
  s.grace_until,
  -- כמה חיובים מוצלחים סה"כ
  COUNT(sc.id) FILTER (WHERE sc.status = 'succeeded') AS successful_charges,
  -- כמה כשלים
  COUNT(sc.id) FILTER (WHERE sc.status = 'failed') AS failed_charges,
  -- מתי החיוב המוצלח האחרון
  MAX(sc.created_at) FILTER (WHERE sc.status = 'succeeded') AS last_successful_charge,
  -- כמה ימים עברו מאז (נמוך מ-7 = תקין, גבוה = פיגור)
  EXTRACT(DAY FROM now() - MAX(sc.created_at) FILTER (WHERE sc.status = 'succeeded')) AS days_since_last_charge
FROM subscriptions s
LEFT JOIN subscription_charges sc ON sc.subscription_id = s.id
WHERE s.status IN ('active', 'past_due', 'grace')
GROUP BY s.id
ORDER BY days_since_last_charge DESC NULLS FIRST;
```

**איך לקרוא:** כל שורה שבה `days_since_last_charge > 8` היא חשד לחיוב שדילגו עליו. הצלב מול Cardcom dashboard לפי `s.email`.

### B. זיהוי מנויים שלא חויבו בכלל למרות שעבר התאריך

```sql
-- 2. מנויים שאמורים היו להיות מחויבים אבל אין רשומת charge בתקופה
SELECT
  s.id,
  s.email,
  s.product,
  s.next_billing_date,
  s.status,
  s.failed_attempts,
  EXTRACT(DAY FROM now() - s.next_billing_date) AS days_overdue
FROM subscriptions s
WHERE s.status IN ('active', 'past_due')
  AND s.next_billing_date < now() - INTERVAL '24 hours'
  -- ולא קיים charge אחרי המועד
  AND NOT EXISTS (
    SELECT 1
    FROM subscription_charges sc
    WHERE sc.subscription_id = s.id
      AND sc.created_at > s.next_billing_date
  )
ORDER BY s.next_billing_date ASC;
```

**איך לקרוא:** כל שורה כאן היא מנוי שעבר זמן החיוב יותר מ-24 שעות והשרת לא ניסה לחייבו. אם זה > 1-2 שורות, יש בעיית cron אמיתית.

### C. ספירת חיובים יומית — 30 הימים האחרונים

```sql
-- 3. חיובים ביום: כמה ניסה, כמה הצליחו, כמה כשלו
SELECT
  date_trunc('day', sc.created_at)::date AS day,
  COUNT(*) AS total_attempts,
  COUNT(*) FILTER (WHERE sc.status = 'succeeded') AS succeeded,
  COUNT(*) FILTER (WHERE sc.status = 'failed') AS failed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE sc.status = 'failed') / NULLIF(COUNT(*), 0),
    2
  ) AS failure_rate_pct,
  SUM(sc.amount) FILTER (WHERE sc.status = 'succeeded') AS total_revenue,
  sc.currency
FROM subscription_charges sc
WHERE sc.created_at >= now() - INTERVAL '30 days'
GROUP BY day, sc.currency
ORDER BY day DESC;
```

**איך לקרוא:** ימים עם `failure_rate_pct > 5%` שווים בדיקה. ימים עם `total_attempts = 0` הם **דגל אדום** — או שאין מנויים שאמורים לחיוב באותו יום (סביר אם הבסיס קטן), או שה-cron לא רץ.

### D. ספירת כפילויות בחיובים

```sql
-- 4. אסמכתאות (asmachta) שהופיעו פעמיים — לא אמור לקרות, יש UNIQUE constraint
SELECT
  uniq_asmachta,
  COUNT(*) AS duplicate_count,
  array_agg(id) AS charge_ids,
  array_agg(status) AS statuses,
  array_agg(created_at ORDER BY created_at) AS attempts
FROM subscription_charges
GROUP BY uniq_asmachta
HAVING COUNT(*) > 1;
```

**איך לקרוא:** אמור להחזיר **0 שורות** (יש unique constraint). אם משהו חוזר — תקלת migration או רעש.

### E. כשלי uxellent חשבונית — 30 יום אחרונים

```sql
-- 5. כשלים ביצירת חשבונית אחרי חיוב מוצלח (קריטי — לקוח שילם בלי חשבונית)
SELECT
  mbf.created_at::date AS day,
  mbf.error_code,
  COUNT(*) AS error_count,
  array_agg(DISTINCT mbf.error_message) AS sample_messages
FROM mioshy_billing_failures mbf
WHERE mbf.created_at >= now() - INTERVAL '30 days'
GROUP BY day, mbf.error_code
ORDER BY day DESC, error_count DESC;
```

### F. הצלבה אישית מול Cardcom — סקריפט שורה-שורה

```sql
-- 6. חיובים אחרונים עם asmachta — להעתיק ולהדביק מול Cardcom dashboard
SELECT
  sc.created_at,
  sc.uniq_asmachta,                   -- חפש את זה ב-Cardcom dashboard
  s.email,
  s.product,
  sc.amount,
  sc.currency,
  sc.status,
  sc.raw_response->>'ResponseCode' AS cardcom_response_code,
  sc.raw_response->>'Description'  AS cardcom_description
FROM subscription_charges sc
JOIN subscriptions s ON s.id = sc.subscription_id
WHERE sc.created_at >= now() - INTERVAL '7 days'
ORDER BY sc.created_at DESC;
```

**איך להשתמש:** קח את ה-`uniq_asmachta` (פורמט `m:abc123:20260520`) וחפש אותו ב-Cardcom dashboard → Reports → Transactions. אם הוא לא קיים שם אבל בDB יש `status='succeeded'` — בעיה גדולה. הפוך — קיים בCardcom ולא ב-DB — חמור לא פחות.

### G. בדיקת השלמות של 10 מנויים אקראיים

```sql
-- 7. דגימה אקראית של 10 מנויים פעילים עם כל היסטוריית החיוב שלהם
WITH random_subs AS (
  SELECT id, email FROM subscriptions
  WHERE status = 'active'
  ORDER BY random()
  LIMIT 10
)
SELECT
  rs.email,
  s.created_at::date AS started,
  EXTRACT(WEEK FROM age(now(), s.created_at))::int AS weeks_active,
  COUNT(sc.id) FILTER (WHERE sc.status = 'succeeded') AS charges_succeeded,
  -- האם מספר החיובים תואם בערך לשבועות שעברו?
  CASE
    WHEN COUNT(sc.id) FILTER (WHERE sc.status = 'succeeded') >=
         EXTRACT(WEEK FROM age(now(), s.created_at))::int - 1
    THEN 'OK'
    ELSE 'GAP'
  END AS billing_consistency
FROM random_subs rs
JOIN subscriptions s ON s.id = rs.id
LEFT JOIN subscription_charges sc ON sc.subscription_id = s.id
GROUP BY rs.email, s.created_at, s.id
ORDER BY billing_consistency, weeks_active DESC;
```

**איך לקרוא:** כל שורה עם `billing_consistency = 'GAP'` היא לקוח ששילם פחות פעמים ממה שעבר. צריך לפתוח את ההיסטוריה האישית שלו ולהבין מה קרה.

---

## 0.5 — תוכנית פירוט למוניטורינג (לאישור לפני כתיבה)

ההצעה: שלוש שכבות, מהפשוט למורכב. אפשר לעצור אחרי כל שכבה.

### שכבה 1 — Heartbeat + email alerts (~½ יום עבודה)

**מה זה נותן:** התראה במייל בכל פעם שה-cron נכשל או שיש שיעור כשלים חריג. זה הצורך הקריטי ביותר היום.

**מה נעשה בקוד:**
1. הוסף שדה `cron_runs` (טבלה חדשה): `id, cron_name, started_at, ended_at, processed_count, error_count, status ('success'|'error'), notes`.
2. ב-`renewals/run/route.ts` — בתחילת הרצה INSERT שורה, בסוף UPDATE עם הסטטיסטיקות.
3. ב-`repair-missing-invoices/route.ts` — אותו דבר.
4. צור `lib/billing/alerts.ts` עם פונקציה `sendBillingAlert(subject, body)` שמשתמשת ב-Brevo (כבר מחובר).
5. תנאי שליחה: (א) cron נכשל כליל, (ב) `failure_rate > 10%` באותה הרצה, (ג) `processed_count = 0` כשיש מנויים שאמורים להיות.
6. כתובת יעד: ENV חדש `MIOSHY_BILLING_ALERT_EMAIL` (ברירת מחדל: itzik@uxellent.com).

**Migration נוסף:** `093_cron_runs.sql` — טבלה + RLS service_role.

### שכבה 2 — דשבורד אדמין בילינג (~1.5 ימים)

**מה זה נותן:** מסך ב-`/dashboard/billing` שמציג בזמן אמת מה קורה.

**מה נעשה בקוד:**
1. עמוד `app/dashboard/billing/page.tsx` — server component.
2. אגרגציות (RSC fetch):
   - 7 הימים האחרונים: bar chart של חיובים מוצלחים/נכשלים
   - מנויים פעילים: מספר, סך שבועי צפוי (ILS+USD)
   - **רשימת מנויים "באיחור"** (queryB מה-SQL למעלה) — עם קישור לכל אחד
   - **רשימת cron runs אחרונים** — האחרון, סטטוס, משך
   - **רשימת כשלי uxellent** מ-`mioshy_billing_failures` — סינון לפי `error_code`
3. כפתור "Run cron now" (admin only) שמפעיל ידנית את `/api/billing/renewals/run`.
4. כפתור "Test alert email" שמוודא שה-alerting עובד.

**רכיבים חדשים:**
- `components/dashboard/billing/BillingOverviewCards.tsx`
- `components/dashboard/billing/BillingChart.tsx` (recharts)
- `components/dashboard/billing/CronRunsTable.tsx`
- `components/dashboard/billing/OverdueSubsTable.tsx`

### שכבה 3 — תיקונים מבניים לסיכונים שגילינו ב-audit (~2-3 ימים)

**מה זה נותן:** סוגר את הפצצות שהוזכרו ב-0.3 ו-0.4.

1. **הסרת `.limit(20)`** ב-`renewals/run/route.ts` — או הגדלה ל-200 + הפיכה ל-batched parallel (Promise.all עם concurrency limit של 5). דורש מדידת ביצועים מקדימה.
2. **Retry בתוך אותה הרצה** — אם chargeToken מחזיר 5xx, נסה שוב פעם אחת אחרי 30 שניות לפני שמסמנים past_due. תכנותית פשוט (`p-retry`), שיווקית מציל מנויים מפצצת זמן זמנית של Cardcom.
3. **התראה ללקוח** שהתשלום נכשל — מייל אחרי כשל ראשון, מייל שני יום לפני grace expiry, מייל סופי בחסימה. שימוש בתבנית Brevo קיימת.
4. **endpoint סטטוס** `GET /api/billing/health` שמחזיר: `last_cron_run_at`, `success_rate_7d`, `overdue_subs_count`. שימושי גם ל-Uptime monitoring חיצוני (Better Stack וכו').
5. **דיווח לאדמין יומי במייל** — סיכום של 24 השעות האחרונות, גם בלי שום כשל. נותן לך feel איך הבסיס גדל.

---

## הסיכונים העיקריים שגילינו (תקציר)

**🔴 קריטי לפני שיתוף פרטנר:**
- אין שום התראה כשחיוב שבועי נכשל — אדמין יודע רק אם הוא בודק ידנית
- אין monitoring שה-cron בכלל רץ. אם Vercel דילג על הרצה, אתה תגלה רק כשלקוח יתלונן

**🟡 גדל בהמתנה:**
- `.limit(20)` ל-cron — תקרה קשיחה בקיבולת
- אין retry בתוך אותה הרצה — חולשה זמנית של Cardcom = past_due מיותר
- אין מייל ללקוח שתשלום נכשל — הוא מגלה כשהגישה נחסמת

**🟢 שולי / לא דחוף:**
- אין downgrade flow (אבל גם אין צורך עסקי)
- `failed_attempts` ללא תקרה (אבל grace_until מטפל בפועל)
- repair cron סורק רק 30 ימים אחורה (אבל יש לוג מלא ב-DB)

---

## המלצה מסכמת לרצף עבודה

1. **רוץ את שאילתות SQL A, B, C, F עכשיו** — קח 15 דקות, ייתן לך תמונת מצב של מה קורה בייצור.
2. **אם מצאת בעיות**: לטפל בהן ספציפית לפני המוניטורינג.
3. **שכבה 1 של המוניטורינג** (heartbeat + alerts) — חובה לפני שמשיקים פרטנרים, ½ יום.
4. **שכבה 2** (דשבורד) — מומלץ אבל לא חוסם, 1.5 יום, יכול לבוא במקביל לפיתוח פרטנרים.
5. **שכבה 3** (תיקונים מבניים) — לפצל למשימות נפרדות, לעדף לפי כאב.

רק אחרי שכבה 1 לפחות — להתחיל בפיתוח שיתוף פרטנרים.
