# אפיון: מערכת אנליטיקה התנהגותית לאדמין (Per-User Behavior Analytics)

> **סטטוס:** טיוטת אפיון לאישור — להעברה ל-code agent בצוות
> **תאריך:** 2026-06-15
> **בעלים:** Itzik
> **היקף:** מסמך אפיון בלבד. **לא לגעת בקוד** עד אישור. זהו תכנון מבוסס-סריקה של ה-codebase הקיים.

---

## 1. מטרה

לתת לאדמין יכולת לראות בדיוק **מה גולש עושה** באתר מיאושי — מתי נכנס, לאן הלך, מה פתח, מה אישר, על מה הגיב, כמה זמן שהה בכל שירות, ואיפה נטש. המטרה העסקית: **לזהות דפוסי התנהגות — מה עובד ומה לא** — ולפעול עליהם (לחזור לגולש, לתקן תוכן שלא נצרך, לזהות נטישה לפני שהיא הופכת לביטול).

שלושת עמודי המוצר שצריך לכסות:

- **ליווי (Journey)** — מסע תוכן מובנה, פרקים, תגובות, צ'אט עם מומחה.
- **משחקים (Games)** — גלגל, סולמות-וחבלים, משחקי זוגיות.
- **מבוגרים / מיאושי-סקס (Adults)** — משחקי חוויה זוגיים אינטימיים.

הדשבורד צריך לתמוך ב: **חיפוש לפי אדם, רשימת לקוחות, סינון לפי תאריך כניסה, מתי נכנסו, מה עשו, באילו שירותים/פרקים ביקרו.**

---

## 2. מצב קיים — מה כבר נאסף (לא להמציא מחדש)

נסרק ה-codebase. התשתית קיימת וחלקית-חיה. אסור לבנות מאפס — מרחיבים את מה שיש.

### 2.1 שכבת אנליטיקה ראשונית (first-party → Supabase)

| רכיב | קובץ | מה עושה |
|---|---|---|
| ספריית tracking | `lib/analytics.ts` | `track(event, properties)` — fire-and-forget. מצרף `session_id` (per-tab), `device_id`, `locale`, `path`. |
| נקודת קליטה | `app/api/analytics/event/route.ts` | edge route, מזהה user אם מחובר, כותב ל-`analytics_events`. תמיד מחזיר 204. |
| טבלה | migration `038_analytics_events.sql` | `analytics_events(id, event, session_id, device_id, user_id, locale, properties jsonb, created_at)`. אינדקסים על event/user_id/device_id/created_at. RLS: רק service_role קורא. |
| View | `analytics_daily_summary` | סיכום יומי לפי event+locale (event_count, unique_devices, unique_users). |

**כבר חי בקוד — 22 נקודות `track()`** (לא רק מוגדר, אלא נשלח בפועל), בין היתר:
`components/journey/JourneyClient.tsx`, `components/my/JourneyDashboardViewTracker.tsx`, `components/my/RailPillTracker.tsx`, `components/my/ResponseBox.tsx`, `components/my/JourneyExpertMessage.tsx`, `components/my/JourneyPriorityRanking.tsx`, `components/marketing/v2/TrackedLink.tsx`, `components/RegistrationModal.tsx`, `app/[locale]/game/ui.tsx`, `app/[locale]/game/local/ui.tsx`.

אירועים מוגדרים (`AnalyticsEvent` ב-`lib/analytics.ts`): `page_view`, `game_lobby_opened`, `game_start`, `game_question_answered`, `game_completed`, `game_abandoned`, `journey_started/...completed`, `journey_dashboard_viewed`, `journey_rail_pill_clicked`, `registration_started/completed`, `paywall_shown`, `checkout_started`, `subscription_activated/cancelled`, `home_v2_section_viewed`, `home_v2_cta_click`.

### 2.2 לוג פעילות של מסע (Journey activity log)

`journey_user_activity` (migration `044_audience_and_activity.sql`) — append-only, מתעד פעולות משמעותיות בטיימליין:

- `verb`: `item_opened` | `item_completed` | `item_uncompleted` | `response_posted` | `response_deleted`
- שדות: `user_id`, `couple_id`, `scheduled_item_id`, `payload jsonb`, `created_at`. מאונדקס על `(user_id, created_at DESC)`.

זה **בדיוק** "האם פתח פרק / האם אישר (השלים) / האם הגיב" — אבל **רק עבור עמוד הליווי**.

### 2.3 תגובות וצ'אט (מה שצריך כדי "ללכת לתגובות ולהגיב חזרה")

- `journey_item_responses` — תגובת משתמש לפרק (`response_text`, `is_private`, `created_at`) + שדות מומחה: `clinician_status` (open/resolved/concerning), `clinician_id`, `clinician_reply_text`, `clinician_replied_at`. **כבר תומך בקריאה ובמענה חזרה.**
- `journey_messages` (mig 056) — thread פר-פרק או ערוץ כללי משתמש↔מומחה (`author_kind`, `body`, `reactions`, `created_at`).
- `journey_couple_channel_messages` (mig 072) — ערוץ משותף לזוג.
- מסכי אדמין קיימים: `app/dashboard/journey/expert-messages` (טראקר הודעות מאוחד עם פילטרים) ו-`app/dashboard/my-clients/[coupleId]` (חלון עבודה פר-זוג עם מענה).

### 2.4 PostHog (session replay + heatmaps + clicks)

`components/analytics/PostHogProvider.tsx` — EU region, reverse-proxy דרך `/ingest`. **prod בלבד.**

- session recording עם **מיסוך אגרסיבי בכוונה**: `maskAllInputs: true`, `maskTextSelector: "*"` (כל הטקסט ממוסך), בלוק על `[data-ph-no-capture]`. זה כי התוכן אינטימי.
- heatmaps + clicks דרך PostHog (אבל **לא queryable** מ-Supabase — חי רק בדשבורד PostHog החיצוני).
- `identify()` שולח **רק user_id** (ללא PII). `respect_dnt: true`. פרמטרים רגישים ב-URL ממוסכים (`code`, `token`, `email`, `invite`, `ref_code`).

### 2.5 זהות וזמן-פעילות

- `lib/device-id.ts` — cookie `mioshy_device_id` (UUID, 365 יום) — מזהה מכשיר חוצה-סשנים.
- `user_sessions` (migration `020_auth_single_session.sql`) — שורה אחת פר-משתמש (single-session), עם `last_active_at` ו-`device_info jsonb`. **מתעדכן ב-middleware** ⇒ יש אות "נראה לאחרונה" — אבל הוא **נמחק/נדרס בכל login חדש**, אז זו לא היסטוריית כניסות.
- `lib/geo-from-request.ts` — מדינה מ-`x-vercel-ip-country`. משמש לניתוב בלבד, **לא נשמר**.

### 2.6 דשבורדי אדמין קיימים שאפשר להישען עליהם

- `app/dashboard/journey/metrics` — KPIs ברמת מערכת (owners פעילים, completion rate, זמן מענה ממוצע, drift).
- `app/dashboard/journey-analytics` — funnel מ-entitlements עד completions.
- `app/dashboard/users` + `app/dashboard/users/[id]` — רשימת משתמשי ליווי + עמוד פרופיל פר-משתמש (כבר מציג completions, responses, ניתוח, notes, היסטוריית מיילים).
- `app/dashboard/leads` — לידים לפני הרשמה.
- קונבנציות: shadcn UI (Card/Table/Badge/Tabs), `components/dashboard/Sidebar.tsx` (עץ NavLeaf/NavGroup דקלרטיבי + badge runtime), i18n he/en ב-`lib/admin/i18n.ts`, gating דרך `lib/auth/admin.ts` (`requireAdmin()`).

---

## 3. הפערים — מה חסר כדי לענות על הבקשה

| מה Itzik ביקש | מצב | פער |
|---|---|---|
| מתי בדיוק פתח את האתר, באילו שעות | חלקי | יש `user_sessions.last_active_at` (נדרס) + `analytics_events.created_at`. **אין היסטוריית כניסות/login events.** |
| האם אישר (השלים) פרק, האם הגיב | ✅ קיים | רק לליווי (`journey_user_activity`, `journey_item_completions`, `journey_item_responses`). |
| ללכת לתגובות ולהגיב חזרה | ✅ קיים | קיים פר-זוג; חסר תצוגת "כל התגובות שממתינות לי" חוצה-משתמשים בתוך מסך הגולש. |
| מה עדיין לא נפתח | חלקי | אפשר לחשב (scheduled_items שאין להם `item_opened`), אבל **אין view מוכן**. |
| לאילו פרקים/קודים הלך, אילו שירותים פתח | חלקי | ליווי כן; **מעבר בין שלושת העמודים לא מנורמל למסך אחד**. |
| כמה קליקים | חלקי | PostHog heatmaps בלבד — **לא queryable, לא פר-משתמש בדשבורד שלנו**. |
| כמה זמן שהייה בכל שירות (dwell time) | ❌ חסר | **אין מעקב זמן-שהייה** בכלל. רק אפשר לאמוד גסות מהפרש timestamps באותו session. |
| איפה נטשו (abandonment) | חלקי | יש `game_abandoned` event מוגדר; **אין מודל נטישה אחיד** (פרק שנפתח ולא הושלם, checkout שלא הסתיים, וכו'). |
| משחקים — קליקים, זמן צפייה | ❌ חסר | `user_game_plays` סופר רק כמות; **אין per-play timestamp, אין משך, אין נטישה**. |
| מבוגרים/סקס — קליקים, זמן צפייה, נטישה | ❌ חסר לגמרי | **אפס מעקב engagement** בעמוד המבוגרים. יש רק `couple_entitlements.acquired_at` (רכישה, לא צפייה). |
| חיפוש לפי אדם / רשימת לקוחות / לפי תאריך כניסה | חלקי | `app/dashboard/users` קיים אבל ממוקד-ליווי; חסר חיפוש אחיד חוצה-עמודים + סינון לפי תאריך כניסה אחרון. |

**מסקנה:** הליווי כבר מכוסה היטב. הפערים המרכזיים: (א) **זמן-שהייה ונטישה** בכל העמודים, (ב) **מעקב engagement במשחקים ובמבוגרים**, (ג) **היסטוריית כניסות**, (ד) **דשבורד אחיד פר-גולש** שמאחד את שלושת העמודים + חיפוש/סינון.

---

## 4. דרישות מוצר — מה האדמין צריך לראות

### 4.1 מסך "פרופיל גולש 360°" (per-user)
חלון יחיד שמרכז עבור גולש נבחר:

1. **כניסות:** מתי נכנס לראשונה, מתי לאחרונה, רשימת כניסות אחרונות עם שעה ומכשיר, ובאילו שעות ביום הוא פעיל (heatmap שעות).
2. **מסע (ליווי):** אילו פרקים נפתחו / אושרו (הושלמו) / נותרו סגורים, מתי, וזמן עד השלמה. אילו תגובות כתב + סטטוס מענה. **כפתור "הגב" ישיר לכל thread.**
3. **שירותים שביקר:** טיימליין חוצה-עמודים — אילו עמודים/שירותים פתח (ליווי / משחקים / מבוגרים), מתי, וכמה זמן שהה בכל אחד.
4. **משחקים:** אילו משחקים פתח/שיחק, כמה פעמים, משך, האם נטש באמצע.
5. **מבוגרים:** אילו משחקי חוויה פתח, כמה זמן צפה בכל רמה, היכן נטש.
6. **נטישה:** סימון ברור — היכן הגולש "נתקע" (פרק שנפתח ולא הושלם, checkout שלא נסגר, משחק שננטש).

### 4.2 רשימת לקוחות + חיפוש + סינון
- חיפוש לפי שם / מייל / טלפון.
- סינון לפי: תאריך כניסה אחרון, עמוד שבבעלותו (entitlement), סטטוס מנוי, רמת פעילות (פעיל / מתקרר / נטש).
- עמודות: שם, מייל, נכנס לאחרונה, # פרקים שהושלמו, # משחקים, סטטוס נטישה, מנוי.
- מיון לפי "נכנס לאחרונה" ו"רמת פעילות".

### 4.3 תובנות אגרגטיביות ("מה עובד ומה לא")
- אילו פרקים/משחקים/משחקי-חוויה הכי נפתחים והכי מושלמים מול הכי ננטשים (תוכן שלא עובד).
- שיעור נטישה לפי שלב במסע ולפי שירות.
- שעות שיא של פעילות.
- משך שהייה ממוצע פר-שירות.

---

## 5. מודל נתונים מוצע (לקוד אג'נט)

עיקרון מנחה: **אירוע אחד אחיד** (`analytics_events`) הוא עמוד השדרה. מוסיפים שדות ו-events חדשים, ולוג כניסות נפרד. לטבלאות אגרגציה — להעדיף **views/materialized views** מעל `analytics_events` במקום לשכפל מידע.

> **תיאום TZ:** כל החותמות `timestamptz`. דשבורדי "היום/השבוע" יסוננו לפי אזור זמן ישראל (Asia/Jerusalem) — לעקוב אחרי הקונבנציה ב-`analytics_daily_summary`.

### 5.1 הרחבת `analytics_events` ב-events חדשים (ללא שינוי סכימה)
מוסיפים ל-`AnalyticsEvent` ב-`lib/analytics.ts` ומפעילים `track()` בנקודות הנכונות:

- `service_opened` — `properties: { pillar: 'journey'|'games'|'adults', surface, item_id? }`
- `chapter_opened` (אם רוצים מעבר ל-events מאוחדים, או להישאר עם `journey_user_activity`).
- `adult_game_opened`, `adult_level_viewed` — `properties: { game_id, level }`
- `dwell` (heartbeat) — נשלח בעזיבת עמוד/blur עם `{ pillar, path, ms, item_id? }` (ראו §6).
- `abandoned` אחיד — `{ context: 'chapter'|'game'|'adult'|'checkout', ref_id, last_step }`
- `click` — אופציונלי, רק לאלמנטים מסומנים (לא תפיסת-קליק גורפת), `{ target, pillar, path }`.

### 5.2 טבלה חדשה: `auth_login_events` (היסטוריית כניסות)
```
auth_login_events(
  id uuid pk,
  user_id uuid not null,           -- FK auth.users
  device_id text,                  -- mioshy_device_id
  device_info jsonb,               -- ua, platform (מ-user_sessions)
  country text,                    -- מ-geo-from-request (אופציונלי, ראו §8)
  created_at timestamptz default now()
)
```
נכתב בכל login מוצלח (ב-action ההתחברות / middleware שמנהל את `user_sessions`). פותר את "מתי בדיוק נכנס ובאילו שעות".

### 5.3 טבלה חדשה: `service_sessions` (זמן-שהייה פר-שירות)
מצרפת dwell heartbeats לכדי "ביקור" פר-שירות:
```
service_sessions(
  id uuid pk,
  user_id uuid,                    -- nullable (אנונימי)
  device_id text,
  session_id text,                 -- per-tab
  pillar text,                     -- 'journey'|'games'|'adults'
  ref_id uuid,                     -- item_id / game_id (nullable)
  started_at timestamptz,
  last_seen_at timestamptz,
  total_ms integer,                -- מצטבר מ-heartbeats
  completed boolean default false,
  abandoned boolean default false
)
```
אופציה חלופית פשוטה יותר: לא טבלה ייעודית, אלא **view** שמחשב משך פר-(session_id, pillar) מתוך `analytics_events`. ראו §9 — מומלץ להתחיל מ-view ולעבור לטבלה רק אם הביצועים מחייבים.

### 5.4 מבוגרים — מעקב engagement (פער קריטי)
אין שום מעקב היום. אופציות:
- **קל:** להישען על `analytics_events` (`adult_game_opened`/`adult_level_viewed`/`dwell`).
- **מובנה:** טבלה `experience_game_views(couple_id, game_id, user_id, first_viewed_at, last_viewed_at, total_ms, completed)`.

מומלץ: להתחיל מ-events, ולקבל החלטה על טבלה ייעודית אחרי שרואים נפח.

### 5.5 משחקים — per-play
`user_game_plays` סופר כמות בלבד. להוסיף events `game_start`/`game_completed`/`game_abandoned` עם `play_id` ו-`duration_ms` (חלק כבר קיימים כ-events — צריך לוודא שנשלחים בפועל עם משך).

### 5.6 Views לדשבורד (לא לשכפל דאטה)
- `v_user_last_login` — כניסה אחרונה פר-user מ-`auth_login_events`.
- `v_user_activity_level` — מסווג פעיל/מתקרר/נטש לפי last activity.
- `v_chapter_funnel` — נפתח / הושלם / ננטש פר-פרק.
- `v_service_dwell` — משך שהייה ממוצע פר-pillar פר-user.
- `v_abandonment` — נקודות נטישה מצרפות.

---

## 6. שכבת איסוף (Instrumentation) — איך מודדים זמן וקליקים

1. **Dwell / זמן-שהייה:** hook חדש `useDwellTracking(pillar, refId)` ש:
   - מתחיל טיימר בכניסה לעמוד/קומפוננטה.
   - שולח heartbeat כל ~15ש' וב-`visibilitychange`/`beforeunload` (עדיף `navigator.sendBeacon` ל-`/api/analytics/event`).
   - עוצר טיימר כש-tab מוסתר (לא לספור זמן רקע).
   - יורכב על העמודים: ליווי (פר-פרק), משחקים (פר-משחק), מבוגרים (פר-רמה).

2. **קליקים:** **לא** tracking גורף. רכיב `TrackedLink`/`TrackedButton` (כבר קיים `components/marketing/v2/TrackedLink.tsx` כבסיס) על אלמנטים שחשובים. ל-heatmaps גורפים — להמשיך להישען על PostHog.

3. **נטישה:** מוגדרת ברמת ה-view/לוגיקה, לא event ידני בכל מקום:
   - פרק: `scheduled_item` עם `item_opened` אבל בלי `item_completed` אחרי X ימים.
   - checkout: `checkout_started` בלי `subscription_activated` באותו session.
   - משחק/מבוגרים: `*_opened`/`dwell` בלי `*_completed`.

4. **היסטוריית כניסות:** כתיבה ל-`auth_login_events` בנקודת ניהול ה-session הקיימת (`user_sessions`).

---

## 7. מסכי האדמין (UI) — להישען על הקונבנציות הקיימות

הכל תחת `app/dashboard/` (gating `requireAdmin()`), shadcn UI, סיידבר דקלרטיבי, i18n he/en.

1. **`/dashboard/users` — שדרוג לרשימת לקוחות אחידה**
   חיפוש (שם/מייל/טלפון) + פילטרים (תאריך כניסה אחרון, entitlement, רמת פעילות, נטישה) + עמודות חדשות (§4.2). מיון. הרחבה של המסך הקיים, לא חדש.

2. **`/dashboard/users/[id]` — שדרוג ל"פרופיל 360°"**
   המסך כבר מציג completions/responses/notes. להוסיף טאבים: **כניסות** (היסטוריה + heatmap שעות), **שירותים** (טיימליין חוצה-עמודים + dwell), **משחקים**, **מבוגרים**, **נטישה**. כפתורי "הגב" ל-threads (לחבר ל-`journey_messages`/`journey_item_responses` הקיימים).

3. **`/dashboard/behavior` (חדש) — תובנות אגרגטיביות**
   "מה עובד ומה לא": פאנלי תוכן (הכי נפתח/מושלם/ננטש), שיעור נטישה לפי שלב/שירות, שעות שיא, dwell ממוצע. גרפים: אפשר Chart.js (כבר זמין בארטיפקטים) או recharts. להוסיף leaf לסיידבר תחת קבוצת Analytics הקיימת.

---

## 8. סוגיית פרטיות — ✅ הוחלט: גישה א' (מאושר 2026-06-16)

הריפליי של PostHog ממוסך **בכוונה** כי התוכן אינטימי (זוגיות, מיניות). מעקב התנהגותי מפורט פר-גולש מגביר את הרגישות. שתי גישות:

### גישה א' — מעקב התנהגותי בלבד (מומלצת)
עוקבים אחרי **מטא-דאטה**: מתי, כמה זמן, אילו שירותים/פרקים (לפי ID), היכן נטשו — **בלי לחשוף את התוכן עצמו** (לא טקסט תגובות אינטימי, לא תוכן מבוגרים) בתוך מסכי האנליטיקה.
- **יתרון:** שומר על קו הפרטיות הקיים, עקבי עם מיסוך PostHog, מקטין סיכון רגולטורי, ועדיין עונה על *כל* השאלות העסקיות ("מה עובד / היכן נוטשים").
- **חיסרון:** אדמין לא רואה את תוכן הצפייה במבוגרים מתוך האנליטיקה (אבל זה ממילא ממוסך ב-PostHog).

### גישה ב' — מעקב מלא כולל תוכן
חושפים גם תוכן שנצפה/נכתב ברמה מפורטת בתוך מסכי האנליטיקה.
- **יתרון:** הקשר עשיר יותר לאדמין/מאמן.
- **חיסרון:** מנוגד למיסוך המכוון הקיים, רגיש מאוד (תוכן מיני/זוגי מזוהה לאדם), חושף לסיכון פרטיות/רגולציה, ועלול לפגוע באמון אם ידלוף.

**המלצה:** גישה א' למסכי האנליטיקה. תוכן תגובות הליווי כבר נגיש למאמן בהקשר הטיפולי הקיים (`my-clients`, `expert-messages`) — שם הוא מוצדק תפעולית; אין צורך לשכפל אותו לדשבורד התנהגותי. בכל מקרה: גישה לכל המסכים האלה דרך `requireAdmin()` בלבד, ולשמר `respect_dnt`.

---

## 9. תוכנית עבודה בשלבים (Roadmap ל-code agent)

**שלב 0 — תשתית ו-instrumentation (בסיס לכל השאר)**
- הרחבת `AnalyticsEvent` ב-events החדשים (§5.1).
- `useDwellTracking` hook + `sendBeacon` (§6).
- `auth_login_events` + כתיבה בנקודת ה-session (§5.2).
- וידוא שמשחקים שולחים `duration_ms` ו-`game_abandoned` בפועל.

**שלב 1 — כיסוי מבוגרים ומשחקים (סגירת הפערים הקריטיים)**
- הרכבת `useDwellTracking` על עמודי מבוגרים (פר-רמה) ומשחקים (פר-משחק).
- events `adult_game_opened`/`adult_level_viewed`.
- החלטה: views מעל `analytics_events` (מומלץ להתחיל) או טבלאות `service_sessions`/`experience_game_views`.

**שלב 2 — Views לדשבורד**
- `v_user_last_login`, `v_user_activity_level`, `v_chapter_funnel`, `v_service_dwell`, `v_abandonment` (§5.6).

**שלב 3 — מסך פרופיל גולש 360°**
- שדרוג `users/[id]` עם הטאבים החדשים + כפתורי "הגב" (§7.2).

**שלב 4 — רשימת לקוחות + חיפוש + סינון**
- שדרוג `users` (§7.1).

**שלב 5 — דשבורד תובנות אגרגטיביות**
- `/dashboard/behavior` (§7.3).

**שלב 6 — ליטוש**
- heatmap שעות, ייצוא CSV, התראות נטישה (אופציונלי: cron שמסמן גולשים שנטשו).

> כל שלב נפרס במיגרציה אחת או יותר. **לא להריץ npm/pnpm install מול תיקיית mioshy** (mount של FUSE משחית node_modules — לערוך `package.json` ביד אם נדרש). אין צורך ב-backwards-compat (pre-launch).

> ⚠️ **שער QA חובה לפני פרודקשן (מאושר 2026-06-16):** המוצר כבר בשיווק פעיל. בכל שלב — **קודם להריץ ולבדוק מקומית** את כל הזרימה (איסוף → route → `analytics_events` → תצוגה במסך), ורק אחרי ש-Itzik מאשר שהכל עובד — לעלות לפרודקשן. **אסור לדחוף ישירות לפרודקשן.** כל שלב מסתיים בבדיקה מקומית מתועדת + אישור.

---

## 10. החלטות שנסגרו (מאושר — מחייב את ה-code agent)

> כל ההחלטות הפתוחות נסגרו עם Itzik (2026-06-16). אלו ההנחיות המחייבות:

1. **פרטיות — גישה א' (מאושר).** מסכי האנליטיקה עוקבים אחרי **מטא-דאטה בלבד**: מתי, כמה זמן, אילו שירותים/פרקים לפי ID, היכן נטשו. **אין לחשוף תוכן אינטימי מזוהה** (טקסט תגובות, תוכן מבוגרים) בתוך מסכי האנליטיקה. תוכן בהקשר ליווי נשאר נגיש רק במסכים הטיפוליים הקיימים (`my-clients`, `expert-messages`). גישה דרך `requireAdmin()` בלבד; לשמר `respect_dnt`.
2. **Views מעל `analytics_events` (מאושר).** להתחיל מ-views/materialized-views, לא מטבלאות ייעודיות. לעבור ל-`service_sessions`/`experience_game_views` רק אם הביצועים בנפח אמיתי מחייבים — לא לפני.
3. **מעקב מחוברים + אנונימיים (מאושר).** לעקוב ולהציג גם גולשים לא-מחוברים לפי `device_id`, כדי לכסות את משפך הכניסה והנטישה לפני הרשמה.
4. **סף נטישה — ברירות מחדל מומלצות (מאושר):**
   - פרק: `item_opened` בלי `item_completed` תוך **7 ימים**.
   - checkout: `checkout_started` בלי `subscription_activated` **באותו session**.
   - משחק/מבוגרים: `*_opened`/`dwell` בלי `*_completed` (סיום session).
   - להגדיר את הספים כ-config שניתן לכיול בהמשך.
5. **רזולוציית dwell (מאושר):** heartbeat כל **15 שניות**; מינימום **5 שניות** כדי שייספר כ"ביקור" (מסנן כניסות בטעות).
6. **Retention (מאושר):** לשמור `analytics_events` ו-`auth_login_events` **12 חודשים**, ואז לאגרגג ל-summary ולמחוק את הגלם.

---

## 11. נספח — מיפוי טבלאות קיימות רלוונטיות

| תחום | טבלה | חותמות זמן רלוונטיות |
|---|---|---|
| משתמשים | `profiles` | `created_at` (אין last_login) |
| Session | `user_sessions` | `last_active_at` (נדרס בכל login) |
| מנויים | `subscriptions` | `created_at`, `current_period_end`, `status`, `product` (games/journey/adults) |
| זוגות | `couples`, `couple_members`, `couple_invitations` | `created_at`, `joined_at`, `accepted_at`, `started_journey_at` |
| מסע — תוכן | `journey_programs/categories/items` | פרק = `journey_items` |
| מסע — תזמון | `journey_assignments`, `journey_scheduled_items` | `anchor_date`, `unlock_at` |
| מסע — השלמה | `journey_item_completions` | `completed_at`, `completed_by` |
| מסע — תגובות | `journey_item_responses` | `created_at`, `clinician_replied_at`, `clinician_status` |
| מסע — לוג פעילות | `journey_user_activity` | `created_at` + `verb` (opened/completed/responded) |
| מסע — הודעות | `journey_messages`, `journey_couple_channel_messages` | `created_at`, `edited_at` |
| משחקים — קטלוג | `games`, `wheel_configs`, `questions` | — |
| משחקים — שימוש | `user_game_plays` | `plays_used`, `last_reset_at` (ספירה בלבד, ללא per-play) |
| משחקים — חדר | `game_rooms`, `game_players` | `created_at`, `updated_at` |
| מבוגרים — קטלוג | `experience_games`, `experience_game_content` | רמות: מרגש/מעורר/ללא-גבולות |
| מבוגרים — זכאות | `couple_entitlements` | `acquired_at` (רכישה, **לא צפייה**) |
| הערכות | `assessment_sessions/responses/results` | `last_activity_at`, `completed_at` |
| אנליטיקה גנרית | `analytics_events` (+`analytics_daily_summary`) | `created_at` |

**קבצי קוד מרכזיים:** `lib/analytics.ts`, `app/api/analytics/event/route.ts`, `lib/device-id.ts`, `lib/geo-from-request.ts`, `components/analytics/PostHogProvider.tsx`, `lib/auth/admin.ts`, `components/dashboard/Sidebar.tsx`, `lib/admin/i18n.ts`, `app/dashboard/users/[id]/page.tsx`.
