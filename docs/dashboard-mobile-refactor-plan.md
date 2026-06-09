# דשבורד אדמין — שיפוץ מובייל-פירסט + שכבת AI

מסמך תכנון, שלב 1. branch יעד: `dashboard/mobile-refactor`. כל שלב = PR נפרד.

## 1. מפת כל הדפים תחת `/dashboard/*`

הניווט כיום בנוי כ-10 קבוצות ב-`components/dashboard/Sidebar.tsx`. במובייל יש רק תפריט המבורגר (Sheet), בלי bottom nav. סה"כ ~90 קבצי `page.tsx`.

### סקירה
- `/dashboard` — דף הבית של האדמין.

### ליווי (Coaching)
- `/dashboard/help` — עזרה.
- `/dashboard/coaching-guide` — מדריך ליווי.
- `/dashboard/clinician` — התור היומי.
- `/dashboard/my-clients` · `/[coupleId]` · `/[coupleId]/timeline-import` — הזוגות שלי + כרטיס זוג + ייבוא טיימליין.
- `/dashboard/coach-profile` — הפרופיל שלי.
- `/dashboard/coach-library` — הספרייה שלי.
- `/dashboard/experts` *(אדמין)* — מומחים.
- `/dashboard/test-users` *(אדמין)* — משתמשי בדיקה.

### משחקים (Games)
- `/dashboard/games` · `/new` · `/[id]/edit` · `/[id]/duplicate` — גלגלים (CRUD + שכפול).
- `/dashboard/questions` · `/import` · `/export` · `/template` — שאלות לגלגל.
- `/dashboard/snakes` — סולמות וחבלים.
- `/dashboard/between-us` — "בינינו" עם CRUD מלא: `categories`, `games` (+`/content`), `promotions`, `tags`, `settings`.

### מסע (Journey) — האזור הגדול ביותר
- `/dashboard/journey` — סקירת מסע.
- `programs` · `categories` (+`subtopics`) · `items` (+`/feedback`) · `assignments` · `clients` (+`/[ownerKey]`) · `groups` · `push` · `match-rules` · `feedback` · `replies` · `expert-messages` · `metrics` · `health` *(אדמין)* · `template` · `import` · `export`.
- `/dashboard/journey-analytics` *(אדמין)* — אנליטיקת מסע.

### שאלונים (Assessments) *(אדמין)*
- `/dashboard/assessments` · `/[assessmentId]`.

### למבוגרים (Adults)
- `/dashboard/adults` עם CRUD מלא: `games` (+`/content`), `categories`, `tags`, `promotions`, `settings`.

### משתמשים (Users)
- `/dashboard/users` · `/[id]` — משתמשי מסע.
- `/dashboard/leads` — לידים.
- `/dashboard/subscriptions` — מנויים.

### שיווק (Marketing)
- `/dashboard/homepage` — עורך עמוד הבית.
- `/dashboard/articles` · `/new` · `/[id]/edit` — מאמרים.
- `/dashboard/templates` · `/[id]` — תבניות אימייל.
- `/admin/content` *(אדמין, מחוץ ל-/dashboard)* — CMS.

### מערכת (System)
- `/dashboard/automation` — אוטומציה.
- `/dashboard/settings` · `/settings/wheel` — הגדרות.

> קבוצת "דוחות" (`report`) קיימת בסיידבר אבל ריקה — אין דפים עדיין.

### פעולות חוזרות לכל הדפים
רשימות (חיפוש, סינון, מעבר לכרטיס), טפסי יצירה/עריכה (CRUD), שכפול, ייבוא/ייצוא CSV, מחיקה, שינוי סטטוס, שליחת הודעה/אימייל לזוג.

## 2. הצעת bottom nav (5 טאבים)

מ-10 קבוצות סייד-בר ל-5 טאבים לפי תדירות שימוש יומי של הצוות:

1. **סקירה** — `/dashboard`
2. **זוגות** — לקוחות הליווי (my-clients + journey/clients), כולל badge להודעות ממתינות. לב התפעול היומי.
3. **מסע** — תוכן ותפעול המסע (items, assignments, replies, programs).
4. **משחקים** — גלגלים, סולמות, בינינו, למבוגרים.
5. **עוד** — Sheet מלא: משתמשים, מנויים, לידים, שיווק, שאלונים, מערכת, הגדרות.

עליון: חזרה + כותרת + Avatar בלבד. שדה "חפש או שאל" יושב מתחת ל-header בכל עמוד. הסייד-בר המלא נשאר ב-`lg:` (דסקטופ).

## 3. POC מומלץ — אזור "הזוגות שלי"

הרשימה (`journey/clients` / `my-clients`) + כרטיס הזוג (`/[ownerKey]`). למה דווקא הוא:
- שם נוחתות כל 3 שכבות ה-AI (חיפוש חכם, סיכום זוג, טיוטת אימייל).
- ממיר טבלה צפופה לכרטיסי אקורדיון — מדגים את דרישת העיצוב המרכזית.
- האזור עם השימוש היומי הגבוה ביותר לצוות הליווי.

## 4. שכבת AI — איפה ואיך
- **חיפוש חכם** — `lib/ai/` כבר קורא ישירות ל-`api.anthropic.com` (בלי תלות npm חדשה). שאילתה בעברית → SQL מסונן מעל endpoints קיימים.
- **סיכום זוג** — מנוע הניתוח הדטרמיניסטי (`lib/journey/analysis.ts`) + `analyze-assessment.ts` כבר קיימים; נשתמש בהם לבלוק הסיכום.
- **טיוטת אימייל** — מבוססת תוצאות השאלון + שם המומחה, ניתנת לעריכה לפני שליחה.

## אילוצים
schema לא משתנה · endpoints לא משתנים (רק UID) · בלי תלות npm חדשה (AI דרך fetch קיים) · מובייל בלבד, דסקטופ לא נגעים בלי אישור · `/journey` של המשתמש לא נגעים.
