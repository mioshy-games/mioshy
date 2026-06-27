# Prompt לסוכן AI — הטמעת שליחת WhatsApp באדמין (v1)

> העתק את כל הבלוק שמתחת לקו לסוכן הקוד. זה מגדיר היקף מדויק, גבולות גזרה וקריטריוני קבלה.

---

## משימה

הטמע **שליחת WhatsApp יוצאת מהאדמין** במיאושי, לפי `docs/whatsapp-admin-integration-spec.md`, **שלבים 1–3 בלבד** (Foundation + opt-in + שליחה מה‑compose). אל תיגע בשלבים 4–6 (Inbox נכנס, תבניות דינמיות, מטריקות, production hardening).

תשתית ה‑API כבר קיימת ועובדת — **אל תכתוב אותה מחדש**, רק חבר אליה:
- `lib/whatsapp/client.ts` — `sendTemplate`, `sendText`, `markRead`, `getWhatsAppConfig`
- `lib/whatsapp/notifications.ts` — `sendWhatsAppToUser` (בודק opt-in + נייד, מלוגג, נופל למייל)
- `lib/whatsapp/phone.ts`, `lib/whatsapp/templates.ts`, `lib/whatsapp/verify.ts`
- `app/api/whatsapp/webhook/route.ts` — GET verify + POST statuses/inbound/opt-out
- migration `supabase/migrations/120_whatsapp_messaging.sql` — opt-in cols ב‑profiles + טבלת `whatsapp_messages`

## החלטות נעולות
- **רק `role = 'admin'`** רשאי לשלוח WhatsApp (לא expert/partner). גם אם ה‑compose משותף, אפשרות ה‑WhatsApp מוצגת ופעילה רק ל‑admin.
- **v1 = יוצא בלבד.** לא בונים מסך תגובות נכנסות.
- אילוץ מרכזי: WhatsApp מתיר טקסט חופשי **רק בתוך חלון 24 שעות** מאז הודעה נכנסת אחרונה של הלקוח. מחוץ לחלון — **רק תבנית מאושרת** (`coach_nudge`). ה‑UI חייב להיות מודע-חלון.

## מה לבנות

### שלב 1 — נתונים ונראות
1. migration חדש (המספר הפנוי הבא, **121+**, אידמפוטנטי): הוסף `profiles.whatsapp_last_inbound_at timestamptz`. עדכן את `app/api/whatsapp/webhook/route.ts` כך שכל הודעה נכנסת תעדכן עמודה זו ללקוח (match לפי `mobile` suffix, כמו ה‑opt-out הקיים).
2. בכרטיס הלקוח `app/dashboard/users/[id]/page.tsx` הוסף **פאנל WhatsApp** (server-read דרך admin client): נייד (`profiles.mobile`), סטטוס opt-in, אינדיקטור חלון פתוח/סגור (מ‑`whatsapp_last_inbound_at`), ו‑5 השורות האחרונות מ‑`whatsapp_messages` עם סטטוס מסירה. עיצוב קומפקטי קיים (Section+Field, בלי Card chrome כבד).

### שלב 2 — opt-in מהלקוח
3. הוסף צ'קבוקס opt-in ל‑`components/account/ProfileDetailsForm.tsx` + עדכן `app/[locale]/account/profile/actions.ts` לכתוב `whatsapp_opt_in`, `whatsapp_opt_in_at`, `whatsapp_opt_in_source='profile'`. הצ'קבוקס **customer-facing** → mobile-first, בלי לגעת בעיצוב desktop. **אל תמציא טקסט** — השתמש במפתח i18n/CMS (he.json/en.json) עם placeholder; Itzik יספק את הנוסח הסופי.

### שלב 3 — שליחה מה‑compose (הליבה)
4. הרחב את `components/dashboard/coach/CoupleMessageCompose.tsx` (וכן מלחין ערוץ המשתמש אם רלוונטי) עם **בורר ערוץ**: מייל / WhatsApp / שניהם. **ברירת מחדל = מייל** (אפס רגרסיה).
5. מודעות-חלון: אם נבחר WhatsApp והחלון **סגור** → החלף את תיבת הטקסט החופשי ב**בורר תבנית** (ל‑v1: רק `coach_nudge`, עם שדות שם + קישור). אם **פתוח** → טקסט חופשי מותר (יישלח דרך `sendText`).
6. הרחב את `app/actions/journey-couple-channel.ts` (`postCoachCoupleMessage`) ואת ה‑action של ערוץ המשתמש: אחרי ה‑insert הקיים ושליחת המייל, אם נבחר WhatsApp → קרא לשכבת ה‑WhatsApp. הרחב את `lib/whatsapp/notifications.ts` כך שיתמוך גם ב**טקסט חופשי בחלון** וגם ב**תבנית מחוץ לחלון** (בחירה אוטומטית לפי `whatsapp_last_inbound_at`). לוג ל‑`whatsapp_messages` + רשומת היסטוריה ב‑`sent_messages`.

## גבולות גזרה (חובה)
- **אל תשבור את מסלול המייל הקיים.** WhatsApp הוא תוספת; כשלא נבחר — התנהגות זהה להיום.
- **גייטינג:** השתמש ב‑`requireAdmin()` (`lib/auth/admin.ts`). אפשרות WhatsApp מוסתרת אם: המשתמש אינו admin, ללקוח אין `mobile`, אין `whatsapp_opt_in` (או יש `whatsapp_opt_out_at`), או `getWhatsAppConfig()` מחזיר null (לא מוגדר) — כך שאפשר לדפלוי בבטחה לפני שהכל מחובר.
- **Supabase SSR:** resolve auth דרך session client, mutate דרך admin client (הדפוס הקיים).
- **בלי הוספת תלויות npm. אל תריץ `npm/pnpm install`** מול תיקיית הפרויקט (ה‑mount). הכל עם `fetch` מובנה.
- **בלי hardcoding** של תוכן/תבניות — תבניות נקראות מ‑`lib/whatsapp/templates.ts` הקיים; טקסט משתמש מ‑i18n/CMS.
- אל תגיש תבניות ל‑Meta ואל תכניס נוסח סופי — Itzik מטפל בזה בנפרד.
- שמור על קול המותג בכל מחרוזת גלויה: פנייה ב"אתם/שלכם", בלי "כלים", **בלי שלשות (rule-of-three)**.

## בדיקות וקריטריוני קבלה (להסגרה)
- `tsc --noEmit` עובר, `next build` עובר, אין lint errors חדשים.
- בורר ערוץ ברירת-מחדל מייל; שליחת מייל בלבד מתנהגת בדיוק כמו לפני השינוי.
- אפשרות WhatsApp מוסתרת נכון בכל מקרי הקצה (לא admin / אין נייד / אין opt-in / לא מוגדר).
- שליחה מצליחה נרשמת ב‑`whatsapp_messages` (status=sent) ומופיעה בפאנל הלקוח; כשל נרשם (status=failed) ולא מפיל את ה‑action.
- migration אידמפוטנטי וממוספר נכון (121+); webhook מעדכן `whatsapp_last_inbound_at`.
- אין שינוי בעיצוב desktop של טופס הפרופיל.
- ספק checklist קצר של מה נבדק ידנית.

## הערה
טוקן הבדיקה של Meta זמני (24ש') ותבנית `coach_nudge` עדיין לא מאושרת — לכן בדיקת מסירה חיה מלאה תתאפשר רק אחרי טוקן קבוע + אישור תבנית. בנה כך שהכל עובד ברגע שיש טוקן תקף + תבנית מאושרת, ומתנהג בחן (מוסתר/נופל למייל) עד אז.
