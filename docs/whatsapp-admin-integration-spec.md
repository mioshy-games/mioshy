# WhatsApp באדמין — שליחת הודעות ללקוחות מתוך המערכת

> תוכנית עבודה ואפיון מלא. נכתב 2026-06-14.
> מטרה: לחבר את WhatsApp Cloud API לממשק ההודעות הקיים באדמין, כך שהצוות (אדמין/מאמן/מומחה) ישלח הודעות ללקוחות ב‑WhatsApp ישירות מהמערכת — לצד המייל הקיים.
> מסמך זה נשען על התשתית שכבר נכתבה ב‑`docs/whatsapp-integration-spec.md` (לקוח ה‑API, opt-in, webhook, migration 120).

---

## 1. מה כבר קיים (ולא בונים מחדש)

ממשק ההודעות ללקוחות כבר בנוי ובשל. המערכת תתחבר אליו, לא תחליף אותו:

- **מסך מעקב הודעות מומחה:** `/dashboard/journey/expert-messages` (קומפוננטה `ExpertMessagesView.tsx`) — פיד מאוחד מהטבלאות `journey_messages` + `journey_couple_channel_messages`.
- **שליחה לזוג ספציפי:** `/dashboard/my-clients/[coupleId]` עם `CoupleMessageCompose.tsx` → server action `postCoachCoupleMessage()` ב‑`app/actions/journey-couple-channel.ts` → טבלת `journey_couple_channel_messages`.
- **ערוץ משתמש / per-item:** `app/actions/journey-messages.ts` → טבלת `journey_messages`.
- **כרטיס לקוח:** `/dashboard/users/[id]` — מציג היסטוריית `sent_messages`.
- **מסירה היום:** הוספת הודעה → `notifyUser()` ב‑`lib/journey-content/notifications.ts` → מייל דרך Brevo + לוג ב‑`journey_notifications`. אין SMS/WhatsApp היום.
- **הרשאות:** `requireAdmin()` ב‑`lib/auth/admin.ts` בודק `profiles.role` (admin/expert/partner).
- **מסך מטריקות:** `/dashboard/journey/metrics` (דפוס StatCard) — מקום טבעי לפאנל סטטוס מסירה.

**המהלך:** מוסיפים ל‑compose הקיים בורר ערוץ (מייל / WhatsApp / שניהם), שכבת מסירה ל‑WhatsApp, חשיפת המספר וה‑opt-in באדמין, ומסך נכנס לתגובות. הקוד החדש מתחבר ל‑`postCoachCoupleMessage` ול‑`sendWhatsAppToUser` שכבר תוכננו.

---

## 2. האילוץ שמעצב את כל הפיצ'ר: חלון 24 השעות

זו הנקודה הכי חשובה במסמך. WhatsApp **לא מאפשר** לשלוח טקסט חופשי מתי שרוצים. יש שני מצבים לכל לקוח:

**חלון פתוח (24 שעות מאז שהלקוח שלח לנו הודעה):** מותר לשלוח **טקסט חופשי** — בדיוק מה שהמאמן הקליד. חינם. זה המצב האידיאלי לשיחה דו‑כיוונית.

**חלון סגור (הלקוח לא כתב לנו ב‑24 השעות האחרונות):** **אסור טקסט חופשי.** מותר לשלוח **רק תבנית (template) מאושרת מראש** מקטגוריית Utility. Meta בודקת ומאשרת כל תבנית, ולא מאשרת תבנית שהיא "טקסט חופשי כללי".

מה זה אומר מעשית לאדמין:

1. כשהמאמן רוצה לכתוב הודעה אישית ללקוח שלא כתב לנו לאחרונה (הרוב), אי אפשר לשלוח את הטקסט החופשי כמו שהוא ב‑WhatsApp.
2. הפתרון הסטנדרטי: שולחים **תבנית "נדנוד"** מאושרת ("יש לכם הודעה חדשה מהמלווה במסע, היכנסו לצפות: {{קישור}}"), והתוכן המלא נשאר באפליקציה/מייל. ה‑WhatsApp מושך את הלקוח פנימה.
3. ברגע שהלקוח מגיב ב‑WhatsApp — נפתח חלון 24 שעות, והמאמן יכול לנהל איתו שיחה חופשית מהאדמין, חינם.

**לכן ממשק ה‑compose חייב להיות מודע-חלון:** להראות למאמן אם החלון פתוח (טקסט חופשי) או סגור (בורר תבניות בלבד). בלי זה, הודעות פשוט לא יימסרו והצוות לא יבין למה.

---

## 3. ארכיטקטורה

```
ADMIN compose (קיים)  ──┐
                        │  בורר ערוץ: מייל / WhatsApp / שניהם
                        ▼
postCoachCoupleMessage / postToUserChannel   (server actions קיימים — מורחבים)
                        │
          1) insert הודעה לטבלה הקיימת (journey_*),  notifyUser() למייל כמו היום
                        │
          2) אם נבחר WhatsApp:
                        ▼
        sendWhatsAppToUser({ userId, template | freeText })   (lib/whatsapp — קיים)
                        │  ← בודק opt-in + window state + mobile
            ┌───────────┴───────────┐
       חלון פתוח               חלון סגור
       sendText(...)        sendTemplate(nudge, {url})
                        │
            log → whatsapp_messages + sent_messages (היסטוריה מאוחדת)

WEBHOOK (קיים) → מעדכן status (delivered/read) + רושם הודעות נכנסות
                        ▼
        ADMIN "WhatsApp inbox" — תגובות לקוחות + מענה בחלון
```

---

## 4. שינויי נתונים (מעבר ל‑migration 120 הקיים)

`migration 120` כבר מוסיף ל‑`profiles` את עמודות ה‑opt-in ואת טבלת הלוג `whatsapp_messages`. נדרשות תוספות קטנות כדי שהאדמין "יראה" את התמונה:

**א. מצב חלון 24 שעות לכל לקוח.** נגזר מהודעה נכנסת אחרונה. אפשרויות: עמודה `whatsapp_last_inbound_at timestamptz` ב‑`profiles` שמתעדכנת מה‑webhook בכל הודעה נכנסת (פשוט וזול לקריאה), או חישוב מ‑`whatsapp_messages`. **מומלץ: עמודה ב‑profiles** — קריאה מהירה במסכי אדמין.

**ב. חשיפת המספר וה‑opt-in באדמין.** היום `admin_users_overview` **לא** כולל את `mobile`. צריך view חדש או הרחבה: `mobile`, `whatsapp_opt_in`, `whatsapp_opt_out_at`, `whatsapp_last_inbound_at`, וסטטוס המסירה האחרון מ‑`whatsapp_messages`.

**ג. קטלוג תבניות דינמי.** לפי העיקרון "אדמין דינמי, בלי hardcoding" — טבלה `whatsapp_templates` (או הרחבת `message_templates` הקיימת) עם: `name`, `category`, `language`, `variables` (jsonb), `is_active`, תיאור ידידותי בעברית. בורר התבניות באדמין נקרא מכאן, כך שאפשר להוסיף תבנית בלי דיפלוי.

---

## 5. שינויי הממשק באדמין (לפי מסך)

הכל בעיצוב הקומפקטי הקיים (Section+Field, section-nav, StatCard) — בלי Card chrome כבד.

### 5.1 כרטיס לקוח `/dashboard/users/[id]` — פאנל WhatsApp חדש
מציג: מספר נייד, סטטוס opt-in (✓/✗/הוסר), אינדיקטור חלון ("חלון פתוח — אפשר טקסט חופשי" / "חלון סגור — תבנית בלבד"), ו‑5 ההודעות האחרונות מ‑`whatsapp_messages` עם סטטוס מסירה (נשלח/נמסר/נקרא/נכשל).

### 5.2 compose הקיים — בורר ערוץ
ב‑`CoupleMessageCompose.tsx` ובמלחין ערוץ המשתמש מוסיפים:
- **בורר ערוץ:** מייל / WhatsApp / שניהם (ברירת מחדל: מייל, כמו היום — אפס רגרסיה).
- **מודעות-חלון:** אם נבחר WhatsApp והחלון סגור → תיבת הטקסט החופשי מתחלפת ב**בורר תבנית** + שדות המשתנים שלה. אם פתוח → טקסט חופשי מותר.
- **שמירת בטיחות:** אם ללקוח אין נייד או אין opt-in → אופציית WhatsApp מושבתת עם הסבר ("הלקוח לא אישר WhatsApp") ונפילה אוטומטית למייל.

### 5.3 "WhatsApp Inbox" — מסך תגובות נכנסות (שלב 2)
מסך חדש תחת `/dashboard/journey/whatsapp` (או טאב במעקב ההודעות): פיד הודעות נכנסות מ‑`whatsapp_messages` (direction=inbound), מקובץ לפי לקוח, עם אינדיקטור חלון ותיבת מענה (טקסט חופשי, תקף בחלון). מאפשר שיחה דו‑כיוונית אמיתית.

### 5.4 פאנל סטטוס במטריקות
ב‑`/dashboard/journey/metrics`: כרטיסי StatCard — נשלחו / נמסרו / נקראו / נכשלו (היום/השבוע), ו‑opt-in rate. נתונים מ‑`whatsapp_messages`.

---

## 6. תבניות לאישור ב‑WhatsApp Manager

מעבר לשתי התבניות מהאפיון הראשון (`journey_reminder`, `partner_invite`), האדמין צריך לפחות תבנית "נדנוד" גנרית אחת כדי לשלוח ללקוחות מחוץ לחלון:

**`coach_nudge` (Utility):**
> יש לכם הודעה חדשה מהמלווה במסע הזוגי 💛 {{1}}, היכנסו לקרוא ולהשיב: {{2}}

{{1}} שם, {{2}} קישור לשיחה באפליקציה. כפתור URL.

ניסוח בקול של מיאושי (`feedback_copy_voice_mioshy`) — פונה ב"אתם/שלכם", בלי "כלים", בלי שלשות. שומרים על אופי טרנזקציוני כדי שיישאר Utility.

---

## 7. תוכנית עבודה — שלבים

**שלב 0 — הגדרת Meta (כבר בוצע ברובו ✅).** אפליקציה, מספר טסט, הודעת בדיקה עברה. נותר: טוקן קבוע (System User) + מספר ישראלי אמיתי לפני production, וחיבור webhook אחרי דיפלוי.

**שלב 1 — תשתית ונראות (Foundation).** הרצת migration 120; עמודת `whatsapp_last_inbound_at`; view אדמין מורחב עם mobile + opt-in; פאנל WhatsApp בכרטיס הלקוח (קריאה בלבד — רואים מספר, opt-in, היסטוריה). *תוצר: הצוות רואה מי ניתן להודעה.*

**שלב 2 — opt-in מהלקוח.** צ'קבוקס opt-in בהשלמת פרופיל/הרשמה שכותב ל‑`profiles.whatsapp_opt_in`. בלי זה אין למי לשלוח. *תוצר: מתחילים לצבור מאושרים.*

**שלב 3 — שליחה יוצאת מה‑compose (הליבה).** בורר ערוץ + מודעות-חלון ב‑`CoupleMessageCompose`; הרחבת `postCoachCoupleMessage` לענף WhatsApp דרך `sendWhatsAppToUser`; לוג ל‑`whatsapp_messages` + `sent_messages`. *תוצר: הצוות שולח WhatsApp מהמערכת.*

**שלב 4 — webhook + Inbox נכנס.** חיבור ה‑webhook ב‑Meta (callback URL + verify token, מנוי ל‑`messages`); עדכון סטטוסים + הודעות נכנסות; מסך WhatsApp Inbox עם מענה בחלון. *תוצר: שיחה דו‑כיוונית.*

**שלב 5 — תבניות דינמיות + מטריקות.** טבלת `whatsapp_templates` + בורר דינמי; פאנל סטטוס מסירה במטריקות. *תוצר: הוספת תבניות בלי דיפלוי, ובקרה.*

**שלב 6 — Production hardening.** טוקן קבוע, מספר ישראלי, rate-limit, התראות כשל, גיבוי נפילה למייל בכל מסלול.

---

## 8. סיכונים ונקודות החלטה

**אילוץ החלון** הוא הסיכון העיקרי לחוויית הצוות — אם לא נבהיר ב‑UI מתי אפשר טקסט חופשי, הצוות יחשוב ש"זה לא עובד". שלב 3 חייב את מודעות-החלון, לא אופציונלי.

**opt-in הוא צוואר הבקבוק העסקי** — בלי בסיס מאושרים גדול, לכלי אין למי לשלוח. כדאי להקדים את שלב 2 ולהריץ קמפיין opt-in למשתמשים קיימים (דרך המייל הקיים).

**עלות:** Utility בישראל זול (מתחת ל‑$0.03 להודעה), ותגובות בחלון חינם. נדנוד יוצא מחוץ לחלון — תעריף Utility. בקרה תהיה במטריקות (שלב 5).

**החלטות שנסגרו (2026-06-14):**
- **הרשאה:** רק `role = admin` שולח WhatsApp בשלב זה (לא מאמן/מומחה).
- **היקף v1:** יוצא בלבד (שלבים 1–3). Inbox נכנס (שלב 4) נדחה לגרסה הבאה.

**עדיין פתוח (Itzik כותב בעצמו):**
- ניסוח תבנית `coach_nudge` (סעיף 6) — לפני הגשה ל‑Meta.
- ניסוח צ'קבוקס ה‑opt-in (שלב 2).

---

## 9. מקורות

- אפיון התשתית: `docs/whatsapp-integration-spec.md`
- [Meta — חלון השירות ותמחור per-message](https://www.uptail.ai/blog/whatsapp-business-api-pricing-2026-what-it-costs-and-how-billing-works)
- [Meta — Template fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
