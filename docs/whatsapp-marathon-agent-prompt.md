# Prompt לסוכן AI — מרתון 7 ימים ב-WhatsApp (Route B: טיזר + קישור)

> העתק את כל הבלוק לסוכן הקוד. פיצ'ר נפרד מ-v1 (השליחה מהאדמין) — **ענף/PR משלו**, אל תיגע ב-PR של v1.

---

## מטרה
דריפ אוטומטי של 7 ימים: כל יום נשלחת ללקוח **הודעת WhatsApp קצרה ומאושרת** עם **כפתור קישור** לעמוד התוכן של אותו יום באתר מיאושי. התוכן העשיר (כולל אינטימי) יושב באתר — לא בתבנית — כדי לעמוד במדיניות WhatsApp.

נשען על התשתית הקיימת: `lib/whatsapp/*` (sendTemplate, urlButton), דפוס ה-cron של journey reminders, ו-CMS/CmsText.

## החלטות נעולות
- **Route B בלבד:** תבנית קצרה + קישור. אין 7 תבניות תוכן ואין תוכן מיני בתבנית.
- **תוכן ב-CMS:** מפתחות `marathon.dayN.*` תחת page=marathon (נערך ב-/admin/content, בלי דיפלוי).
- **גישה: קישור אישי (טוקן)** — בלי התחברות. טוקן per-enrollment, לא ניתן לניחוש.
- **מוחרג ממנועי חיפוש:** noindex,nofollow על כל עמודי המרתון + Disallow ב-robots.txt.
- **ערוץ: WhatsApp בלבד** (בלי נפילה למייל ב-v1).

## מה לבנות

### 1. נתונים (migration חדש, המספר הפנוי הבא)
- `marathon_enrollments` (id, user_id, token unique, started_at, status active|completed|stopped, created_at). הטוקן = אקראי ארוך (32 bytes base64url, כדפוס `generate_invitation_token` הקיים).
- `marathon_day_sends` (enrollment_id, day int, sent_at, wa_message_id, status) — אידמפוטנטיות: ייחודי על (enrollment_id, day).

### 2. עמודי תוכן
- ראוט דינמי, למשל `app/[locale]/marathon/[token]/[day]/page.tsx`. הטוקן מאמת זכאות; `day` (1–7) בוחר תוכן. טוקן לא תקין → 404 גנרי.
- התוכן נטען מ-CMS (`marathon.day{N}.title` / `.body` וכו'). עיצוב נקי בקול המותג.
- **`export const metadata = { robots: { index: false, follow: false } }`** + עדכון `robots.txt`/route ל-Disallow `/marathon`.

### 3. תבנית WhatsApp (אחת)
- ב-`lib/whatsapp/templates.ts`: `marathonDayTemplate({ day, token })`.
- Body: טקסט קבוע + `{{1}}` = מספר יום. **לא להתחיל/לסיים במשתנה.** דוגמה לשלד (הנוסח הסופי של Itzik): "היום {{1}} במרתון שלכם מחכה 💛 הפעילות של היום מוכנה, היכנסו לצפות ולהתחיל."
- **כפתור URL דינמי** (urlButton) עם suffix = `${token}/${day}` על בסיס `NEXT_PUBLIC_SITE_URL/he/marathon/`.
- קטגוריה: הגש כ-Utility; אם Meta תסווג ל-Marketing — לקבל (ה-opt-in השיווקי מכסה). עד 1024 תווים, עד 10 אימוji, בלי תוכן מיני.

### 4. הרשמה (enrollment)
- Hook: כשמשתמש משלים הרשמה עם `whatsapp_opt_in = true` ונייד תקין → צור enrollment + token (אם אין כבר). זו ההזמנה למרתון.

### 5. Cron יומי (`app/api/marathon/run/route.ts` + ערך ב-vercel.json)
- לכל enrollment פעיל: חשב את היום הנוכחי לפי `started_at` **בשעון ישראל (DST-aware)**; אם יום זה טרם נשלח (`marathon_day_sends`) → שלח `marathonDayTemplate` דרך `sendTemplate`/`sendWhatsAppToUser`, לוג ל-`whatsapp_messages` + רשומה ב-`marathon_day_sends`.
- אחרי יום 7 → status=completed. כבד opt-out (`whatsapp_opt_out_at`) ו-STOP.
- אימות bearer-secret כדפוס הקראונים הקיים.

### 6. יום 7 = המרה
- עמוד יום 7 = ה-CTA לאבחון/מסע (כפי שכתב Itzik): קישור ל-`/he/journey/assessment`.

## גבולות גזרה
- **בלי תוכן מיני בתבנית** — הוא חי רק בעמודי האתר (noindex).
- **בלי hardcoding** של תוכן — הכל מ-CMS.
- **בלי npm install** מול ה-mount.
- אידמפוטנטיות ה-cron חובה (לא לשלוח יום פעמיים).
- Resolver שעון ישראל/DST — שים לב לקצוות (מעבר שעון).
- ענף/PR נפרד מ-v1. אל תמזג ל-game; פתח PR לסקירה.

## בדיקות וקבלה
- `tsc --noEmit` / `next build` / ESLint עוברים.
- עמוד מרתון: טוקן תקין → תוכן היום; טוקן לא תקין → 404; `robots noindex` בכותרות; לא נכנס ל-sitemap.
- cron אידמפוטנטי (הרצה כפולה לא שולחת כפול); כבוד ל-opt-out.
- enrollment נוצר בהרשמה-עם-opt-in; טוקן ייחודי.
- צ'קליסט QA ידני בתיאור ה-PR. הערה: מסירה חיה רק אחרי טוקן Meta קבוע + אישור התבנית.
