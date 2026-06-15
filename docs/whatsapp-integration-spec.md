# הטמעת Meta WhatsApp Cloud API במיאושי — אפיון ותוכנית עבודה

> מסמך עבודה. נכתב 2026-06-14. שתי תרחישי שימוש ראשונים: **תזכורות Journey** ו**הזמנת בן/בת זוג**.

---

## 1. רקע ותחום

מיאושי שולחת היום הודעות יוצאות דרך מייל בלבד (Brevo, ב‑`lib/journey-content/notifications.ts`). אנחנו מוסיפים ערוץ WhatsApp כערוץ נוסף — לא מחליפים את המייל אלא רצים לצידו, עם נפילה חזרה למייל כשאין מספר/הסכמה.

WhatsApp Cloud API הוא ה‑API המתארח של Meta: שולחים ומקבלים הודעות דרך Graph API, בלי שרת משלנו. כל פנייה יזומה מחוץ לחלון השירות של 24 שעות חייבת להישלח כ**template** מאושר מראש.

**גרסת Graph API:** `v23.0` (יציבה ב‑2026, ניתנת להחלפה דרך משתנה סביבה).

---

## 2. החלטות מפתח על התמחור (משפיע על העיצוב)

מודל התמחור השתנה ב‑1 ביולי 2025 מתמחור לפי שיחה ל**תמחור per-message** — כל הודעת template שמגיעה מחויבת בנפרד. הקטגוריות:

- **Utility** (תזכורות, אישורים, התראות חשבון) — זול, בדרך כלל מתחת ל‑$0.03 להודעה, ולעיתים חינם.
- **Marketing** (קידום, מבצעים) — היקר ביותר, משתנה לפי מדינת הנמען.
- **Authentication** (קודי OTP) — זול.
- **Service** (תגובה שלנו תוך 24 שעות מהודעה נכנסת של המשתמש) — **חינם, ללא תקרה**.

נקודות שמכתיבות לנו את הארכיטקטורה:

1. **התעריף נקבע לפי קוד המדינה של הנמען**, לא לפי מיקום העסק. רוב המשתמשים בישראל.
2. **Utility בתוך חלון 24 שעות = חינם.** אם המשתמש שלח לנו הודעה ב‑24 השעות האחרונות, ה‑template היוצא בקטגוריית Utility לא עולה כלום. מחוץ לחלון — משלמים תעריף Utility.
3. שתי תרחישי השימוש שלנו (תזכורת Journey, הזמנת בן/בת זוג) הם **Utility** מבחינת קטגוריה — לא Marketing. זה זול וגם עובר אישור Meta הרבה יותר בקלות. חשוב לנסח את התבניות כך שיישארו Utility (טרנזקציוני, ספציפי למשתמש) ולא ייפסלו ל‑Marketing.

> מסקנה: מתחילים מ‑Utility templates בלבד. לא נוגעים ב‑Marketing בשלב הזה — זה ידרוש opt-in שיווקי נפרד ועולה יותר.

---

## 3. דרישות הסכמה (Opt-in)

Meta דורשת הסכמה מפורשת לפני שליחת template למשתמש, ושנוכל להציג **היכן** ההסכמה נאספה. הסטנדרט ל‑2026 מחמיר: צריך לתעד מקור opt-in אחד לפחות (טופס באתר / הרשמה / CRM).

**העיצוב שלנו:**

- מוסיפים צ'קבוקס opt-in ל‑WhatsApp בזרימת ההרשמה/השלמת הפרופיל (שם, מייל, נייד כבר נאספים — ראה `feedback_play_requires_full_profile`). הניסוח: "אני מאשר/ת לקבל תזכורות והודעות עדכון מהמסע הזוגי ב‑WhatsApp."
- שומרים ב‑`profiles`: `whatsapp_opt_in`, `whatsapp_opt_in_at`, `whatsapp_opt_in_source`.
- כל הודעה נכנסת עם תוכן הסרה ("הסר" / "STOP") → מסמנים `whatsapp_opt_out_at` ומפסיקים לשלוח.
- ה‑helper לשליחה **לא ישלח** למשתמש בלי opt-in פעיל וללא opt-out — נפילה אוטומטית למייל.

---

## 4. ארכיטקטורה

הקוד עוקב אחרי הדפוסים הקיימים בריפו: לקוח HTTP בסגנון `lib/uxellent-api.ts` (לעולם לא זורק, retry עם backoff, החזרה מובנית), כתיבות דרך ה‑admin client, ולוגים לטבלה ייעודית.

```
lib/whatsapp/
  phone.ts          → נרמול מספרים ישראליים ל‑E.164 ללא '+' (05X → 9725XXXXXXXX)
  client.ts         → לקוח Cloud API גולמי: sendTemplate / sendText / markRead
  templates.ts      → שמות תבניות + בוני פרמטרים לשני התרחישים
  notifications.ts  → helper גבוה: sendWhatsAppToUser — בודק opt-in, שולח, מלוגג, נופל למייל
  verify.ts         → אימות חתימת webhook (X-Hub-Signature-256)

app/api/whatsapp/webhook/route.ts → GET (verify) + POST (status updates + הודעות נכנסות + opt-out)

supabase/migrations/097_whatsapp_messaging.sql → עמודות opt-in ב‑profiles + טבלת whatsapp_messages
```

### זרימת שליחה (יוצאת)

```
cron תזכורת קיים
      │
      ▼
sendWhatsAppToUser({ userId, template, params })
      │  ← resolve mobile + opt-in מ‑profiles (admin client)
      ├─ אין נייד / אין opt-in / יש opt-out → return { fellBackToEmail: true }  (הקוד הקורא שולח מייל כרגיל)
      ▼
client.sendTemplate(phone, name, lang, components)
      │
      ├─ ok → log whatsapp_messages (status=sent, wa_message_id=wamid)
      └─ fail → log (status=failed, error) + return כדי שהקורא יפול למייל
```

### זרימת קבלה (webhook)

```
Meta → POST /api/whatsapp/webhook
      │  ← אימות X-Hub-Signature-256 מול WHATSAPP_APP_SECRET
      ├─ statuses[] → עדכון whatsapp_messages לפי wa_message_id (delivered/read/failed)
      └─ messages[] (הודעה נכנסת)
            ├─ טקסט "הסר"/"stop"/"בטל" → set whatsapp_opt_out_at
            └─ אחרת → log inbound (פותח חלון שירות 24ש' — הודעות utility חינם בחלון)
```

---

## 5. סכימת DB (migration 120)

מוסיף ל‑`public.profiles`:

| עמודה | טיפוס | ברירת מחדל |
|---|---|---|
| `whatsapp_opt_in` | boolean | false |
| `whatsapp_opt_in_at` | timestamptz | null |
| `whatsapp_opt_in_source` | text | null |
| `whatsapp_opt_out_at` | timestamptz | null |

טבלה חדשה `public.whatsapp_messages` (לוג + מעקב סטטוס):

| עמודה | טיפוס |
|---|---|
| `id` | uuid (pk) |
| `recipient_user_id` | uuid |
| `to_phone` | text |
| `direction` | text (outbound/inbound) |
| `template_name` | text |
| `category` | text |
| `wa_message_id` | text (wamid של Meta) |
| `status` | text (queued/sent/delivered/read/failed) |
| `error` | jsonb |
| `payload` | jsonb |
| `created_at` / `updated_at` | timestamptz |

אינדקסים: `wa_message_id` (לעדכון מ‑webhook), `recipient_user_id`, `status`.

---

## 6. תבניות (Templates) — להגשה לאישור ב‑WhatsApp Manager

שתי תבניות utility, דו‑לשוניות (עברית + אנגלית = שתי גרסאות שפה לאותו שם תבנית). דוגמאות לניסוח שמתאים לקול של מיאושי (`feedback_copy_voice_mioshy` — מדבר ב"אתם/שלכם", לא "כלים", לא rule-of-three):

**`journey_reminder` (Utility):**
> פרק חדש מחכה לכם במסע הזוגי 💛 {{1}} ו{{2}}, הקדישו כמה דקות הערב אחד לשני. {{3}}

פרמטרים: {{1}} שם, {{2}} שם בן/בת הזוג, {{3}} קישור קצר לפרק. כפתור CTA מסוג URL לעמוד המסע.

**`partner_invite` (Utility):**
> {{1}} מזמין/ה אתכם להצטרף למסע הזוגי במיאושי. הצטרפו כאן: {{2}}

פרמטר: {{1}} שם המזמין, {{2}} קישור ההזמנה עם הטוקן הקיים (`couple_invitations.token`).

> הערה: השאר את הניסוח טרנזקציוני וספציפי כדי שהתבנית תאושר כ‑Utility ולא תיפסל ל‑Marketing.

---

## 7. תוכנית עבודה — שלב אחר שלב

### שלב 0 — צד Meta (אתה עושה, אני מנחה)
1. ב‑Meta Business Manager הקיים (זה שמשמש לקמפיינים) → **WhatsApp Manager** → צור WhatsApp Business Account (WABA).
2. הוסף מספר טלפון ייעודי ל‑API (לא מספר שמחובר לאפליקציית WhatsApp רגילה; חייב לקבל SMS/שיחה לאימות).
3. צור **System User** עם הרשאות `whatsapp_business_messaging` + `whatsapp_business_management` והפק **Permanent Access Token**.
4. אסוף: `Phone Number ID`, `WABA ID`, `App ID`, `App Secret`, ה‑Token.
5. הגש את שתי התבניות (סעיף 6) לאישור — לוקח דקות עד שעות.

### שלב 1 — תשתית קוד (מוכן בריפו)
- migration 120 (סכימה + לוג).
- `lib/whatsapp/*` (client, phone, templates, notifications, verify).
- `app/api/whatsapp/webhook/route.ts`.
- משתני סביבה (סעיף 8).

### שלב 2 — חיווט ה‑webhook
- פרוס לסביבת preview/prod, רשום את ה‑Callback URL ב‑App Dashboard, הגדר Verify Token, הירשם לשדה `messages`.
- בדיקה: שלח הודעת test מהמספר → ודא רישום ב‑`whatsapp_messages`.

### שלב 3 — opt-in
- הוסף צ'קבוקס opt-in לזרימת הפרופיל, כתיבה ל‑`profiles.whatsapp_opt_in`.

### שלב 4 — חיווט תזכורות + הזמנות
- בתוך הקראונים הקיימים (`app/api/journey/d1-reminders/route.ts`, `app/api/journey/reminders/route.ts`) — לפני שליחת המייל, נסה `sendWhatsAppToUser(...)`; אם החזיר `fellBackToEmail` — שלח מייל כרגיל. שתי-שלוש שורות לכל אתר קריאה (ראה סעיף 9).
- בהזמנת בן/בת זוג (`lib/between-us/invitations.ts`) — אם למוזמן יש נייד, שלח גם `partner_invite`.

### שלב 5 — בקרה ומדידה
- מעקב סטטוסים (delivered/read/failed) מגיע מ‑webhook לטבלת הלוג. אופציונלי: כרטיס במסך האדמין.

---

## 8. משתני סביבה (להוסיף ל‑Vercel + `.env.local`)

```bash
WHATSAPP_API_VERSION=v23.0
WHATSAPP_PHONE_NUMBER_ID=            # מצד Meta
WHATSAPP_BUSINESS_ACCOUNT_ID=        # WABA ID
WHATSAPP_ACCESS_TOKEN=               # Permanent token של ה‑System User
WHATSAPP_APP_SECRET=                 # לאימות חתימת webhook
WHATSAPP_WEBHOOK_VERIFY_TOKEN=       # מחרוזת שאתה ממציא, מזינים אותה גם ב‑Meta
```

---

## 9. דוגמת חיווט בקראון קיים (לא נכתב אוטומטית — להחלטתך)

```ts
// בתוך לולאת התזכורת, לפני שליחת המייל:
import { sendWhatsAppToUser } from "@/lib/whatsapp/notifications";
import { journeyReminderTemplate } from "@/lib/whatsapp/templates";

const wa = await sendWhatsAppToUser({
  userId: user.id,
  ...journeyReminderTemplate({ name, partnerName, itemUrl }),
});

if (wa.fellBackToEmail) {
  await sendReminderEmail(/* כמו היום */);
}
```

---

## 10. מה אני צריך ממך (checklist)

מצד Meta (שלב 0):
- [ ] `WHATSAPP_PHONE_NUMBER_ID`
- [ ] `WHATSAPP_BUSINESS_ACCOUNT_ID` (WABA ID)
- [ ] `WHATSAPP_ACCESS_TOKEN` (permanent, System User)
- [ ] `WHATSAPP_APP_SECRET`
- [ ] אישור שתי התבניות (`journey_reminder`, `partner_invite`) — או אישור שלך לניסוח בסעיף 6 לפני הגשה.

החלטות:
- [ ] מספר הטלפון הייעודי שיוקדש ל‑API (לא משמש ב‑WhatsApp רגיל).
- [ ] אישור שמתחילים מ‑Utility בלבד (בלי Marketing בשלב הזה).
- [ ] אישור הניסוח של צ'קבוקס ה‑opt-in.
- [ ] באיזו סביבה לחבר את ה‑webhook קודם (preview או production).

---

## מקורות

- [Meta — WhatsApp Cloud API Get Started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)
- [Meta — Template fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- [Meta — Webhooks overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/)
- [WhatsApp Business API Pricing 2026 — per-message rates](https://www.uptail.ai/blog/whatsapp-business-api-pricing-2026-what-it-costs-and-how-billing-works)
