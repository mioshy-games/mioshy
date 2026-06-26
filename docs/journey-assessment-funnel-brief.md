# בריף + צ'קליסט — משפך אבחון המסע (עמוד אדמין נפרד)

> **סטטוס:** בריף handoff ל-Claude Code. עמוד **נפרד** מהאבחון העצמאי.
> **בעלים:** Itzik · **PM/אימות:** Claude (chat) · **מימוש:** Claude Code
> **תאריך:** 2026-06-26
> **תאומים:** האבחון העצמאי כבר חי (`docs/assessment-funnel-analytics-brief.md`). זה התאום שלו לאבחון **המסע** (`/he/journey/assessment`, `JourneyClient`, טבלאות `journeys`/`journey_responses`).

---

## 1. המטרה

אותו משפך עשיר כמו בעצמאי, אבל לאבחון המסע, **בעמוד נפרד**: נכנס → התחיל → **סיים את הקצר** → נרשם → רכש → הזמין פרטנר → פרטנר הצטרף → צפה בפרק ראשון. בנוסף, מפורשות (בקשת Itzik): **כמה התחילו והשלימו את האבחון הארוך (full)**, ו**נשירה לפי שאלה — בנפרד לקצר ולארוך**, כדי לראות איפה נוטשים בדרך. עם סינון תאריכים ופילוח יום/שבוע, והשכבה ההתנהגותית (referrer / מסלול עמודים / יציאה / dwell).

---

## 2. מה כבר חי — לעשות שימוש חוזר (לא לבנות)

- **redaction + `track`/`sendBeaconEvent`/`buildPayload`** — `lib/analytics.ts` (path+referrer ממוסכים).
- **`FirstPartyPageView` גלובלי** — כבר שולח `page_view` בכל ניווט, **כולל עמודי המסע**. אז referrer/מסלול/יציאה כבר נאספים לאבחון המסע מרגע ה-deploy הקודם.
- **`useDwellTracking("journey", …)`** — `hooks/useDwellTracking.ts` (pillar 'journey' נתמך).
- **downstream משותף:** `subscriptions(product='journey')` לרכישה, `couple_members` (owner+partner) לפרטנר, `journey_user_activity` verb=`item_opened` לפרק ראשון, `checkout_started` לעוגן ייחוס.
- **תבנית מלאה:** `lib/dashboard/assessment-funnel.ts` + `app/dashboard/assessments/analytics/page.tsx` — כמעט 1:1. כל ה-helpers (TZ ירושלים שבוע-מ-ראשון, pagination, identity, rate) ניתנים לשכפול.
- **`/dashboard/journey-analytics` ו-`lib/dashboard/journey-kpis.ts` — להשאיר כמו שהם.** הם מודדים משפך **פוסט-רכישה אחר** (entitled→items→completions), לא משפך האבחון. לא להרחיב אותם.

---

## 3. מה חסר — לבנות

1. **4 מרקרים** ב-`JourneyClient` + `journey-inline-signup`, והוספתם ל-enum `AnalyticsEvent`.
2. **`lib/dashboard/journey-assessment-funnel.ts`** — שכפול של `loadAssessmentFunnel` עם ההבדלים שב-§4.
3. **עמוד חדש** `app/dashboard/journey/assessment-funnel/page.tsx` (לא הרחבה).
4. **לוודא ש-`partner_invite_shared` נורה גם בזרימת המסע** — אם לא, partnerInvited יהיה 0.

---

## 4. ההבדלים הקריטיים מהעצמאי (לב הבריף)

1. **`assessment_id` קבוע** — אין מזהה מרובה. כל 4 המרקרים נושאים ערך קבוע אחד, למשל `"journey"`, כדי שה-`.eq("properties->>assessment_id","journey")` יתפוס את כולם.
2. **סיום הקצר ≠ 'complete'** — בקצר נכתב **`status='paywall'`**, בארוך/single נכתב `status='complete'` (`app/api/journey/answer/route.ts:374-377`). אות "סיים את הקצר" = `status IN ('paywall','complete')` (וגם `'completed'` defensively). **אל תשתמש ב-`current_step >= total`.**
3. **"סיים את הארוך" — שלב נפרד (בקשת Itzik).** "ארוך" = phase `full`. אות "השלים את הארוך" = ה-journey ענה על כל שאלות ה-`full` / `status='complete'` בזרימת ה-full. הצג גם "התחיל את הארוך" (ענה לפחות שאלה אחת ב-phase=full) כדי לקבל את הנשירה ביניהם.
4. **נשירה לפי שאלה — נגזרת מ-`journey_responses`+`journey_questions`, לא מ-`current_step`.** ב-journey ה-`current_step` נכתב **phase-relative** (לא גלובלי), אז הוא לא מספיק. הגזירה: לכל journey לא-שלם, ספור responses, מַפֵּה כל `question_id`→`position`+`phase` דרך `journey_questions` (slug=question_id), וקח את ה-position הגבוה שנענה → השאלה הבאה = נקודת הנשירה. **פצל לשתי טבלאות נשירה: קצר ו-ארוך.**
5. **dwell refId ייעודי** — הרכב `useDwellTracking("journey","journey_assessment")` (לא `itemId` של פרק), והסנן ב-lib לפי `item_id="journey_assessment"`, כדי לא לבלוע dwell של פרקי-תוכן.

---

## 5. תוכנית עבודה — לעשות + לבדוק

> קומיט מקומי, ענף `feat/*`, עצור לאישור בסוף כל שלב. לא npm/pnpm install. אין מיגרציה חדשה (קריאה מטבלאות קיימות; אינדקס 145 כבר קיים). פרטיות גישה א'.

### שלב א' — מרקרים + dwell

**לעשות:**
- [ ] הוסף ל-enum `AnalyticsEvent`: `journey_assessment_intro_viewed`/`_started`/`_completed`/`_registered` (+ אופציונלי `journey_assessment_full_started`/`_full_completed` אם רוצים מרקר מפורש לארוך; אחרת גוזרים מ-DB).
- [ ] ב-`components/journey/JourneyClient.tsx`: `intro_viewed` ב-mount (ref-guard, ליד ~190), `started` בתשובה הראשונה (`capturedIndex===0`, ליד ~607), `completed` ב-`isDone` ראשון (ref + `wasInitiallyDoneRef`, ליד ~234). כולם `{ assessment_id:"journey" }`.
- [ ] `useDwellTracking("journey","journey_assessment")` ליד ~171.
- [ ] ב-`app/actions/journey-inline-signup.ts`: שדר `journey_assessment_registered` server-side, ענף register בלבד, פעם אחת, עם `device_id`+`user_id`+`{assessment_id:"journey"}` (כמו `assessment-inline-signup.ts:148-155`).

**לבדוק:** הרצת אבחון מסע מקצה-לקצה → 4 המרקרים + dwell(pillar=journey,item_id=journey_assessment) ב-`analytics_events`; אנונימי לפי device_id; registered פעם אחת; tsc+eslint נקיים.

### שלב ב' — `lib/dashboard/journey-assessment-funnel.ts`

**לעשות:** שכפל את `loadAssessmentFunnel` עם 4 שינויים:
- [ ] **completed הקצר** cross-check על `journeys.status IN ('paywall','complete','completed')`.
- [ ] **שלבי הארוך** — `fullStarted` / `fullCompleted` מ-`journey_responses`+`journey_questions` (phase=full), כשלבים מפורשים במשפך.
- [ ] **drop-off** נגזר מ-`journey_responses`+`journey_questions` (position/phase), **מפוצל קצר/ארוך**.
- [ ] downstream (purchased/partner/first-chapter/behavioral) — זהה לתבנית, dwell מסונן לפי `item_id="journey_assessment"`.

**לבדוק:** harness מול DB — שפיות `intro≥started≥completedShort≥fullStarted≥fullCompleted`; נשירה קצר/ארוך נסכמת נכון; ייחוס רכישה ל-cohort; partner/first-chapter; TZ/שבוע-ראשון; tsc+eslint.

### שלב ג' — עמוד `app/dashboard/journey/assessment-funnel/page.tsx`

**לעשות:** שכפל את עמוד ה-standalone. `requireAdmin`, service-role, פקדי טווח-תאריכים + יום/שבוע (אין בורר אבחון — יחיד). הצג: משפך מלא **כולל שלבי הקצר והארוך**, שתי טבלאות נשירה (קצר/ארוך), סדרת זמן, התנהגותי, באנר warnings, leaf בסיידבר תחת קבוצת המסע. i18n he/en, RTL/מובייל.

**לבדוק:** אדמין-only; מספרים תואמים את ה-lib; שלבי הארוך והנשירה המפוצלת מוצגים; פילטרים מחשבים מחדש; אפס תוכן אינטימי; tsc+eslint.

### שלב ד' — deploy + אימות חי
- [ ] merge ל-`game` + deploy (additive low-risk). אימות בפרוד: הרץ אבחון מסע אמיתי (כולל המשך לארוך), ראה את המשפך מתמלא כולל שלבי הארוך והנשירה.

---

## 6. אחריות
- **Claude Code:** קוד, קומיט מקומי, עצירה לאישור בכל שלב.
- **Itzik:** אישור deploy, אימות חי.
- **Claude (chat):** אימות פלט מול הבריף אחרי כל שלב, עדכון הצ'קליסט.
