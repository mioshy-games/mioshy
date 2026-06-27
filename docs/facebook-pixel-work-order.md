# בריף עבודה: הטמעת Facebook (Meta) Pixel + Conversions API — מיאושי

**עבור:** Claude Code (סוכן הפיתוח)
**מנסח / מפקח:** Itzik
**תאריך:** 2026-06-21
**סטטוס:** בריף לביצוע — לא לשנות החלטות שסומנו "נעול" בלי אישור

---

## 1. מטרה

להטמיע מעקב המרות של Meta באתר מיאושי, בשתי שכבות:

1. **Browser Pixel** (`fbq`) — בצד הלקוח, לכל הדפים והאינטראקציות.
2. **Conversions API (CAPI)** — אירועי שרת, בעיקר לרכישה, כדי לעקוף חוסמי פרסומות / ITP ולקבל מדידה מדויקת.

שתי השכבות שולחות את אותם אירועים עם **`event_id` משותף** כדי ש-Meta תבצע **דה-דופליקציה** (deduplication) ולא תספור פעמיים.

---

## 2. החלטות נעולות (לא לשנות בלי אישור Itzik)

- **שתי שכבות**: גם Pixel דפדפן וגם CAPI. אירוע `Purchase` חייב להישלח **גם** מהשרת.
- **בלי באנר הסכמה (consent banner)** — בהתאם להחלטה שכבר קיימת ל-PostHog. (ישראל; ראה §6 פרטיות.)
- **בלי PII גולמי ל-Meta** — כל מייל/טלפון שנשלח ל-CAPI חייב להיות מ-hashed ב-SHA-256 (lowercase + trim) לפי תקן Advanced Matching של Meta. אסור לשלוח מייל/טלפון בטקסט גלוי.
- **Pixel ID נעול**: משתמשים בפיקסל הקיים **Mioshy_pixel 2021**, ID **`230133301942923`** (Owned by Itzik Barlev's Business). אל תקודד אותו בקוד — מגיע דרך `NEXT_PUBLIC_FB_PIXEL_ID`.
- **Prod-only** — הפיקסל לא נטען ב-`development`, בדיוק כמו PostHog ו-GTM (ראה דפוס ב-`components/analytics/PostHogProvider.tsx`).
- **טעינה דחויה (deferred / idle)** — לא לחסום first paint. אותו דפוס `requestIdleCallback` כמו ב-PostHogProvider.
- **מובייל-first** — אסור לפגוע ב-layout/perf בדסקטופ; אין UI חדש כתוצאה מהמשימה הזו.

---

## 3. מיפוי אירועים (Event Mapping)

| אירוע Meta | מתי נורה | פרמטרים | שכבה |
|---|---|---|---|
| `PageView` | כל טעינת דף + כל ניווט App-Router (SPA) | ברירת מחדל | Browser |
| `ViewContent` | צפייה בעמוד מוצר: `/games/[slug]`, `/mioshy-sex/[slug]`, `/journey` | `content_ids`, `content_name`, `content_type`, `content_category` (games/journey/adults) | Browser |
| `CompleteRegistration` | השלמת פרופיל מלא / הרשמה (שם+מייל+נייד+סיסמה) | `status: true` | Browser + CAPI |
| `InitiateCheckout` | תחילת תהליך תשלום (SubscriptionModal → checkout create) | `value`, `currency: ILS`, `content_name` (סוג מנוי) | Browser + CAPI |
| `Purchase` | **אישור תשלום מ-Cardcom** | `value`, `currency: ILS`, `content_name`, `content_type` | **CAPI (חובה)** + Browser (אם יש דף הצלחה) |
| `FreeGameSpin` (custom) | סיבוב גלגל במשחק החינמי | `spin_number` | Browser |
| `FreeGameCTAClick` (custom) | לחיצה על ה-CTA אחרי סיבוב 3 (TruthOrDareClient) | — | Browser |
| `CompleteAssessment` (custom) | סיום האבחון **הקצר** והגעה למסך הסיכום/ניתוח ב-`/journey/assessment` (חינמי, ראש המשפך; מסך `isDone===true` ב-`JourneyClient`) | — | Browser |
| `CompleteFullAssessment` (custom) | סיום האבחון **הארוך** (21 שאלות) והגעה לסיכום ב-`/assessments/` (אחרי תשלום) | `assessment_type` (slug ניטרלי) | Browser |

הערות:
- **`Purchase` הוא האירוע הקריטי** לקמפיינים. חייב לרוץ מהשרת ב-CAPI עם הסכום האמיתי. ה-Browser purchase הוא בונוס לדה-דופ — אם אין דף הצלחה אמין, אפשר להסתפק ב-CAPI בלבד.
- ערך `value` חייב להיות הסכום בפועל ש-Cardcom חייב (כולל מע"מ 18%). לא לקודד מספר קבוע.
- "משחק חינמי / Funnel" — האירועים הקסטומיים נשארים **גלובליים** (לא slug-gated), בהתאם להחלטת ה-CTA של הסיבוב השלישי.
- **שני אבחונים נפרדים — שני אירועים נפרדים:**
  - **`CompleteAssessment`** = האבחון הקצר ב-`/journey/assessment` (ראש משפך חינמי). עוגן: מסך הסיכום/ניתוח ב-`JourneyClient` כש-`isDone===true`. **זה אירוע האופטימיזציה של הקמפיין הראשון** (נפח גבוה, כוונה אמיתית).
  - **`CompleteFullAssessment`** = האבחון הארוך (21 שאלות) ב-`/assessments/` (משתמשים משלמים). עוגן: קומפוננטת הסיכום ב-`AssessmentSummary` (`lib/assessments/`). אירוע מדידה/engagement בלבד — **לא** לאופטימיזציית רכישה (נפח נמוך).
  - לירות פעם אחת לכל סיכום, לא בכל re-render.

---

## 4. ארכיטקטורה ונקודות עיגון בקוד

**צד לקוח (Browser Pixel):**
- ליצור `components/analytics/MetaPixelProvider.tsx` במקביל ל-`PostHogProvider.tsx` — אותו דפוס: prod-only, idle-load, no-op כש-ENV חסר.
- לחווט ב-`app/[locale]/layout.tsx` (שם כבר יושב `PostHogIdentify`). `PageView` על ניווט יחקה את `PageviewTracker` הקיים (usePathname/useSearchParams).
- ליצור helper `lib/analytics/meta-pixel.ts` עם פונקציות עטיפה (`trackViewContent`, `trackPurchase`, וכו') שמייצרות `event_id` ומעבירות אותו גם ל-CAPI.

**צד שרת (CAPI):**
- אירוע `Purchase` יורה מ-**`app/api/billing/cardcom/indicator/route.ts`** (ה-webhook/indicator של Cardcom — נקודת האמת לתשלום שהושלם). זה המקום היחיד שמבטיח שהכסף אכן עבר.
- לשלוח ל-Meta Graph API endpoint (`/{PIXEL_ID}/events`) עם `FB_CAPI_ACCESS_TOKEN`.
- להעביר `fbp` ו-`fbc` (קוקיז של Meta) ו-`event_id` מהדפדפן אל השרת כדי לאפשר דה-דופ ו-attribution. לתכנן איך ה-event_id/cookies מגיעים מהלקוח לרגע ה-checkout (למשל לשמור על ה-checkout record).
- Hash ל-`em`/`ph` ב-SHA-256.

**אל תתקין חבילות מול תיקיית mioshy** (ה-FUSE mount משחית node_modules) — אם צריך SDK, עדכן `package.json` ידנית או השתמש ב-`fetch` ישיר ל-Graph API (מועדף — בלי תלות).

---

## 5. משתני סביבה (ENV)

```
NEXT_PUBLIC_FB_PIXEL_ID=230133301942923   # פיקסל Mioshy_pixel 2021 (קיים)
FB_CAPI_ACCESS_TOKEN=                      # Conversions API token (server-only, לא NEXT_PUBLIC) — Itzik מפיק מ-Events Manager
FB_TEST_EVENT_CODE=                        # אופציונלי, ל-Test Events בזמן פיתוח בלבד
```

לוודא שכש-`NEXT_PUBLIC_FB_PIXEL_ID` חסר — הכל עושה no-op בשקט, לא שובר build (כמו PostHog).

---

## 6. פרטיות (קריטי — תוכן אינטימי)

- **בלי PII גולמי ל-Meta.** מייל/טלפון רק ב-hash. אין לשלוח תוכן משחקים, פרומפטים, או טקסט שהזוג כתב.
- **אסור** להעביר ל-`ViewContent`/`content_name` שמות מפורשים של תוכן למבוגרים בצורה שעלולה לחשוף את המשתמש. להשתמש ב-slug/מזהה ניטרלי, לא בכותרת בוטה.
- **לכבד DNT** — אם המשתמש עם Do-Not-Track, לא לטעון פיקסל (תואם posture של PostHog, `respect_dnt: true`).
- לוודא שטוקני שיתוף (`?code=`, `token`, `email`) לא נשלחים בתוך URL ל-Meta — אותו redaction כמו ב-`sanitizeUrl` ב-PostHogProvider.

---

## 7. QA / קבלה (Definition of Done)

1. **Meta Events Manager → Test Events**: כל אירוע מ-§3 מופיע כשמבצעים את הפעולה, עם הפרמטרים הנכונים.
2. **דה-דופליקציה**: `Purchase` מופיע פעם אחת בלבד למרות שנשלח גם מ-Browser וגם מ-CAPI (לבדוק שה-`event_id` תואם).
3. **Event Match Quality**: לבדוק ב-Events Manager שה-CAPI מקבל ציון התאמה סביר (fbp/fbc/hashed email עוברים).
4. ב-`development` — אפס בקשות לפיקסל ברשת.
5. בלי רגרסיה ב-Lighthouse מובייל (LCP/CLS) — הטעינה דחויה.
6. בלי PII גלוי באף payload (לבדוק ב-Network tab).

---

## 8. מחוץ לסקופ (לא לעשות עכשיו)

- בלי באנר הסכמה / CMP.
- בלי Catalog / Dynamic Ads feed.
- בלי שינויי UI גלויים.
- בלי backfill של אירועים היסטוריים.

---

## 8.1 תנאי אישור Itzik (2026-06-21 — חובה לפני קוד/מיזוג)

1. **קריטי — בידוד קריאות Meta בנתיב התשלום.** ב-`indicator/route.ts` (אישור התשלום, מסמן `paid` בשורה ~191 ואז מעניק הרשאות/חשבונית) וב-`checkout/create` — כל קריאת CAPI חייבת להיות fire-and-forget, עטופה ב-try/catch משלה, עם timeout קצר על ה-fetch. כשל/השהיה של Meta **לעולם** לא נוגע בזרימת התשלום או בהענקת ההרשאות.
2. **לא ship-straight-to-prod.** השינוי נוגע בקוד Cardcom/כסף (indicator + checkout/create) → עבודה על branch, מיזוג רק אחרי QA ידני ואישור Itzik. (חורג מכלל ה-low-risk הרגיל של אנליטיקס.)
3. **גרסת Graph API עדכנית.** לא `v20.0` אם היא מיושנת/קרובה ל-deprecation — לוודא גרסה נתמכת נכון ל-2026.
4. **Purchase דרך CAPI יורה תמיד** (גם תחת DNT — זו המרה עסקית). **אל תשמור `client_ip_address` ב-DB יותר מהנדרש** ל-CAPI (פרטיות, תוכן אינטימי). `value` = הסכום ברוטו כולל מע"מ (`session.amount`, אומת שקיים).

---

## 9. שאלות פתוחות לסוכן (לענות לפני קוד)

1. האם קיים דף "הצלחת תשלום" אמין שאפשר לתלות עליו `Purchase` בצד הדפדפן, או שנסתמך על CAPI בלבד?
2. איפה בדיוק נקודת "השלמת פרופיל מלא" שצריכה לירות `CompleteRegistration`?
3. איך הכי נקי להעביר `event_id` + `fbp`/`fbc` מהדפדפן אל ה-Cardcom indicator route ברגע התשלום?

---

## 10. מה Itzik מספק (לפני שהסוכן מסיים)

- **Pixel ID**: `230133301942923` (כבר ב-ENV למעלה). פיקסל קיים, מקבל אירועים — לא יוצרים חדש.
- **CAPI Access Token** ל-`FB_CAPI_ACCESS_TOKEN`: Events Manager → דאטהסט **Mioshy_pixel 2021** → Settings → Conversions API → **Generate access token**.
- **Test Event Code** (אופציונלי, לבדיקות): Events Manager → Test Events.

הערה: ב-"Connected assets" של הפיקסל עדיין אין Ad Account/Page מחוברים — לא חוסם מעקב, אבל צריך לחבר לפני הדלקת קמפיין ממומן.
