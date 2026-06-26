# בריף + צ'קליסט — אנליטיקת משפך האבחון (Assessment Funnel Analytics)

> **סטטוס:** בריף handoff ל-Claude Code. **לא לגעת בקוד עד אישור Itzik על שלב 0.**
> **בעלים:** Itzik · **PM/אימות:** Claude (chat) · **מימוש:** Claude Code
> **תאריך:** 2026-06-26
> **מקור אמת רחב יותר:** `docs/admin-analytics-spec.md` (המערכת ההתנהגותית הכללית — כבר חיה). המסמך הזה ממוקד **רק במשפך האבחון** ובעמוד אדמין ייעודי לו.

---

## 1. המטרה (מה נדע בסוף)

עמוד אדמין אחד שמראה, פר-אבחון, עם **סינון לפי טווח תאריכים** ו**פילוח יום/שבוע**, את המשפך המלא:

1. **נכנס לאבחון** (צפה בעמוד האינטרו)
2. **התחיל** (ענה על שאלה 1)
3. **נשירה לפי שאלה** — באיזו שאלה בדיוק עזבו
4. **סיים** את האבחון
5. **נרשם**
6. **רכש**
7. **הזמין פרטנר**
8. **צפה בפרק הראשון** שנפתח לו בהרשמה

ובמקביל שכבה **התנהגותית**: כמה זמן שהה, **מאיזה עמוד הגיע** (referrer), **כמה עמודים עבר**, ו**לאן יצא** אם נטש את האבחון ונשאר באתר.

---

## 2. מה כבר קיים — לא לבנות מחדש

| רכיב | מקור | סטטוס |
|---|---|---|
| ליבת המשפך 2→4 (התחיל/נשירה/סיים) | `assessment_sessions` + `assessment_responses` (mig 107) | ✅ הנתון קיים, חסר רק UI |
| נרשם | `assessment_sessions.user_id` הופך מ-null למזהה (claim ב-`actions/assessment-inline-signup.ts`) | ✅ |
| רכש | `subscriptions` (status active) join לפי `user_id` | ✅ |
| הזמין פרטנר | `couple_invitations` (mig 030): `status` pending/accepted, `inviter_user_id`, `created_at`/`accepted_at` | ✅ אומת |
| צפה בפרק ראשון | `journey_user_activity` verb=`item_opened` (mig 044) | ✅ |
| תשתית אנליטיקה first-party | `lib/analytics.ts` (`track`/`sendBeaconEvent`/`buildPayload`) + `app/api/analytics/event/route.ts` + טבלת `analytics_events` (mig 038) | ✅ חי בפרוד |
| dwell / זמן-שהייה | `hooks/useDwellTracking.ts` (heartbeat 15ש', מינ' 5ש') | ✅ קיים, מורכב כבר על ליווי/משחקים/מבוגרים |
| login events | `auth_login_events` (mig 130) | ✅ |
| עמודי אדמין-אנליטיקה לדוגמה | `/dashboard/users/[id]`, `/dashboard/behavior` | ✅ קונבנציה להישען עליה |

**מסקנה:** שלבים 2–8 של המשפך נגזרים כמעט כולם מנתונים קיימים. הבנייה האמיתית: (א) instrumentation לראש המשפך + השכבה ההתנהגותית, (ב) שכבת שאילתות, (ג) עמוד אדמין.

---

## 3. הפערים

1. **עמודי האבחון לא משדרים `analytics_events` בכלל** — אין `page_view`, אין dwell, אין אירוע "התחיל". (כיום יש רק Meta Pixel ב-`AssessmentSummary.tsx`, שלא queryable אצלנו.)
2. **אין `page_view` first-party גלובלי** — `trackPageView()` מוגדר ב-`lib/analytics.ts` אבל לא מורכב גלובלית. בלעדיו אין "מסלול עמודים" ו"לאן יצא" queryable ב-Supabase (כיום זה רק ב-PostHog).
3. **"נכנס אבל לא ענה ש.1"** לא קיים ב-DB (session נוצר רק עם התשובה הראשונה).
4. **אין עמוד אדמין** למשפך האבחון.

### 3.1 פערים שחשפה ביקורת הסוכן (קריטיים — שולבו בתוכנית)

- 🔴 **פרטיות — referrer/path לא ממוסכים ב-first-party.** PostHog מבצע `sanitizeUrl` ל-`code/token/email/invite/ref_code` (`PostHogProvider.tsx:61,126-138`), אבל `buildPayload` ב-`lib/analytics.ts` שומר `path` **גולמי**. ברגע שנשתול `page_view` גלובלי עם referrer, טוקן שיתוף-הפרטנר (`?code=`) או email עלולים לזלוג ל-`analytics_events` — שובר את גישה א'. **חובה לתקן לפני שתילת page_view.**
- 🔴 **ייחוס "רכש" חסר עוגן ב-DB.** הרכישה יוצרת `subscriptions(product='journey')`, וה-`source:"assessment_<id>"` שנשלח מ-`AssessmentSummary` **נזרק** (ה-checkout route מתעלם ממנו; ה-sub מקבל `source:"paid"` קשיח). ייחוס לפי `user_id`+זמן בלבד יספור כל רכישת journey. צריך להעביר את ה-source דרך `checkout_sessions` ולכתוב אותו ל-`subscriptions.source`.
- 🟠 **אין עמוד אינטרו נפרד** — `AssessmentClient` נפתח ישירות על שאלה 1 (`AssessmentClient.tsx:218`). "נכנס" = אירוע `assessment_intro_viewed` ב-mount של הרכיב, לא מסך נפרד.
- 🟠 **ראש המשפך משני מקורות** — "נכנס" מ-`analytics_events` (best-effort) ו"התחיל" מ-DB (מובטח) → ad-blocker יכול לתת `started > intro`. פתרון: marker-event מפורש `assessment_started` בנוסף, כדי שראש המשפך יחיה במקור אחד.
- 🟡 **ספירה + TZ** — לספור `COUNT(DISTINCT session.id)` (לא events, למניעת כפילות מ-`completed_at` שמתעדכן ב"חזרה"); שבוע מתחיל ביום ראשון (ישראל), לא ב-`date_trunc('week')` של Postgres שמתחיל בשני.
- 🟡 **"פרק ראשון" תלוי תזמון** — `unlock_at` יוצר פער זמן בין רכישה לזמינות הפרק; השלב ייראה נמוך בחלון קצר. לא באג — להסביר ב-UI.

---

## 4. הכרעות נעולות (Itzik, 2026-06-26)

1. **שכבה התנהגותית = first-party** בעמוד שלנו. להוסיף `page_view` גלובלי + dwell ל-`analytics_events`, כדי שמשפך + referrer + מסלול עמודים + יציאה יהיו queryable בעמוד אדמין אחד.
2. **ראש המשפך = צפייה בעמוד האינטרו.** לספור גם מי שנחת ולא ענה — דורש instrumentation קל לעמוד האינטרו.
3. (נגזר מהאפיון הכללי) **לעקוב גם אנונימיים לפי `device_id`**, פרטיות **גישה א'** — מטא-דאטה בלבד, בלי תוכן אינטימי/PII במסכי האנליטיקה.
4. **redaction חובה** על כל path/referrer first-party (תוצאת הביקורת) — אותו מיסוך שעושה PostHog. **תנאי-סף לשלב 0.**
5. **ייחוס רכישה דרך `subscriptions.source`** (לא דרך `product`, שנשאר `journey`) — להעביר את ה-source הקיים מ-`AssessmentSummary` דרך `checkout_sessions` עד ל-sub.

---

## 5. תוכנית עבודה — לעשות + לבדוק

> כללים קבועים: Claude Code **קומיט מקומי בלבד**, עוצר לאישור בסוף כל שלב. **לא להריץ npm/pnpm install** מול תיקיית mioshy. ענף פרודקשן = `game`. אנליטיקה = additive low-risk → אחרי אישור, deploy ישיר לפרוד ובדיקה שם (אין שער QA כבד). **אם נדרשת מיגרציה — Itzik מריץ ידנית** (אין runner אוטומטי).

### שלב 0 — Instrumentation (first-party)

**לעשות:**
- [ ] **תנאי-סף — redaction:** לחלץ את `sanitizeUrl` + `REDACT_QUERY_PARAMS` מ-`PostHogProvider.tsx` ל-helper משותף (`lib/analytics/redact-url.ts`), ולהחיל אותו על `path`+`referrer` בתוך `buildPayload` (`lib/analytics.ts`) — כך **כל** מסלול first-party ממוסך זהה ל-PostHog (מתקן גם את 22 נקודות ה-track הקיימות).
- [ ] להוסיף רכיב `page_view` גלובלי שמשדר ל-`/api/analytics/event` בכל ניווט (App-Router), עם `path` (ממוסך), `referrer` (ממוסך), `device_id`, `session_id`. שימוש חוזר ב-`sendBeaconEvent()`/`buildPayload()`. לדגם אחרי `PageviewTracker` שב-`PostHogProvider.tsx`.
- [ ] להוסיף ל-enum `AnalyticsEvent`: `assessment_intro_viewed`, `assessment_started`, `assessment_completed`, `assessment_registered`.
- [ ] **marker-events מפורשים** (לא הסקה מ-DB לראש המשפך): `assessment_intro_viewed` ב-mount של `AssessmentClient` (אין מסך אינטרו נפרד); `assessment_started` כשתשובה 1 נשמרת; `assessment_completed` בסיום; `assessment_registered` **רק** מ-`assessment-inline-signup.ts` (פעם אחת, דטרמיניסטי). ה-DB (`assessment_sessions`) נשאר source-of-truth ל**נשירה לפי שאלה** בלבד.
- [ ] להרכיב `useDwellTracking` על `AssessmentClient` (`pillar:'assessment'`, `ref_id: assessmentId`).

**לבדוק (Claude Code מתעד, אני מאמת):**
- [ ] **redaction:** נחיתה עם `?code=...`/`?email=...` → ב-`analytics_events` הערך `redacted` ב-`path` וב-`referrer`. זה ה-gate — לא ממשיכים בלי זה.
- [ ] אבחון מקצה-לקצה מקומי → מופיעים: `page_view` (referrer ממוסך), `dwell` (pillar=assessment), `assessment_intro_viewed`/`_started`/`_completed`.
- [ ] מבקר **אנונימי** מקבל שורות לפי `device_id`; `assessment_registered` נשלח פעם אחת בלבד.
- [ ] אין PII/טקסט אינטימי ב-payload.
- [ ] `tsc` 0 שגיאות, eslint נקי.

### שלב 1 — שכבת נתוני המשפך (`lib/dashboard/assessment-funnel.ts`)

**לעשות:**
- [ ] פונקציה שמחזירה, פר-`assessment_id` + טווח תאריכים + פילוח (יום/שבוע), את הספירות: `intro_views`, `started`, `completed`, `registered`, `purchased`, `partner_invited`, `first_chapter_viewed`.
- [ ] **ספירות = `COUNT(DISTINCT session.id)`** (לא events), כדי למנוע כפילות מ-`completed_at` שמתעדכן ב"חזרה".
- [ ] **נשירה לפי שאלה:** מ-`assessment_sessions.current_step` של sessions ב-`status='in_progress'` בלבד (high-water-mark = השאלה שבה נתקעו). `current_step` = מספר התשובות שנשמרו.
- [ ] **רכש (ייחוס):** join ל-`subscriptions` שה-`source` שלהן מצביע על האבחון (תלוי בתיקון §6). `product` נשאר `journey`.
- [ ] **פרטנר:** `couple_invitations` (status accepted / created_at). **פרק ראשון:** `MIN(created_at)` של `journey_user_activity` verb=`item_opened` פר-user.
- [ ] אגרגציות התנהגותיות: top referrers, ממוצע עמודים שעברו, יעדי יציאה (העמוד הבא אחרי `page_view` אחרון של `/assessments` באותו session), dwell ממוצע.
- [ ] service-role client; סינון על `created_at`/`completed_at` ב-TZ **Asia/Jerusalem**; שבוע **מתחיל ביום ראשון** (לא `date_trunc('week')` שמתחיל בשני).

**לבדוק:**
- [ ] שפיות: `intro_views ≥ started ≥ completed ≥ registered ≥ purchased`.
- [ ] סכום הנשירה לפי שאלה מסתדר עם מספר המסיימים.
- [ ] סינון תאריך + פילוח יום/שבוע מחזירים באקטים נכונים, וגבול השבוע נופל על ראשון.
- [ ] ייחוס הרכישה מצביע על האבחון הנכון, לא על כל רכישת journey.
- [ ] שמירה על div-by-zero ביחסי המרה.

### שלב 2 — עמוד אדמין `/dashboard/assessments/analytics`

**לעשות:**
- [ ] עמוד תחת `requireAdmin()`. בורר אבחון + טווח תאריכים + מתג יום/שבוע.
- [ ] ויזואליזציית משפך (8 שלבים + % המרה בין שלב לשלב).
- [ ] גרף **נשירה לפי שאלה** (איפה בדיוק עוזבים).
- [ ] פאנלים התנהגותיים: referrers, ממוצע עמודים, יעדי יציאה, מגמת dwell.
- [ ] להוסיף leaf בסיידבר תחת קבוצת ה-Analytics. i18n he/en. shadcn + גישת הגרפים הקיימת (SVG/CSS או Chart.js — בלי תלות חדשה).

**לבדוק:**
- [ ] נטען לאדמין בלבד (לא-אדמין מנותב).
- [ ] המספרים תואמים את שאילתות שלב 1 (spot-check מול SQL גולמי).
- [ ] פילטר תאריך + אבחון + יום/שבוע — כולם מחשבים מחדש נכון.
- [ ] רינדור RTL/מובייל תקין.
- [ ] רק מטא-דאטה/IDs על המסך — בלי תוכן אינטימי.

### שלב 3 — אימות ופרודקשן

**לעשות:**
- [ ] deploy ישיר לפרוד (additive low-risk). אם הוספה מיגרציית אינדקס ל-`analytics_events` — Itzik מריץ ידנית קודם.

**לבדוק (בפרוד):**
- [ ] אבחון חי מקצה-לקצה מופיע בעמוד המשפך בתוך החלון.
- [ ] השכבה ההתנהגותית (referrer, מסלול עמודים, יעד יציאה) מופיעה.

---

## 6. הערות סכמה ותיקון ייחוס רכישה

- **ייחוס רכישה — הכרעת ניהול (Claude, 2026-06-26):**
  - **v1 = מבוסס-אירוע, בלי לגעת ב-Cardcom.** לשדר `checkout_started` עם `{source:"assessment_<id>"}` ל-`analytics_events` מ-`AssessmentSummary`, ולייחס רכישה לפי `subscription_activated`/`subscriptions` של אותו `user_id`/`session_id`. אפס שינוי במסלול הכסף → נשאר low-risk, נכנס באותו deploy. זה מספיק טוב לדשבורד.
  - **follow-up (אחרי v1) = עוגן DB.** להעביר את `body.source` (שכרגע נזרק ב-`checkout/create/route.ts`) דרך `checkout_sessions` ל-`subscriptions.source` (`session.source ?? "paid"`). **לא** להוסיף `'assessment'` ל-`product` (mig 032). זה נוגע ב-Cardcom → עובר **שער QA מקדים לפני פרוד**, בנפרד.
- **אינדקס (כעת חובה, לא אופציונלי):** `analytics_events (event, (properties->>'pillar'), created_at DESC)` — שאילתות referrer/exit-target על JSONB יהיו כבדות בנפח בלעדיו. Itzik מריץ ידנית.
- ליבת המשפך עצמה: **לא נדרשת מיגרציה** — `analytics_events` + הטבלאות הקיימות מספיקות.
- dwell — ספים נעולים מהאפיון הכללי (§10): heartbeat 15ש', מינ' 5ש'.

> **חלופה קלה לייחוס** (אם לא רוצים לגעת במסלול הכסף עכשיו): לשדר `checkout_started` עם `{source:"assessment_<id>"}` ל-`analytics_events`, ולייחס רכישה לפי `subscription_activated` של אותו `user_id`/`session_id`. queryable, אפס שינוי DB/Cardcom — אבל ייחוס רך יותר.

## 7. חלוקת אחריות

- **Claude Code:** קוד + שאילתות + עמוד, קומיט מקומי, עוצר לאישור בסוף כל שלב. אם נדרשת מיגרציה — כותב, לא מריץ.
- **Itzik:** מריץ מיגרציות (אם יש), בדיקה, אישור deploy.
- **Claude (כאן):** מאמת פלט מול הבריף, מנסח הנחיות לסוכן, מעדכן את הצ'קליסט הזה אחרי כל שלב.
