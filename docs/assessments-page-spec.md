# מפרט טכני — עמוד "אבחונים" (Assessments Hub)

> מסמך אפיון למפתח. מתאר איך לבנות עמוד אבחונים חדש שבו כל אבחון הוא שאלון של ~20 שאלות בנושא ממוקד, **תוך שימוש חוזר מלא במנוע האבחון הקיים** (אבחון ה-Journey). הזרימה, לוגיקת התשובות, איסוף הפרטים, וזרימת ה-AI — זהים לקיים. ההבדל היחיד: יש כמה אבחונים נושאיים במקום אחד, וכל אחד מסומן ב-`assessment_id`.
>
> תאריך: 2026-06-07 · גרסת בסיס: questionnaire.json v7 · מצב: אפיון, לפני פיתוח.

---

## 1. מטרה ותמונה כללית

היום קיים אבחון יחיד (אבחון ה-Journey) שמוביל את הזוג דרך שאלון, מחשב ניתוח, ובסוף מציג מסך תוצאות עם הנעה לפעולה (CTA) להצטרף לתוכנית הליווי. אנחנו רוצים להוסיף **עמוד אבחונים** — רשימת אבחונים נושאיים. כל אבחון:

- מכיל ~20 שאלות בנושא ממוקד.
- הנושאים בשלב ראשון: **מיניות ואינטימיות**, **עד כמה אתם תואמים כזוג**, **חברות ותקשורת**, **משפחתיות**.
- עובר בדיוק את אותה זרימה כמו האבחון הקיים: שאלות → איסוף פרטים → הרשמה בסוף → ניתוח → מסך תוצאות מבוסס-AI שמזהה את הכאב, נותן פתרון, ומזמין להצטרף לתוכנית הליווי.

**עיקרון מנחה:** לא בונים מנוע חדש. מרחיבים את הקיים בעזרת מזהה `assessment_id`. כל אבחון הוא "בנק שאלות" עם אותה סכמה, ועובר דרך אותם `analysis.ts`, `analyze-assessment.ts`, ה-routes ורכיבי ה-UI.

---

## 2. איך עובד האבחון הקיים (בסיס שצריך להכיר)

המפתח חייב להבין את הזרימה הקיימת לפני שמרחיב אותה. כל הקבצים הבאים קיימים בריפו:

### 2.1 מקור האמת לשאלות
`journey/questionnaire.json` (נטען דרך `lib/journey/questions.ts`). מבנה הקובץ:

```jsonc
{
  "version": 7,
  "gating": { "auth_after_index": 28, "paywall_after_index": 99 },
  "total_questions": 28,
  "locales": ["he", "en"],
  "likert_labels": {
    "he": ["בכלל לא","לעיתים רחוקות","לפעמים","לעיתים קרובות","כמעט תמיד"],
    "en": ["Not at all","Rarely","Sometimes","Often","Almost always"]
  },
  "questions": [ /* מערך של 28 שאלות */ ]
}
```

- **`gating.auth_after_index`** — האינדקס (אפס-בסיס) שאחריו נדרשת הרשמה. כיום `28` בפועל אומר: כל 28 השאלות פתוחות לאנונימי, וההרשמה נדרשת רק **בסוף**, לפני מסך התוצאות.
- **`gating.paywall_after_index`** — האינדקס שאחריו נדרש מנוי פעיל. כיום `99` = מנוטרל. **כל האבחון חינמי** ומשמש כ-lead magnet. אל תשנה את זה באבחונים החדשים — שמירה על חינמי-עד-הסוף קריטית למשפך.

### 2.2 סכמת שאלה
מוגדרת ב-`lib/journey/types.ts`. שדות משותפים: `id`, `category` (`free`/`registered`/`paid`), `domain` (אחד מ-5 התחומים או `null`), `axes` (`[{axis, weight}]`), `purpose`, `insight`. סוגי שאלות:

| `type` | שדות ייחודיים | צורת התשובה ב-JSONB |
|---|---|---|
| `likert5` | `he`, `en` (טקסט השאלה) | `{kind:"likert", value:1..5}` |
| `forced_choice` / `single_choice` | `he_prompt`, `en_prompt`, `options[]` | `{kind:"single", option:"<id>"}` |
| `multi_choice` | כנ"ל | `{kind:"multi", options:["<id>",...]}` |
| `reflection` | `he_prompt`, `en_prompt`, `max_length` | `{kind:"text", text:"..."}` |
| `ranking` | `he_prompt`, `en_prompt`, `categories[]` | `{kind:"ranking", order:["<key>",...]}` |

כל `option` נושא `scores: [{axis, weight}]`. שאלת `likert5` נושאת `axes` ברמת השאלה (ה-weight יכול להיות שלילי כדי להפוך כיוון).

### 2.3 התחומים והצירים
5 תחומי-מוצר (`Domain`): `communication`, `intimacy`, `emotional_connection`, `friendship`, `family`. כל שאלה משויכת לתחום אחד (או `null` לשאלות דמוגרפיות/מטא). מתחת לתחומים יש ~20 צירים מדויקים (`Axis`) ממודל Gottman + שפות אהבה + צירי תשוקה (למשל `repair`, `four_horsemen_contempt`, `passion_play`, `love_language_touch`). הצירים הם מה שמחושב בפועל; התחומים הם רק קיבוץ לתצוגה ולניקוד הקטגוריות.

### 2.4 איסוף פרטים — מתי ואילו
הפרטים נאספים **כשאלות בתוך השאלון עצמו**, לא בטופס נפרד. בקיים הם מופיעים מוקדם (אינדקסים 2–5), כולם `category:"free"`, `axes: []` (לא מנקדים):

| `id` | `type` | יעד |
|---|---|---|
| `q_gender` | `forced_choice` (`female`/`male`/`other`) | נשמר ל-`profiles.gender`. אם המשתמש מחובר — מיד; אם אנונימי — מתמלא ברגע שה-journey "נתבע" ע"י המשתמש בהרשמה (backfill). |
| `q_relationship_status` | `forced_choice` | נשמר ב-`journey_responses` כתשובה. |
| `q_relationship_years` | `forced_choice` | משמש את ה-AI כ-`relationship_years_label`. |
| `q_kids_count` | `forced_choice` (`domain:"family"`) | משמש את ה-AI כ-`kids_count_label`. |

**שאר הפרטים האישיים** (שם, אימייל, סיסמה, נייד) נאספים **בסוף**, במסך ההרשמה (`InlineAuthStep`), אחרי שכל השאלות נענו ולפני שמראים את הניתוח. השם נשלף מ-`profiles.full_name` ומוזרק ל-AI.

### 2.5 ניהול זהות ו-state
- אנונימי: כל תשובה נשמרת לפי `device_id` (cookie `mioshy_device_id`) → שורת `journeys` עם `device_id` ו-`user_id=null`. ב-refresh/חזרה משחזרים `current_step` והתשובות.
- בהרשמה בסוף: ה-journey האנונימי "נתבע" — `user_id` מתעדכן, `device_id` מתאפס, ו-`q_gender` עושה backfill ל-`profiles`.
- יש לוגיקת התאוששות מרובה ל-race conditions של post-signup (ראה `app/[locale]/journey/assessment/page.tsx`). **כל הלוגיקה הזו נשמרת כפי שהיא** — היא לא תלויה בנושא האבחון.

### 2.6 הטבלאות
- **`journeys`** — `id, user_id, device_id, language, status, current_step, last_activity_at, completed_at`. `status ∈ {in_progress, paywall, complete}` (שים לב: נכתב `complete` יחיד; קוד קורא חייב לקבל גם `completed` ישן).
- **`journey_responses`** — `journey_id, question_id, answer (JSONB), locale`. ייחודיות על `(journey_id, question_id)` → upsert.
- **`journey_analysis`** — `journey_id, user_id, axis_scores, friendship_score, conflict_health, passion_risk, primary_love_language, secondary_love_language, top_gap, four_horsemen_flag, summary (JSONB), computed_at`.
- **`journey_user_priorities`** — נכתב מ-side-effect של שאלת ה-`ranking`.
- **`activity_logs`** — audit לכל `answer_saved`.

### 2.7 ה-routes
- **`POST /api/journey/answer`** — מאמת את צורת התשובה מול סוג השאלה, מוצא/יוצר `journey`, עושה upsert ל-`journey_responses`, מקדם `current_step`, אוכף gating (auth/paywall), מבצע side-effects (`q_gender`→profile, `q_priorities`→cadence), ובשאלה האחרונה מחשב את הניתוח ושומר ל-`journey_analysis`. **קריטי:** אימות auth דרך session-client אבל כל הכתיבות דרך admin-client (workaround ל-RLS/JWT flaky — ראה memory `project_supabase_ssr_rls_pattern`).
- **`GET /api/journey/analyze`** — מחזיר את הניתוח האחרון של המשתמש.
- **`POST /api/journey/analyze`** — מחשב מחדש את הניתוח, מריץ את ה-AI hero, ושומר.

### 2.8 מנוע הניתוח הדטרמיניסטי
`lib/journey/analysis.ts` — `analyze(responses, priorityLabels)`:
1. `scoreResponses` → ממפה כל תשובה לצירים (likert מנורמל 0..1 לפי weight; choice לפי scores של ה-option).
2. גוזר: `friendship_score`, `conflict_health`, `passion_risk`, `primary/secondary_love_language`, `top_gap`, `four_horsemen_flag`.
3. `computeCategoryScores` → צרור 5 קטגוריות (0..100, גבוה=בריא) + `lowest_key` (התחום החלש ביותר, מוצג כ"ההמלצה שלנו להתחיל ב..."). יש override מיוחד: אם נענתה `q20b_intimacy_satisfaction`, ה-Likert הישיר שלה תורם 60% לציון ה-intimacy.
4. `generateSummary` → נרטיב + המלצות + תוויות פוקוס. **אין כאן ML ואין קריאות רשת — דטרמיניסטי, זול, ניתן לבדיקה.**

### 2.9 שכבת ה-AI (זיהוי הכאב + הזמנה לליווי)
`lib/ai/analyze-assessment.ts` — `analyzeAssessment(inputs)`, מודל `claude-sonnet-4-6`.

**קלט (`buildUserPayload`):** תוצאת הניתוח הדטרמיניסטי + שדות ממוקדים:
- רפלקציות טקסט: `q20c_what_hurts` (מה הכי כואב), `q22a_success_signal` (מה חסר שאם ייפתר ישנה את הזוגיות).
- אותות Likert: `q20a_urgency_now`, `q20b_intimacy_satisfaction`.
- `category_scores`, `top_priority`, `top_gap`, `four_horsemen_flag`, `primary_love_language`.
- פרטים: `user_name`, `gender`, `relationship_years`, `kids_count`.

**זיהוי הכאב — סדר עדיפות (מקודד ב-system prompt):**
1. אם `q20c` מולא בטקסט → שם הכאב מפורש. בונים תועלות שמרפאות אותו ישירות. `pain_signal="reflection"`.
2. אם `q22a` מולא → תרגום ישיר לתועלות. האות החזק ביותר להתאמה אישית. `pain_signal="reflection"`.
3. אחרת `four_horsemen_flag=true` → `pain_signal="horsemen"`.
4. אחרת לפי `top_priority`+`top_gap` → `pain_signal="top_priority"`.
5. אחרת לפי הציונים → `pain_signal="scores"`.

**פלט (`AiHeroBlock`):** `hero_he`/`hero_en` (ערימת תועלות, 22–45 מילים), `recommendations_he/en` (3 תועלות), `expert_mentioned` (האם להזכיר מומחה צמוד), `pain_signal`, מטא (model/latency).

**חוקי קול קשיחים:** לשון תועלת עתידית בלבד ("תקבלו/תרגישו/תתאהבו"), אסור לתאר תהליך, הבטחות זמן מעורפלות בלבד ("מהר מאוד", אסור "תוך שבוע"), בלי מקף ארוך, בלי "אנחנו רואים"/"מסע"/"טרנספורמציה", בלי לצטט מומחים בשם.

**עמיד לכשל:** הפונקציה **לעולם לא זורקת** — מחזירה `null` בכל כשל (חוסר API key, parse error, rate limit). במקרה כזה מסך התוצאות נופל חזרה לנרטיב הדטרמיניסטי.

### 2.10 מסך התוצאות + ה-CTA לליווי
`components/journey/AnalysisSummary.tsx`. הסדר: גרף 5 העמודות (`CategoryBarChart`) → hero תועלות מ-AI → "מה תקבלו בליווי" (bullets מ-AI) → gains → topics → who-for → סקשן מומחה → `OfferCard`. ה-CTA קורא `POST /api/billing/checkout/create` עם `plan:"weekly"`, `product:"journey"`, `source:"analysis_summary"`, `return_path:"/<locale>/my"`. אם אין משתמש → מפנה ל-signup עם `next` חזרה. אם כבר מנוי → `ActiveSubscriberCard`.

### 2.11 ה-orchestrator והעמוד
- `components/journey/JourneyClient.tsx` — state machine: `index`, auto-advance אופטימי ל-likert/single/forced, חשיפת social-proof בין שאלות, interstitials, confetti בסיום, כפתור חזרה, fetch ניתוח בסיום, מסך הרשמה אם `isDone && !authenticated`.
- `app/[locale]/journey/assessment/page.tsx` — טוען progress + subscription, intro/pact gate, שחזור אנונימי, post-purchase guard (משתמש מנוי שסיים → redirect ל-`/my/journey`).

---

## 3. השינוי: מושג ה-`assessment_id`

כל המנגנון לעיל נשאר. מוסיפים ממד אחד: **לאיזה אבחון שייכת שורת ה-state**.

### 3.1 הגדרת קטלוג האבחונים
קובץ חדש `lib/assessments/catalog.ts` (או הרחבת `questions.ts`). מגדיר רשימת אבחונים:

```ts
export interface AssessmentDef {
  id: string;            // slug יציב, נכתב ל-DB: "intimacy" | "compatibility" | "communication" | "family"
  he_title: string;      // "מיניות ואינטימיות"
  en_title: string;
  he_tagline: string;    // משפט תיאור קצר לכרטיס בעמוד ה-hub
  en_tagline: string;
  icon?: string;         // אופציונלי לעיצוב הכרטיס
  questionnaire: Questionnaire; // אותו schema כמו היום, ~20 שאלות
}
```

ארבעת האבחונים הראשונים (תוכן השאלות יסופק בנפרד — כאן רק המבנה):

| `id` | כותרת | נושא | מספר שאלות |
|---|---|---|---|
| `intimacy` | מיניות ואינטימיות | חיים מיניים, מגע, קרבה פיזית, רצון | ~20 |
| `compatibility` | עד כמה אתם תואמים כזוג | ערכים, סגנונות, ציפיות, חזון משותף | ~20 |
| `communication` | חברות ותקשורת | איך מדברים, מקשיבים, פותרים אי-הסכמות, כיף משותף | ~20 |
| `family` | משפחתיות | הורות, משפחה מורחבת, לחצים חיצוניים, חלוקת עומס | ~20 |

### 3.2 מבנה בנק שאלות לכל אבחון (20 שאלות)
לכל אבחון מומלץ אותו "שלד" של 20 שאלות שמבטיח שגם הניתוח הדטרמיניסטי וגם ה-AI יקבלו את האותות שהם צריכים:

1. **2–4 שאלות פרטים** (`free`, `axes:[]`) — `q_gender`, `q_relationship_years`, `q_kids_count` ועוד לפי הצורך. *ניתן לדלג עליהן אם המשתמש כבר ענה אותן באבחון קודם* (ראה §6.3).
2. **~12 שאלות `likert5`** ממוקדות נושא — נושאות `axes` עם הצירים הרלוונטיים לנושא. למשל באבחון `intimacy`: `passion_play`, `passion_anticipation`, `love_language_touch`, `passion_autonomy`.
3. **שאלת `single_choice` של "הפער הגדול"** — מקבילה ל-`q20_biggest_gap`, אופציות עם `scores` שמכוונות לצירים.
4. **שאלות אות-כאב** — `q_urgency_now` (likert), שאלת שביעות-רצון נושאית (likert, מקבילה ל-`q20b`).
5. **2 שאלות `reflection`** — מקבילות ל-`q20c_what_hurts` ו-`q22a_success_signal`. **אלה הקלט החשוב ביותר ל-AI.** השמות חייבים להיות עקביים כדי שה-AI יקרא אותם (ראה §7.2).
6. **שאלת `ranking`** אחרונה (`registered`) — דירוג עדיפויות. *אופציונלי לאבחונים הנושאיים — ראה החלטות פתוחות §11.*

> סכום: ~20. ההתפלגות גמישה, אבל **חובה** לכלול את שתי הרפלקציות ואת שאלת הדחיפות, כי זרימת ה-AI נשענת עליהן.

### 3.3 שינוי DB
מיגרציה חדשה (המספר הבא ברצף; האחרונה שראיתי היא `106`):

```sql
-- הוספת assessment_id לשורות ה-state. ברירת מחדל 'journey' לשמירת תאימות
-- לכל השורות הקיימות (האבחון המקורי).
ALTER TABLE journeys        ADD COLUMN assessment_id text NOT NULL DEFAULT 'journey';
ALTER TABLE journey_analysis ADD COLUMN assessment_id text NOT NULL DEFAULT 'journey';

-- אינדקסים לשליפה לפי (user, assessment) ו-(device, assessment).
CREATE INDEX idx_journeys_user_assessment   ON journeys (user_id, assessment_id);
CREATE INDEX idx_journeys_device_assessment ON journeys (device_id, assessment_id);
```

`journey_responses` **לא משתנה** — הוא נקשר ל-journey דרך `journey_id`, וה-`question_id` ייחודי לכל אבחון (ראה §3.4), כך שאין התנגשות.

> **שים לב לאילוץ הייחודי הקיים** `journeys_user_active_key` (מוגדר ב-migration 026: `CREATE UNIQUE INDEX journeys_user_active_key ON journeys(user_id) WHERE user_id IS NOT NULL AND status IN ('in_progress','paywall')`). אם משתמש מתחיל שני אבחונים במקביל זה יישבר. **חובה לעדכן את האילוץ** באותה מיגרציה:
>
> ```sql
> DROP INDEX IF EXISTS journeys_user_active_key;
> CREATE UNIQUE INDEX journeys_user_active_key
>   ON public.journeys (user_id, assessment_id)
>   WHERE user_id IS NOT NULL AND status IN ('in_progress','paywall');
> ```

### 3.4 מרחב שמות ל-`question_id`
כדי שאותה טבלת `journey_responses` תוכל להחזיק תשובות מכל האבחונים בלי התנגשות, **חובה לתת prefix ל-id של כל שאלה לפי האבחון**: למשל `intimacy.q_play`, `communication.q_repair`. ה-prefix גם מאפשר ל-`analysis.ts` וה-AI לדעת מאיזה אבחון השאלה. שמות "תפקידיים" שה-AI מחפש (ראה §7.2) צריכים להיות צפויים לפי תבנית, למשל `<assessmentId>.q_what_hurts`.

---

## 4. לוגיקת התשובות והניקוד (זהה — עם פרמטריזציה)

`scoreResponses` ו-`analyze` כבר אגנוסטיים לנושא — הם עובדים על `axes`/`domain` של כל שאלה, לא על ה-id. לכן **אין צורך לשנות את המתמטיקה**. נדרשות שתי התאמות בלבד:

1. **סינון לפי assessment** — כשמריצים `analyze` עבור אבחון מסוים, מעבירים רק את התשובות של אותו `journey` (וזה כבר המצב — שולפים `journey_responses WHERE journey_id = ...`). כך הניתוח אוטומטית מתוחם לאבחון.
2. **`computeCategoryScores` באבחון נושאי** — באבחון ממוקד-נושא רוב הצירים שייכים לתחום אחד, אז 4 מתוך 5 העמודות בגרף יהיו דלילות. שתי אפשרויות (החלטה ב-§11):
   - **א.** להשאיר את גרף 5 הקטגוריות כפי שהוא — נותן הקשר רחב גם באבחון ממוקד. עמודות בלי נתונים מקבלות 50 (ברירת מחדל ניטרלית, כבר מקודד).
   - **ב.** להחליף לגרף "תת-צירים בתוך הנושא" (למשל באבחון intimacy: שובבות / ציפייה / מגע / אוטונומיה). דורש וריאנט תצוגה חדש ב-`CategoryBarChart`, אבל מדויק יותר לאבחון נושאי. **מומלץ.**

ה-override של `q20b` ל-intimacy צריך להפוך לפרמטר (`directSatisfactionQuestionId` per assessment) במקום id קשיח.

---

## 5. ה-gating ואיסוף הפרטים (זהה)

- כל אבחון: **חינמי לכל אורכו**. `paywall_after_index` נשאר גבוה (מנוטרל).
- **הרשמה בסוף בלבד**: `auth_after_index` = `total_questions` של אותו אבחון (כלומר אחרי השאלה האחרונה). זהה לקיים.
- איסוף הפרטים — בדיוק כמו §2.4: שאלות דמוגרפיות מוקדמות (`free`, `axes:[]`), והפרטים האישיים (שם/אימייל/סיסמה/נייד) במסך ההרשמה בסוף. `q_gender` עושה backfill ל-`profiles.gender` באותו מנגנון.
- כל לוגיקת ה-`device_id`, התביעה (claim) של journey אנונימי, וההתאוששות מ-race conditions — **נשמרת ללא שינוי**, רק מתווסף `assessment_id` לשאילתות (סינון `WHERE assessment_id = ?`).

---

## 6. שינויי ה-routes

### 6.1 `POST /api/journey/answer`
- מקבל פרמטר נוסף `assessment_id` בגוף הבקשה (ברירת מחדל `"journey"` לתאימות).
- כל השאילתות `find/create journey` מסוננות ב-`.eq("assessment_id", assessment_id)`.
- אימות צורת התשובה: לטעון את בנק השאלות **של אותו אבחון** (`getQuestion(assessment_id, question_id)`), לא את הבנק הגלובלי.
- ה-side-effect של `q_priorities` → cadence רץ **רק** עבור `assessment_id === "journey"` (תוכנית הליווי). באבחונים הנושאיים אין cadence — הם lead magnet.
- בשאלה האחרונה: מחשב ניתוח ושומר ל-`journey_analysis` עם `assessment_id`.

### 6.2 `GET/POST /api/journey/analyze`
- מקבל `assessment_id` (query param ב-GET, body ב-POST).
- שולף את ה-journey והניתוח של אותו אבחון.
- מריץ את `analyzeAssessment` עם הקלט של אותו אבחון (כולל שמות הרפלקציות הממופים — §7.2).

> חלופה נקייה יותר: לשכפל ל-routes ייעודיים `/api/assessments/[id]/answer` ו-`/api/assessments/[id]/analyze` שעוטפים את אותה לוגיקה. עדיף פרמטר על אותו route כדי לא לשכפל את כל לוגיקת ה-RLS/claim. **מומלץ: פרמטר.**

### 6.3 דילוג על שאלות פרטים שכבר נענו
אם המשתמש כבר ענה `q_gender`/`q_relationship_years`/`q_kids_count` באבחון קודם (שמור ב-`profiles` או ב-journey קודם), אפשר לדלג עליהן. מימוש: בעת בניית רשימת השאלות בצד-שרת, לסנן שאלות דמוגרפיות שכבר ידועות. החלטה ב-§11 — בגרסה ראשונה מותר להשאיר חזרתיות לשם פשטות.

---

## 7. זרימת ה-AI (זיהוי כאב → פתרון → הזמנה לליווי)

זו ליבת המוצר וצריכה להיות **זהה במהות** לקיים, מותאמת לנושא.

### 7.1 מה נשאר זהה
- אותו מודל (`claude-sonnet-4-6`), אותה פונקציה `analyzeAssessment`, אותם חוקי קול קשיחים, אותה עמידות-לכשל (null → fallback דטרמיניסטי).
- אותו סדר זיהוי כאב: רפלקציה (`q_what_hurts`/`q_success_signal`) > horsemen > top_priority > scores.
- אותו מבנה פלט `AiHeroBlock` (hero תועלות + 3 המלצות + `expert_mentioned` + `pain_signal`).
- ה-hero תמיד נגמר בכיוון אחד: **הזמנה להצטרף לתוכנית הליווי** (דרך מסך התוצאות וה-`OfferCard`).

### 7.2 מה משתנה — מיפוי הרפלקציות לפי אבחון
`buildUserPayload` כיום מחפש id-ים קשיחים (`q20c_what_hurts`, `q22a_success_signal`, `q20a_urgency_now`, `q20b_intimacy_satisfaction`). באבחונים הנושאיים ה-id-ים שונים (עם prefix). פתרון: להעביר ל-`analyzeAssessment` מפת תפקידים:

```ts
interface AssessmentSignalMap {
  whatHurtsId: string;        // למשל "intimacy.q_what_hurts"
  successSignalId: string;    // "intimacy.q_success_signal"
  urgencyId: string;          // "intimacy.q_urgency_now"
  directSatisfactionId: string; // "intimacy.q_satisfaction"
}
```

`buildUserPayload` יקרא לפי המפה הזו במקום id-ים קשיחים. כך אותו prompt עובד לכל אבחון.

### 7.3 התאמת ה-system prompt לנושא
ה-system prompt הקיים נושא דוגמאות few-shot ואוצר-מילים שמכוונים לתקשורת/אינטימיות באופן כללי. שתי אפשרויות:
- **א.** Prompt אחד גנרי (כמו היום) — עובד, אבל פחות חד באבחון משפחתיות למשל.
- **ב.** הזרקת "מיקוד נושא" לפרומפט: משפט פתיחה + 1–2 דוגמאות few-shot ייעודיות לנושא, נטענות מתוך `AssessmentDef`. **מומלץ** — שומר על אותו מנגנון אבל מחדד את התועלות לנושא. אוצר-המילים והחוקים הקשיחים נשארים משותפים.

הפלט תמיד מסתיים בכיוון לתוכנית הליווי — זה מה שהופך כל אבחון נושאי למשפך אל ה-Journey.

---

## 8. צד לקוח — עמוד ה-hub והזרימה

### 8.1 עמוד ה-hub החדש
`app/[locale]/assessments/page.tsx` (Server Component):
- שולף את `catalog` + עבור משתמש מחובר את הסטטוס לכל אבחון (`journeys WHERE user_id = ? `, מקובץ לפי `assessment_id`): "לא התחלת" / "בתהליך (X/20)" / "הושלם".
- מרנדר רשת כרטיסים (כרטיס לכל אבחון): כותרת, tagline, מצב, וכפתור "התחילו" / "המשיכו" / "צפו בתוצאות".
- העיצוב: לעקוב אחרי שפת העיצוב הקיימת (כהה, פלטת היין/זהב `#FCCA65`). **mobile-first** — לפי ההנחיות, עבודת מובייל בלבד; לא לגעת בדסקטופ ללא אישור.

### 8.2 עמוד אבחון בודד
`app/[locale]/assessments/[assessmentId]/page.tsx` — בעצם עותק מותאם של `app/[locale]/journey/assessment/page.tsx`:
- מקבל `assessmentId` מה-URL, מאמת מול ה-catalog (אחרת `notFound()`).
- כל השאילתות מסוננות ב-`assessment_id`.
- מעביר ל-`JourneyClient` props חדשים: `assessmentId` + בנק השאלות של אותו אבחון.
- **post-purchase guard**: באבחון נושאי אין redirect ל-`/my/journey` (זה לא תוכנית הליווי) — מנוי פעיל רואה את תוצאות האבחון רגיל, וה-`OfferCard` מתחלף ב-`ActiveSubscriberCard`.

### 8.3 ה-orchestrator
`JourneyClient` מקבל `assessmentId` ובנק שאלות כ-prop במקום לייבא את הגלובלי. כל קריאות `fetch` ל-`/api/journey/answer` ו-`/analyze` כוללות `assessment_id`. שאר ההתנהגות (auto-advance, reveal, confetti, back, מסך הרשמה בסוף) — זהה. כדאי לפרק את הקובץ הגדול ל-prop-driven במקום import קשיח.

### 8.4 מסך התוצאות
`AnalysisSummary` כבר מונע מ-`summary` (AI hero + category_scores) — אגנוסטי לנושא. נדרש רק:
- כותרות הסקשנים (gains/topics/who-for/expert) מגיעות מ-CMS (`journeyAssessment.analysis.*`). לאבחונים נושאיים — או להשתמש באותם מפתחות, או להוסיף מרחב `assessments.<id>.analysis.*` כדי לאפשר נוסח ממוקד-נושא. החלטה ב-§11.
- ה-CTA נשאר זהה: `POST /api/billing/checkout/create` עם `product:"journey"` — **כל אבחון מוביל לאותה תוכנית ליווי**.

---

## 9. רשימת מיגרציות וקבצים

**מיגרציה (מספר הבא ברצף, ~107):**
- `ALTER TABLE journeys ADD assessment_id` + `journey_analysis ADD assessment_id` (ברירת מחדל `'journey'`).
- עדכון האילוץ הייחודי `journeys_user_active_key` ל-`(user_id, assessment_id)`.
- אינדקסים `(user_id, assessment_id)` ו-`(device_id, assessment_id)`.
- (אופציונלי) שורות CMS למרחב `assessments.<id>.analysis.*`.

**קבצים חדשים:**
- `lib/assessments/catalog.ts` — הגדרות 4 האבחונים + בנקי השאלות.
- `journey/assessments/<id>.json` × 4 — בנקי השאלות (תוכן יסופק בנפרד).
- `app/[locale]/assessments/page.tsx` — ה-hub.
- `app/[locale]/assessments/[assessmentId]/page.tsx` — עמוד אבחון בודד.

**קבצים לשינוי (תוספת `assessment_id`, ללא שבירת ברירת המחדל `'journey'`):**
- `lib/journey/questions.ts` — `getQuestion(assessmentId, id)`, `totalQuestions(assessmentId)`, gating לפי אבחון.
- `app/api/journey/answer/route.ts` — פרמטר `assessment_id`, סינון, side-effect cadence רק ל-journey.
- `app/api/journey/analyze/route.ts` — פרמטר `assessment_id` + מפת signals ל-AI.
- `lib/ai/analyze-assessment.ts` — קבלת `AssessmentSignalMap` + מיקוד-נושא אופציונלי לפרומפט.
- `lib/journey/analysis.ts` — `directSatisfactionId` כפרמטר במקום `q20b` קשיח.
- `components/journey/JourneyClient.tsx` — prop-driven (assessmentId + בנק שאלות).

---

## 10. בדיקות נדרשות לפני שילוח

1. **שלמות בנק שאלות** — בדיקת build-time כמו `assertDomainDistribution` הקיימת: לוודא שכל אבחון מכיל את שתי הרפלקציות + שאלת הדחיפות, ושכל ה-id-ים נושאים prefix.
2. **בידוד בין אבחונים** — משתמש שמתחיל את `intimacy` ואז את `communication`: שתי שורות `journeys` נפרדות, אין דריסת תשובות, האילוץ הייחודי לא נשבר.
3. **זרימת אנונימי → הרשמה** — להשלים אבחון נושאי אנונימית, להירשם, לוודא claim + backfill gender + שחזור התשובות.
4. **AI fallback** — בלי `ANTHROPIC_API_KEY`: לוודא שמסך התוצאות נופל לנרטיב הדטרמיניסטי בלי לקרוס.
5. **קריאת הרפלקציות** — לוודא שה-AI מקבל את `q_what_hurts`/`q_success_signal` הנכונים דרך ה-signal map (לוג `pain_signal` צריך להראות `reflection` כשמולאו).
6. **CTA לליווי** — מכל אבחון: לחיצה על ה-CTA פותחת checkout עם `product:"journey"`; משתמש מנוי רואה `ActiveSubscriberCard`.
7. **מובייל** — כל המסכים מאומתים במובייל (לפי ההנחיה: עבודת מובייל בלבד, לא לגעת בדסקטופ ללא אישור).

---

## 11. החלטות פתוחות (להחלטת איציק לפני פיתוח)

1. **גרף התוצאות באבחון נושאי** — 5 קטגוריות גלובליות (§4א) או תת-צירים בתוך הנושא (§4ב, מומלץ)?
2. **שאלת ה-ranking** — לכלול באבחונים הנושאיים, או רק באבחון הליווי המקורי? (ה-ranking מזין את `journey_user_priorities`/cadence — שייך ל-Journey, לא בהכרח לאבחון נושאי.)
3. **דילוג על שאלות פרטים** שכבר נענו באבחון קודם (§6.3) — בגרסה ראשונה או בהמשך?
4. **נוסח מסך התוצאות** — אותם מפתחות CMS לכל האבחונים, או מרחב נפרד `assessments.<id>.analysis.*` לנוסח ממוקד-נושא?
5. **מיקוד פרומפט ה-AI** לנושא (§7.3ב) — בגרסה ראשונה או אחרי שנראה את התוצאות עם הפרומפט הגנרי?

---

## 12. עיקרון לסיכום

המפתח **לא בונה מנוע אבחון חדש.** הוא מוסיף `assessment_id` למנגנון קיים ובוגר, נותן prefix ל-id של השאלות, מעביר את ה-`JourneyClient` ל-prop-driven, ומעביר ל-AI מפת-תפקידים של הרפלקציות. כל השאר — הניקוד, ה-gating, איסוף הפרטים, התביעה האנונימית, זיהוי הכאב, ה-fallback, וה-CTA לליווי — **נשאר זהה לקיים.**
