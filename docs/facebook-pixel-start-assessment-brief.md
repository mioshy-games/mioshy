# בריף עבודה: הוספת אירוע `StartAssessment` (תחילת אבחון) — Meta Pixel

**עבור:** Claude Code (סוכן הפיתוח)
**מנסח / מפקח:** Itzik
**תאריך:** 2026-06-23
**הקשר:** השלמה לבריף `docs/facebook-pixel-work-order.md`. כל ההחלטות הנעולות שם תקפות גם כאן.

---

## 1. מטרה

להוסיף אירוע אחד שחסר במשפך: **`StartAssessment`** — תחילת האבחון הקצר. זה רובד הביניים בין Landing Page View לבין `CompleteAssessment`, ומאפשר:
- אבחון נזילות (כמה מתחילים מול כמה מסיימים).
- קהל רימרקטינג "התחיל ולא סיים".
- רובד אופטימיזציה ביניים אם נרצה.

---

## 2. החלטות נעולות

- **שם האירוע:** `StartAssessment` — אירוע **custom** (כמו `CompleteAssessment`), נשלח דרך `metaTrackCustom`.
- **שכבה:** Browser בלבד. **בלי CAPI** — בדיוק כמו `CompleteAssessment` (אירוע engagement בראש משפך, לא רכישה).
- **פרמטר:** `{ assessment_type: "journey_short" }` — זהה ל-`CompleteAssessment` לעקביות.
- **יורה פעם אחת בלבד** לכל מילוי אבחון — לא בכל re-render, לא בכל refresh.
- **בלי UI חדש, בלי PII** — הכל עובר דרך `metaTrackCustom` שכבר מטפל ב-redaction של URL רגיש, DNT, ו-buffering עד שהפיקסל מוכן.

---

## 3. עיגון בקוד

קובץ: **`components/journey/JourneyClient.tsx`**, לצד ה-effect הקיים של `CompleteAssessment` (סביב שורות 233-239).

**מתי לירות:** כשהמשתמש **באמת מתחיל** את האבחון — כלומר ענה על השאלה הראשונה (`index` עבר מ-0 ל-≥1) בזמן ש-`!isDone`. זה מבדיל "תחילת אבחון" אמיתית מסתם צפייה בדף (שכבר נספרת כ-LPV/PageView).

**לא** לירות על mount בלבד (זה יהיה כפילות של LPV). **כן** על האינטראקציה הראשונה.

הצעת מימוש (לפי הדפוס הקיים עם `useRef`):

```tsx
const startAssessmentFiredRef = useRef(false);
useEffect(() => {
  // מתחיל = ענה על השאלה הראשונה, ועדיין לא סיים
  if (!isDone && index >= 1 && !startAssessmentFiredRef.current) {
    startAssessmentFiredRef.current = true;
    metaTrackCustom("StartAssessment", { assessment_type: "journey_short" });
  }
}, [isDone, index]);
```

> אם מסתבר שיש משתמשים שחוזרים באמצע אבחון (index כבר ≥1 ב-mount) — לוודא שעדיין יורה פעם אחת בלבד, וזה בסדר: "התחיל" נכון גם עבורם. אם רוצים דיוק מלא לסשן, אפשר localStorage guard כמו ב-confetti, אבל לא חובה.

---

## 4. מטא — צד Itzik (לא קוד)

לרשום ב-**Events Manager → Custom Conversions / Custom Events** את `StartAssessment` כדי שיהיה בחיר כאירוע אופטימיזציה ובניית קהלים. (בדיוק כמו שנעשה ל-`CompleteAssessment`.)

---

## 5. QA / Definition of Done

1. **Test Events:** ענייה על השאלה הראשונה ב-`/journey/assessment` → `StartAssessment` מופיע מיד, עם `assessment_type: "journey_short"`.
2. **יורה פעם אחת:** מענה על שאלות נוספות / refresh של הדף לא יורה שוב.
3. **לא יורה בסיום בלבד:** מי שמגיע ישר למסך סיכום (`isDone`) לא מייצר `StartAssessment`.
4. **dev:** אפס בקשות פיקסל ברשת (prod-only, כמו שאר האירועים).
5. בלי רגרסיית perf/layout במובייל.

---

## 6. מחוץ לסקופ

- בלי CAPI לאירוע הזה.
- בלי שינוי ל-`CompleteAssessment` הקיים.
- בלי אירוע מקביל לאבחון הארוך (`/assessments/`) — רק האבחון הקצר בראש המשפך.
