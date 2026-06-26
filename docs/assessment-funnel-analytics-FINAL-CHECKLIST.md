# צ'קליסט סופי — אנליטיקת משפך האבחון (אימות שיש לנו הכל)

> נכון ל-2026-06-26. כל הבנייה (שלבים 0→2) הושלמה ע"י Claude Code ואומתה ע"י Claude (PM) מול הקוד.
> נשאר: merge + deploy + אימות חי בפרוד. אחרי זה — המוצר שלם.

---

## חלק א' — מה נבנה ואומת (✅ סגור)

- [x] **שלב 0 — instrumentation first-party** (commit `c9ed7ef`)
  - [x] redaction משותף (`lib/analytics/redact-url.ts`) על path+referrer בשני מסלולי השליחה — אומת round-trip ל-DB (`?code=`→`redacted`)
  - [x] `page_view` גלובלי (`FirstPartyPageView`) עם dedupe
  - [x] מרקרים: `assessment_intro_viewed` / `_started` / `_completed` / `_registered` (מגודרים נגד כפילות)
  - [x] `useDwellTracking('assessment', id)` — pillar+item_id תואמים את שאילתת ה-funnel
- [x] **שלב 1 — שכבת נתונים** (commit `f4b4947`)
  - [x] `loadAssessmentFunnel` — COUNT(DISTINCT), TZ Asia/Jerusalem, שבוע מתחיל ראשון, div-by-zero מוגן, pagination
  - [x] עוגן ייחוס רכישה: `checkout_started{source}` מ-`AssessmentSummary`
- [x] **שלב 1.5 — שלב הפרטנר** (commit `e28c463`)
  - [x] "הוזמן" = אירוע `partner_invite_shared` (4 ערוצים ב-`PartnerShareCard`)
  - [x] "הצטרף" = `couple_members` (owner ב-cohort + שורת partner). **לא** `couple_invitations` (נוטשה)
- [x] **שלב 2 — עמוד אדמין** `/dashboard/assessments/analytics` (commit `5a8a136`)
  - [x] `requireAdmin`, service-role, פקדים ב-URL (אבחון/טווח/יום-שבוע), באנר warnings, גרפים SVG/CSS, i18n he/en, leaf בסיידבר
- [x] tsc 0 שגיאות + eslint נקי בכל השלבים
- [x] פרטיות גישה א' (מטא-דאטה בלבד) — אומת בכל שכבה

---

## חלק ב' — פעולות העלאה (Itzik)

- [ ] **Merge** השרשרת לפרוד: `feat/assessment-funnel-step0` → `step1` → `step1.5` → `step2`, ואז ל-`game` (ענף הפרודקשן). הענפים מוערמים בסדר — מזגים לפי הסדר או squash אחד מאוחד.
- [ ] לכלול בקומיט גם את שלושת מסמכי ה-docs (brief / checklist / זה).
- [ ] **Deploy** ל-Vercel (אנליטיקה = additive low-risk → ישיר לפרוד, מותר לבדוק שם).
- [ ] **מיגרציה 145** (אינדקס `analytics_events`) — *אופציונלי, ביצועים בלבד.* להריץ ידנית כשנוח / כשהנפח גדל. **לא חוסם.**

> אין שום מיגרציה חוסמת. ליבת המשפך, הפרטנר, והעמוד — כולם על טבלאות קיימות.

---

## חלק ג' — אימות חי בפרוד (יחד, אחרי deploy)

זה משלים את מה שלא ניתן לאמת אוטומטית (תזמון הדקים אינטראקטיבי + רינדור אדמין).

**משפך מקצה-לקצה (הרץ אבחון אמיתי):**

- [ ] גלוש לאבחון **אנונימי** (בלי התחברות) עם `?code=test123` ב-URL → ב-`analytics_events` נכנס `assessment_intro_viewed`, ו-`path`+`referrer` מראים `redacted` (שער הפרטיות החי).
- [ ] ענה על שאלה 1 → נכנס `assessment_started`; המשך עד הסוף → `assessment_completed` (פעם אחת).
- [ ] לאורך הדרך → שורות `dwell` (pillar=assessment) ו-`page_view` לפי `device_id`.
- [ ] הירשם בסוף → `assessment_registered` פעם אחת, עם `user_id`+`assessment_id`.
- [ ] התחל checkout → `checkout_started` עם `source:"assessment_<id>"`.
- [ ] שתף פרטנר (העתק/וואטסאפ/QR) → `partner_invite_shared` עם `channel`.

**עמוד האדמין `/dashboard/assessments/analytics`:**

- [ ] נטען לאדמין; לא-אדמין מנותב.
- [ ] המשפך מציג את הריצה שעשית בתוך החלון; אחוזי המרה הגיוניים (`intro ≥ started ≥ completed ≥ registered`).
- [ ] נשירה לפי שאלה מציגה את הנקודה שבה עצרת אם נטשת באמצע.
- [ ] שלבי פרטנר: "הוזמן" ו"הצטרף" + יחס ביניהם.
- [ ] התנהגותי: referrer, ממוצע עמודים, יעדי יציאה, dwell — מתמלאים.
- [ ] פילטר אבחון/טווח/יום-שבוע מחשב מחדש.
- [ ] **אימות עיניים:** RTL ומובייל תקינים (המקום היחיד שלא נבדק מראש).
- [ ] באנר warnings — ריק (אם מופיע, לקרוא איזו טבלה חסרה).

---

## חלק ד' — פערים ידועים / מודעות

- **ייחוס רכישה = v1 רך** (מבוסס-אירוע, בלי לגעת ב-Cardcom). follow-up אופציונלי: עוגן DB ב-`subscriptions.source` — עובר שער QA של מסלול הכסף בנפרד.
- **"פרק ראשון"** תלוי ב-`unlock_at` (תזמון הליווי) — ייראה נמוך בחלון תאריכים קצר. צפוי, לא באג.
- **`couple_invitations`** נוטשה לטובת `couple_members`. אל תריץ את mig 030.
- שכבת התנהגות מלאה (referrer/מסלול/יציאה) זמינה רק לעמודים שטוענים את `FirstPartyPageView` (גלובלי) — מרגע ה-deploy ואילך.

---

## חלק ה' — משפך אבחון המסע (עמוד שני, נפרד)

עמוד שני `/dashboard/journey/assessment-funnel` לאבחון המסע (`/he/journey/assessment`) — האבחון הפעיל כרגע. בריף: `docs/journey-assessment-funnel-brief.md`.

- [x] **שלב א'** (commit `aa726d8`) — 4 מרקרים על `JourneyClient` + `journey-inline-signup` + dwell ייעודי `journey_assessment`. אומת מול הקוד.
- [x] **שלב ב'** (commit `de123a2`) — `lib/dashboard/journey-assessment-funnel.ts`: סיום קצר (`status IN paywall/complete`), **שלבי האבחון הארוך** (fullStarted/fullCompleted), נשירה מפוצלת קצר/ארוך מ-`journey_responses`+`journey_questions`. אומת.
- [x] **שלב ג'** (commit `6a87b51`) — עמוד `/dashboard/journey/assessment-funnel`: משפך 10 שלבים כולל הארוך, שתי טבלאות נשירה, leaf תחת קבוצת המסע. אומת.
- [x] **שלב ד'** — merge ל-`game` (SHA `7ea46ef`) + deploy. ✓
- [x] **תיקונים אחרי אימות חי** (SHA `1296687`): (א) `completed` re-fire למשתמש חוזר ב-paywall תוקן (`useRef(isDone)`); (ב) **אחוז נשירה לכל שאלה** נוסף לשתי הטבלאות, מכנה מבוסס-DB-journeys (pct תמיד ≤100%).
- [x] אימות חי ראשון: כל המרקרים נכנסו ל-`analytics_events`; שער פרטיות מחזיק (`code=redacted`, כולל מבקר FB-ads אמיתי עם utm נשמר); גישור anon→auth עובד.

**אימות חי (אבחון המסע):**

- [ ] הרץ אבחון מסע אנונימי עם `?code=test123` → `journey_assessment_intro_viewed`/`_started` + dwell(item_id=journey_assessment) נכנסים, path/referrer `redacted`.
- [ ] סיים את הקצר → `journey_assessment_completed`; הירשם → `journey_assessment_registered`.
- [ ] (אם רכשת) המשך לאבחון הארוך וענה כמה שאלות → בעמוד האדמין מופיעים "התחיל ארוך" ונשירה ב-"אבחון ארוך".
- [ ] עמוד `/dashboard/journey/assessment-funnel`: המשפך מציג את הריצה; שתי טבלאות הנשירה (קצר/ארוך); RTL/מובייל תקין.

---

## הגדרת "סיום" (Definition of Done)

המוצר שלם כש: כל תיבות חלק ג' מסומנות, ואתה רואה בעמוד האדמין ריצת-אבחון אמיתית מתורגמת למשפך מלא — מהכניסה ועד הזמנת הפרטנר וצפייה בפרק הראשון — עם הפילוחים לפי יום/שבוע וסינון התאריכים.
