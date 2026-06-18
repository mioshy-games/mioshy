# בדיקה מקומית — אנליטיקה התנהגותית, שלבים 0+1

> **למי זה מיועד:** Itzik. צעד-אחר-צעד, בלי הנחות ידע. כל מה שצריך כאן.
> **מה בודקים:** ששלבים 0+1 עובדים מקצה-לקצה במחשב שלך — שאירועי ההתנהגות
> (כניסה למשחק, זמן שהייה, נטישה, היסטוריית כניסות) באמת נכתבים לבסיס הנתונים.
> **חשוב:** הכל מקומי. שום דבר לא עולה לפרודקשן. לא נוגעים בכלום באתר החי.

---

## מילון מונחים קצר (כדי שלא נתבלבל)

- **טרמינל / Terminal** — חלון שחור להקלדת פקודות. במק: פותחים מ-Spotlight
  (⌘+רווח) → להקליד `Terminal` → Enter.
- **ענף (branch)** — גרסה של הקוד. הקוד החדש יושב בענף `feat/analytics-phase0`.
- **Supabase Dashboard** — אתר הניהול של בסיס הנתונים, בכתובת
  https://supabase.com/dashboard . מתחברים עם החשבון שלך.
- **SQL Editor** — מסך ב-Supabase שבו מדביקים שאילתה ולוחצים Run כדי לראות
  נתונים. כל הבדיקות כאן רצות שם (ולא באתר עצמו — בכוונה, מטעמי אבטחה).

---

## חלק 1 — הכנת הסביבה המקומית

### 1.1 לפתוח טרמינל ולהיכנס לתיקיית הפרויקט
העתק־הדבק שורה-שורה, Enter אחרי כל אחת:

```bash
cd /Users/uxellent/mioshy
```

### 1.2 לעבור לענף הנכון
```bash
git checkout feat/analytics-phase0
```
לאמת שאתה על הענף הנכון:
```bash
git branch --show-current
```
**צריך להופיע בדיוק:** `feat/analytics-phase0`
אם הופיע משהו אחר — עצור ופנה אליי.

> ⚠️ **לא להריץ `npm install` ולא `pnpm install`.** ה-`node_modules` כבר
> קיים ותקין; התקנה מחדש עלולה להשחית אותו. פשוט דלג על זה.

### 1.3 לוודא ש-.env.local מצביע ל-Supabase הנכון
מציגים את כתובת ה-Supabase שאליה האפליקציה מחוברת (זה לא חושף סיסמאות):
```bash
grep NEXT_PUBLIC_SUPABASE_URL .env.local
```
**מה צריך לקרות:** מודפסת שורה כמו
`NEXT_PUBLIC_SUPABASE_URL=https://XXXXXXXX.supabase.co`

עכשיו פתח את https://supabase.com/dashboard , בחר את הפרויקט, ולמעלה תחת
**Project Settings → Data API** (או בכתובת הדפדפן) ודא שה-`XXXXXXXX` תואם.
**זה הפרויקט שבו נחפש את הנתונים בהמשך.** אם זה לא הפרויקט שציפית — עצור
ופנה אליי (לא רוצים לבדוק מול בסיס נתונים לא נכון).

### 1.4 להפעיל את האתר מקומית
```bash
npm run dev
```
- כעבור כמה שניות תופיע שורה כמו `Local: http://localhost:3000`.
- **כתובת האתר המקומי שלך: http://localhost:3000**
- השאר את חלון הטרמינל הזה **פתוח ורץ** כל זמן הבדיקה. כדי לעצור בסוף:
  ללחוץ באותו חלון `Ctrl+C`.

> טיפ: אם פורט 3000 תפוס, Next יבחר 3001 ויודיע בשורת ה-`Local:`. תמיד
> תשתמש בכתובת שמודפסת שם.

### 1.5 להיכנס לאתר עם חשבון
פתח בדפדפן: **http://localhost:3000/he** והתחבר עם חשבון שלך.
חלק מהבדיקות (מבוגרים, ליווי) דורשות חשבון מחובר עם גישה לתוכן.

---

## חלק 2 — הרצת מיגרציה 130 (טבלת היסטוריית הכניסות)

המיגרציה יוצרת טבלה חדשה בשם `auth_login_events`. מריצים אותה **פעם אחת**,
דרך ה-SQL Editor של Supabase.

1. היכנס ל-https://supabase.com/dashboard → בחר את הפרויקט (אותו אחד מסעיף 1.3).
2. בתפריט הימני לחץ **SQL Editor** → **New query**.
3. העתק את כל הבלוק הבא, הדבק בעורך, ולחץ **Run** (או ⌘+Enter):

```sql
CREATE TABLE IF NOT EXISTS auth_login_events (
  id           uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id    text,
  device_info  jsonb        NOT NULL DEFAULT '{}',
  country      text,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_login_events_user_time_idx ON auth_login_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_login_events_time_idx      ON auth_login_events(created_at DESC);

ALTER TABLE auth_login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_login_events_select_service" ON auth_login_events;
CREATE POLICY "auth_login_events_select_service"
  ON auth_login_events
  FOR SELECT
  TO service_role
  USING (true);
```

**Definition of done (סעיף 2):** מתחת לעורך מופיע `Success. No rows returned`.
לאימות שהטבלה נוצרה, הרץ:
```sql
select count(*) from auth_login_events;
```
צריך לחזור `0` (טבלה ריקה — עדיין לא נכנסנו). אם חזרה שגיאה
`relation "auth_login_events" does not exist` — המיגרציה לא רצה, חזור על השלב.

---

## חלק 3 — תרחישי הבדיקה

> **איך עובדת הבדיקה:** עושים פעולה באתר המקומי (http://localhost:3000),
> ואז רצים שאילתת SQL ב-Supabase SQL Editor ובודקים שהשורות נכתבו.
>
> **שתי נקודות שחוסכות בלבול:**
> 1. אירוע נכתב כמה שניות אחרי הפעולה. אם שאילתה חזרה ריקה — חכה 5–10 שניות,
>    הרץ שוב.
> 2. **זמן שהייה (dwell)** נשלח: heartbeat כל 15 שניות, וגם ברגע שעוזבים
>    את העמוד. כדי לראות אותו בוודאות — **שב על העמוד לפחות 20 שניות** ואז
>    עזוב (נווט לעמוד אחר או סגור את הטאב).
> 3. בונוס (לא חובה): פתח ב-Chrome את DevTools (⌥⌘I) → לשונית **Console**.
>    בזמן אמת יודפסו שם שורות `[analytics] game_start ...` וכו' — אישור מיידי
>    שהאירוע נורה מהדפדפן.

---

### תרחיש A — משחק גלגל: `game_start` + `dwell` + `game_abandoned`

**כתובת:** http://localhost:3000/he/games/truth-or-dare

**מה לעשות:**
1. ודא שאתה מחובר (חלק 1.5).
2. היכנס לכתובת. המתן שהגלגל ייטען.
3. **סובב את הגלגל לפחות פעם אחת** (לחיצה על כפתור הסיבוב). ← זה מה ששולח
   `game_start`.
4. **השאר את העמוד פתוח לפחות 20 שניות.** אפשר לסובב עוד פעם-פעמיים.
5. **עזוב את העמוד** — לחץ על קישור אחר באתר או סגור את הטאב. ← זה מה ששולח
   `game_abandoned`.

**שאילתה (להעתיק ל-SQL Editor):**
```sql
select event,
       properties->>'game_slug'   as game_slug,
       properties->>'duration_ms' as duration_ms,
       properties->>'ms'          as dwell_ms,
       properties->>'pillar'      as pillar,
       created_at
from analytics_events
where properties->>'path' like '%/games/truth-or-dare%'
order by created_at desc
limit 20;
```

**Definition of done:** מופיעות שלוש סוגי שורות (החדשות ביותר למעלה):
- `game_start` עם `game_slug = truth-or-dare`.
- לפחות שורת `dwell` אחת עם `pillar = games` ו-`dwell_ms` מספר (למשל ~15000+).
- `game_abandoned` עם `duration_ms` גדול מ-0.

---

### תרחיש B — משחק מבוגרים: `adult_game_opened` + `dwell`

**כתובת:** http://localhost:3000/he/mioshy-sex/date-night/play
(אם `date-night` לא קיים אצלך, היכנס ל-http://localhost:3000/he/mioshy-sex ,
בחר משחק כלשהו שיש לך גישה אליו, ולחץ "התחל לשחק" — תגיע לעמוד `/play`.)

> ⚠️ עמוד ה-`/play` דורש: חשבון מחובר + זוג (couple) + בעלות על המשחק
> (או מנוי ליווי פעיל). אם הופנית בחזרה לעמוד השיווקי — סימן שלחשבון אין
> גישה למשחק הזה. השתמש בחשבון שיש לו גישה, או בחר משחק שבבעלותך.

**מה לעשות:**
1. היכנס לכתובת ה-`/play`.
2. **השאר פתוח לפחות 20 שניות**, גלול קצת.
3. עזוב את העמוד.

**שאילתה:**
```sql
select event,
       properties->>'slug'    as slug,
       properties->>'game_id' as game_id,
       properties->>'pillar'  as pillar,
       properties->>'ms'      as dwell_ms,
       created_at
from analytics_events
where properties->>'path' like '%/mioshy-sex/%/play%'
order by created_at desc
limit 20;
```

**Definition of done:**
- שורת `adult_game_opened` עם `slug` של המשחק ו-`game_id` (מזהה ארוך).
- לפחות שורת `dwell` אחת עם `pillar = adults`.

---

### תרחיש C — פרק בליווי: `dwell`

הכתובת של פרק היא אישית (משתנה לכל פרק/משתמש), אז מגיעים אליה דרך ניווט:

**מה לעשות:**
1. היכנס ל-http://localhost:3000/he/my (לוח הליווי).
2. פתח פרק כלשהו מהציר/הרשימה. כעת בשורת הכתובת של הדפדפן תופיע כתובת בסגנון
   `http://localhost:3000/he/journey/timeline/XXXXXXXX` (ה-`XXXX` הוא מזהה הפרק).
3. **השאר את הפרק פתוח לפחות 20 שניות.**
4. עזוב את העמוד.

**שאילתה:**
```sql
select event,
       properties->>'pillar'  as pillar,
       properties->>'item_id' as scheduled_item_id,
       properties->>'ms'      as dwell_ms,
       created_at
from analytics_events
where event = 'dwell' and properties->>'pillar' = 'journey'
order by created_at desc
limit 20;
```

**Definition of done:** לפחות שורת `dwell` אחת עם `pillar = journey` ו-`item_id`
מלא (מזהה הפרק שפתחת).

---

### תרחיש D — התחברות מחדש: שורה ב-`auth_login_events` עם `device_info = {ua}` בלבד

**מה לעשות:**
1. באתר המקומי, **התנתק** (Logout).
2. **התחבר מחדש** עם החשבון שלך (אימייל + סיסמה).

**שאילתה:**
```sql
select user_id, device_id, device_info, country, created_at
from auth_login_events
order by created_at desc
limit 5;
```

**Definition of done:**
- מופיעה שורה חדשה עם `created_at` של עכשיו.
- `device_info` מכיל **אך ורק** מפתח `ua`, למשל:
  `{"ua": "Mozilla/5.0 ... Chrome/..."}`.
- **חובה: אין מפתח `ip`** ב-`device_info`. אם יש שם `ip` כלשהו — זו כשלון
  (תקלת פרטיות), עצור ודווח לי.
- `device_id` מלא (מזהה ארוך). `country` יכול להיות ריק (null) בבדיקה מקומית —
  זה תקין (אין כותרת מדינה ב-localhost).

---

### תרחיש E — מינימום 5 שניות: פתיחה-סגירה מהירה → **אין** dwell

מוודאים שכניסה בטעות (פחות מ-5 שניות) לא נספרת כביקור.

**מה לעשות:**
1. קודם הרץ את השאילתה הבאה ורשום לעצמך את ה-`created_at` העליון (האחרון):
```sql
select created_at, properties->>'pillar' as pillar
from analytics_events
where event = 'dwell'
order by created_at desc
limit 1;
```
2. עכשיו היכנס ל-http://localhost:3000/he/games/truth-or-dare ו**עזוב תוך
   2–3 שניות** (אל תסובב, אל תתעכב).
3. חכה ~10 שניות, והרץ שוב את אותה שאילתה.

**Definition of done:** ה-`created_at` העליון **לא השתנה** — כלומר לא נוספה
שורת `dwell` חדשה מהביקור המהיר. (ביקור מתחת ל-5 שניות מסונן בכוונה.)

---

## חלק 4 — טבלת סיכום: מה רואים / מה זה אומר / עבר או נכשל

| # | תרחיש | מה רואים בשאילתה | מה זה אומר | ✅ עבר / ❌ נכשל |
|---|---|---|---|---|
| A | גלגל | `game_start` (truth-or-dare) + ≥1 `dwell` (games) + `game_abandoned` (duration_ms>0) | המשחקים שולחים התחלה, זמן שהייה ונטישה — כולל הגלגל שלא שלח כלום קודם | עבר אם כל 3 קיימים |
| B | מבוגרים | `adult_game_opened` (slug+game_id) + ≥1 `dwell` (adults) | עמוד המבוגרים, שלא נמדד כלל קודם, מדווח פתיחה + זמן שהייה | עבר אם 2 הסוגים קיימים |
| C | ליווי | ≥1 `dwell` (journey) עם item_id של הפרק | נוסף אות זמן-השהייה לפרק (פתיחה/השלמה כבר נמדדו קודם) | עבר אם יש dwell journey |
| D | התחברות | שורה חדשה ב-`auth_login_events`, `device_info={"ua":...}` בלבד, **בלי ip** | היסטוריית כניסות עובדת ושומרת מטא-דאטה בלבד (פרטיות גישה א') | עבר רק אם אין `ip` |
| E | מינ' 5ש' | אין שורת `dwell` חדשה אחרי ביקור של 2–3ש' | כניסות-בטעות מסוננות, לא מזהמות את הנתונים | עבר אם לא נוספה שורה |

---

## חלק 5 — אם משהו לא עבד

| תופעה | בדיקה / פתרון |
|---|---|
| השאילתה חוזרת ריקה | חכה 5–10 שניות והרץ שוב; ודא שעשית את הפעולה באתר ה**מקומי** (localhost), לא באתר החי. |
| שגיאה `relation "auth_login_events" does not exist` | מיגרציה 130 לא רצה — חזור לחלק 2. |
| עמוד `/play` מקפיץ אותי החוצה | לחשבון אין גישה למשחק — השתמש בחשבון עם בעלות/מנוי, או בחר משחק אחר. |
| `device_info` מכיל `ip` | **כשל פרטיות** — עצור ודווח לי. |
| הגלגל לא נטען / אין כפתור סיבוב | ודא שהאתר רץ (חלון הטרמינל מסעיף 1.4 פתוח) ושאתה מחובר. |
| אני בכלל לא רואה אירועים בקונסול | פתח DevTools → Console; ודא שאין חוסם פרסומות שמבלוק `/api/analytics`. |

---

## חלק 6 — סיום

- לעצור את האתר המקומי: בחלון הטרמינל מסעיף 1.4, `Ctrl+C`.
- **שום דבר מהבדיקה הזו לא משפיע על האתר החי.** מיגרציה 130 רצה על ה-Supabase
  שהגדרת ב-1.3 בלבד.
- כשכל 5 התרחישים מסומנים ✅ — שלבים 0+1 מאומתים, ואפשר לאשר מעבר לשלב 2
  (Views לדשבורד).
