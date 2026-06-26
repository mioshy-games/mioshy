# צ'קליסט — אנליטיקה התנהגותית לאדמין (סנכרון צוות)

> מסמך מעקב חי. מקור אמת לאפיון: `docs/admin-analytics-spec.md`. עודכן: 2026-06-17.
> ענף עבודה: `feat/analytics-phase0` (commit `06985bf`, **לא נדחף**).

## כללי משחק קבועים (חלים על כל שלב)
- [x] גישת פרטיות א' — מטא-דאטה בלבד, בלי תוכן אינטימי / PII במסכי האנליטיקה
- [x] **מדיניות deploy (עודכן 2026-06-17):** אנליטיקה = שינוי additive בסיכון נמוך → deploy ישיר לפרודקשן ובדיקה שם, בלי שער QA. (בדיקה מקדימה נשמרת רק לשינויי כסף/Cardcom/אימות/מיגרציות הרסניות — לא רלוונטי לפרויקט הזה.)
- [ ] לא להריץ `npm/pnpm install` מול תיקיית mioshy (ה-mount משחית node_modules)
- [x] אין צורך ב-backwards-compat (pre-launch)

---

## ✅ הושלם

- [x] אפיון מקיף נכתב ואושר — `docs/admin-analytics-spec.md`
- [x] כל ההחלטות ננעלו (ספר §10): פרטיות א' · Views לפני טבלאות · מחוברים+אנונימיים · ספי נטישה · dwell 15ש'/מינ' 5ש' · retention 12ח'
- [x] פרומפט הטמעה הועבר לסוכן ה-Claude Code
- [x] **שלב 0 — קוד הושלם** (tsc 0 שגיאות, eslint נקי):
  - [x] 7 events חדשים + `buildPayload()`/`sendBeaconEvent()` משותפים — `lib/analytics.ts`
  - [x] `hooks/useDwellTracking.ts` (זמן פעיל, heartbeat 15ש', flush אידמפוטנטי, מינ' 5ש')
  - [x] migration `130_auth_login_events.sql` (append-only, RLS service-role)
  - [x] כתיבת login event ב-`createSession()` — `lib/auth/session-enforcement.ts`
  - [x] אינסטרומנטציית משחקים: סנייקס **+ גלגל** (duration_ms + game_abandoned)
  - [x] dwell smoke-test מורכב על עמוד הגלגל
- [x] שלב 0 אומת מול הקוד (בדיקת Claude) — נאמן לאפיון, נקי

---

## ✅ נפרס לפרודקשן (2026-06-17)

ענף `dashboard/mobile-refactor`, merge commit `388ac2b`, נדחף ל-origin. מיגרציות 130–133 הורצו בפרוד. כל המערכת חיה: `/dashboard/users` · `/dashboard/users/[id]` · `/dashboard/behavior`.

## ✅ איסוף אומת בפרודקשן (2026-06-18)

סשן גלגל חי הופיע מלא ב-`analytics_events`: `game_start` (honesty-or-challenge, wheel) → 3× `dwell` (pillar=games) → `game_abandoned`. הצינור עובד מקצה לקצה. **ליבת הפרויקט סגורה.**

- [x] תיקון IP — `device_info` שומר רק `ua`. commit `0723adf`, אומת
- [x] גלגל: `game_start` + `dwell` + `game_abandoned` — אומת בפרוד
- [ ] (אופציונלי) לתרגל גם מבוגרים/ליווי/login להשלמת הכיסוי

## ✅ נפרד — PostHog (replay/heatmaps) תוקן

שורש: ה-next-intl middleware הפנה `/ingest/*` ל-`/he/ingest/*`, אז ה-proxy ל-PostHog לא תפס והאירועים חזרו 404 ("waiting for events" ימים). תיקון (commit `438d8ac`): הוספת `ingest` להחרגת ה-matcher ב-`middleware.ts`. אחרי redeploy — לאמת ש-`/ingest/*` מחזיר 2xx ושאירועים מגיעים ל-PostHog (project 457934, US).

> **משימת צד שטופלה (2026-06-17):** באג גלגל "נחיתה על קטגוריה אחת → שאלה מהשנייה". שורש = נתונים, ב-`truth-or-dare` בלבד (question_type הפוך ב-slices). תוקן ע"י מיגרציה 131 (כבר הורצה על פרודקשן → הבאג סגור לגולשים החיים). בנוסף תוקן באג drift משני ב-`Wheel.tsx:471` (איזון קטגוריות) — קוד עדיין מקומי בענף `fix/honesty-challenge-category`, להעלאה כשנוח. honesty-or-challenge ו-never-have-i-ever אומתו תקינים, לא נגעו.

---

## ⬜ לפנינו — שלבים 1→6 (ספר §9)

- [x] **שלב 1 — כיסוי מבוגרים + הרכבת dwell** (commit `64aaf9d`, אומת, מקומי)
  - [x] `useDwellTracking` על ליווי (פר-פרק), מבוגרים (פר-משחק), וסנייקס
  - [x] event `adult_game_opened` (+ `AdultsPlayTracker` חדש)
  - [x] **החלטה:** `adult_level_viewed` נדחה — בורר הרמות הוסר מה-UI (9.6); נשאר ב-enum, לא משודר. `opened`+`dwell` מכסים engagement
  - [x] נשארים על Views מעל `analytics_events` (ללא טבלאות / מיגרציה בשלב 1)
  - [ ] בדיקה מקומית של 3 ה-pillars + אישור Itzik
- [x] **שלב 2 — Views לדשבורד** (commit `6c707ef`+`d3d92fe`, מיגרציה 132, אומת 5/5)
  - [x] `v_user_last_login` · `v_user_activity_level` · `v_chapter_funnel` · `v_service_dwell` · `v_abandonment`
  - [x] **תיקון אימות:** `v_abandonment` — bucket "game" צומצם ל-`game_snakes` בלבד (גלגל/מבוגרים open-ended → engagement נמדד ב-`v_service_dwell`, לא נטישה)
  - [ ] להחיל מיגרציה 132 + להריץ 5 שאילתות בדיקה
- [x] **שלב 3 — מסך פרופיל גולש 360°** (`/dashboard/users/[id]`, commit `361d63c`, אומת)
  - [x] טאבים: כניסות (היסטוריה + heatmap שעות) · שירותים (טיימליין + dwell) · משחקים · מבוגרים · נטישה
  - [x] כפתורי "הגב" ל-threads קיימים (קישור, לא רינדור תוכן)
  - [x] **אומת:** data-loader נקי מתוכן — מטא-דאטה בלבד (גישה א'). admin-only server-side
- [x] **שלב 4 — רשימת לקוחות + חיפוש + סינון** (`/dashboard/users`, commit `8decfff`, מיגרציה 133, אומת)
  - [x] חיפוש שם/מייל/טלפון · פילטר לפי תאריך כניסה / entitlement / רמת פעילות · מיון · pagination — הכל ב-DB (אפס N+1)
  - [ ] **תיקון קל בדרך:** פילטר entitlement נשען על המנוי האחרון בלבד; להחליף ל-3 דגלים בוליאניים (owns_journey/games/adults) לסינון מדויק לבעלי מספר pillars
- [x] **שלב 5 — דשבורד תובנות אגרגטיביות** (`/dashboard/behavior`, commit `23760b8`)
  - [x] "מה עובד ומה לא": משפך פרקים · נטישה לפי context · שעות שיא · dwell ממוצע (גרפי SVG/CSS, בלי תלות חדשה)
  - [x] תיקון entitlement: דגלי owns_journey/games/adults (bool_or על כל המנויים)
- [x] **סקירת קוד עצמאית לפני deploy — SHIP-READY** (פרטיות/אבטחה/כסף/SQL/ביצועים — כולם עברו; 3 פריטי low-sev ל-backlog)
- [ ] **שלב 6 — ליטוש**
  - [ ] heatmap שעות · ייצוא CSV · התראות נטישה (cron) · job retention 12ח' (purge + aggregate)

---

## חלוקת אחריות
- **סוכן Claude Code:** קוד, מיגרציות (לא מריץ), קומיט מקומי בלבד, עצירה לאישור בסוף כל שלב
- **Itzik:** הרצת מיגרציות, בדיקה מקומית, אישור deploy
- **Claude (כאן):** אימות פלט מול אפיון, ניסוח תגובות לסוכן, עדכון הצ'קליסט הזה
