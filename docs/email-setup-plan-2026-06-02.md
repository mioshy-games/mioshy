# תוכנית עבודה: הקמת תשתית מייל לדומיין mioshy.com

תאריך: 2026-06-02
מטרה: כל המיילים היוצאים יישלחו מ-`@mioshy.com` במקום מ-Gmail / מ-Supabase ברירת מחדל. ללא נגיעה בקוד בשלב זה — רק קונפיגורציה חיצונית (DNS, Supabase, Brevo, ספק מיילים).

---

## מצב היום (סיכום ממצאים)

- כתובת תמיכה ציבורית באתר: `support@mioshy.com` — מופיעה ב-Footer, צור קשר, תקנון, פרטיות, FAQ, brand.json. **לא ברור אם תיבה אמיתית קיימת או שזו רק כתובת מוצגת.**
- מייל פנימי של הצוות: `mioshyoffice@gmail.com` (Gmail רגיל) — משמש כ-admin login.
- שליחה מ-Brevo (טרנזקציוני, journey, התראות): קיים `BREVO_API_KEY`, אבל `BREVO_SENDER_EMAIL` **לא מוגדר** — בפועל שליחות מדלגות בפיתוח, ובפרודקשן הן מסתמכות על fallback `no-reply@mioshy.co.il` שגם הוא לא מאומת.
- Supabase Auth (איפוס סיסמה, אימות הרשמה, OTP): שולח כיום מהשרת ברירת-המחדל של Supabase — `noreply@mail.app.supabase.io`. נחות מבחינת אמינות, מסיים לעיתים ב-spam, ופוגע במיתוג.

---

## יעד סופי

| תפקיד | כתובת | סוג | ספק שליחה |
|---|---|---|---|
| שליחת מיילי מערכת אוטומטיים | `no-reply@mioshy.com` | send-only | Brevo + Supabase SMTP |
| תמיכה / פניות לקוחות | `support@mioshy.com` | inbox דו-כיווני | Google Workspace / Zoho |
| ניהול / חשבוניות / כללי | `office@mioshy.com` | inbox דו-כיווני | Google Workspace / Zoho |
| Reply-To למיילים שיוצאים | `support@mioshy.com` | קופץ לתיבת התמיכה | — |

---

## שלב 1 — תיבות דואר (Mailbox provider)

החלטה ראשונה שצריך לקבל: איזה ספק מארח את התיבות.

**אפשרות A — Google Workspace** (~$7/חודש ליוזר): מוכר, אינטגרציה עם Gmail הקיים `mioshyoffice@gmail.com`, ארכיון נוח, Calendar/Drive בונוס.

**אפשרות B — Zoho Mail** (חינם עד 5 משתמשים בדומיין אחד, או $1/חודש לתכנית בתשלום): זול משמעותית, מספיק לגמרי לתמיכה בלבד, פחות מוכר אבל יציב.

**אפשרות C — Forwarding בלבד** (ImprovMX / Cloudflare Email Routing — חינם): `support@mioshy.com` → forwarder ל-`mioshyoffice@gmail.com`. **חיסרון:** תשובות יוצאות מ-Gmail עם כתובת `mioshyoffice@gmail.com` (אלא אם מגדירים "Send As" ב-Gmail עם SMTP חיצוני).

**המלצה:** Google Workspace ל-2 תיבות (`support`, `office`). הופך את `mioshyoffice@gmail.com` למיותר עם הזמן, ונותן ניהול נקי.

פעולות:
1. רכישת תוכנית ב-Google Workspace עבור הדומיין `mioshy.com`.
2. אימות בעלות על הדומיין (TXT record).
3. יצירת המשתמשים `support@mioshy.com` ו-`office@mioshy.com`.
4. הוספת MX records של Google ב-DNS.
5. הגדרת `mioshyoffice@gmail.com` כ-forward זמני לתיבת `office@` עד למעבר מלא.

---

## שלב 2 — DNS authentication (SPF / DKIM / DMARC)

קריטי כדי שמיילים לא יגיעו ל-spam. נדרש פעם אחת ברמת הדומיין.

פעולות בלוח ה-DNS של `mioshy.com`:

1. **SPF** — רשומת TXT אחת המאגדת את כל שולחי המיילים שלנו:
   `v=spf1 include:_spf.google.com include:spf.brevo.com include:amazonses.com ~all`
   (`amazonses.com` הוא ה-relay של Supabase).
2. **DKIM** — שלוש מפתחות נפרדים:
   - DKIM של Google Workspace (נוצר בקונסול אחרי הקמת התיבות).
   - DKIM של Brevo (`mail._domainkey.mioshy.com` — Brevo נותן את הערך אחרי "Authenticate domain").
   - DKIM של Supabase SMTP (יסופק מספק ה-SMTP שנבחר בשלב 3).
3. **DMARC** — רשומת TXT:
   `_dmarc.mioshy.com  TXT  "v=DMARC1; p=quarantine; rua=mailto:office@mioshy.com; pct=100; adkim=s; aspf=s"`
   להתחיל ב-`p=none` למשך שבוע לאיסוף דוחות, ואז להעלות ל-`quarantine` ובהמשך ל-`reject`.
4. **MX** — של Google Workspace בלבד (Brevo ו-Supabase שולחים בלבד, לא מקבלים).

זמן התפלגות DNS: עד 24 שעות. רצוי לבצע בשעות לילה.

---

## שלב 3 — Supabase: SMTP custom

כיום Supabase משתמש ב-SMTP פנימי שלו. החלפה ל-SMTP חיצוני גורמת לכך שכל מיילי האימות, איפוס סיסמה, וה-magic link יצאו מ-`no-reply@mioshy.com`.

**בחירת ספק SMTP** — שתי אפשרויות פרקטיות:

**אפשרות 1 — Brevo SMTP** (מומלץ): כבר משלמים, כבר מוגדר API key, אותו DKIM. חסכוני.

**אפשרות 2 — Amazon SES / Resend / Postmark**: יציב מאוד, אבל מוסיף ספק נוסף לתחזק.

**המלצה:** Brevo SMTP (אותו spf/dkim ששימש לטרנזקציוני). 

פעולות:
1. ב-Brevo: יצירת SMTP key חדש ייעודי ל-Supabase (Settings → SMTP & API → SMTP).
2. ב-Brevo: אימות `no-reply@mioshy.com` כ-sender.
3. ב-Supabase Dashboard → Authentication → Email Templates → SMTP Settings:
   - Enable Custom SMTP: ✓
   - Sender email: `no-reply@mioshy.com`
   - Sender name: `Mioshy`
   - Host: `smtp-relay.brevo.com`
   - Port: `587`
   - Username: ה-SMTP login של Brevo
   - Password: ה-SMTP key שנוצר
   - Minimum interval: 60s (מגן מ-spam-loop).
4. ב-Supabase → Authentication → Email Templates: **תרגום ועיצוב 5 התבניות לעברית** (Confirm signup, Magic link, Change email, Reset password, Reauthentication). יישור RTL, לוגו Mioshy, כפתור CTA במותג.
5. הגדרת `Site URL` ו-`Redirect URLs` ב-Supabase כך שהקישורים בתבניות יחזירו ל-`https://mioshy.com/auth/...` (לוודא ש-redirect מתיישב עם `app/[locale]/auth/forgot/page.tsx`).

---

## שלב 4 — Brevo: שליחה טרנזקציונית מ-mioshy.com

קיים, אבל ה-sender לא מוגדר. השלמה:

פעולות:
1. ב-Brevo → Senders & IP → Authenticate domain: הוספת `mioshy.com`, העתקת רשומת ה-DKIM ל-DNS (שלב 2 לעיל).
2. הוספת sender `no-reply@mioshy.com` (לאוטומציות, journey, התראות).
3. הוספת sender `support@mioshy.com` (לתשובות יזומות מהמערכת אם נדרש בעתיד).
4. הגדרת ENV vars ב-Vercel (Production + Preview + Development):
   - `BREVO_SENDER_EMAIL=no-reply@mioshy.com`
   - `BREVO_SENDER_NAME=Mioshy`
   - `BREVO_FROM_EMAIL=no-reply@mioshy.com` (משמש את `lib/journey-content/notifications.ts`)
5. עדכון `.env.local` מקומי עם אותם ערכים.
6. בדיקה: שליחת test email מ-Brevo ל-Gmail + Outlook + iCloud + ProtonMail — לוודא הגעה ל-Inbox ולא ל-Spam, ושה-DKIM/SPF/DMARC מציגים `pass` ב-headers.

---

## שלב 5 — Reply-To ו-bounces

`no-reply@mioshy.com` היא send-only. שני סיכונים שצריך לטפל בהם:

1. **תשובות של משתמשים** — חלק יחזירו על המייל. צריך אחת משתיים:
   - להגדיר את `no-reply@` כ-forward ל-`support@mioshy.com` (לא אידיאלי — מערבב).
   - להוסיף `Reply-To: support@mioshy.com` בכל מייל יוצא (זה מצריך נגיעה קלה בקוד — מחוץ לתוכנית הנוכחית, אבל לתיעוד).
2. **Bounces / soft-fails** — Brevo ו-Supabase מטפלים פנימית. לוודא ש-Brevo webhook ל-bounces מוגדר (כבר קיים: `api/brevo/unsubscribe-webhook` — להוסיף גם bounce handler אם רלוונטי).

החלטה דרושה מהמשתמש: האם תשובות ל-no-reply נופלות אוטומטית ל-support, או נשלחות bounce עם הודעה "אנא פנה ל-support@mioshy.com"?

---

## שלב 6 — מבחן end-to-end

לפני סגירה, מעבר על כל זרימה שמייצרת מייל אמיתי, מאימות תיבה נקייה:

- [ ] הרשמה חדשה → confirm signup email מגיע מ-`no-reply@mioshy.com`, בעברית, ל-Inbox.
- [ ] איפוס סיסמה דרך `/auth/forgot` → reset email מגיע, הקישור מחזיר ל-mioshy.com.
- [ ] שינוי כתובת מייל → אימות כפול מגיע לשתי הכתובות.
- [ ] הזמנת שותף (`PartnerShareCard` / `InvitePartnerByEmail`) → מייל הזמנה מגיע מ-Brevo עם sender mioshy.com.
- [ ] מיילי journey (d1/d2 reminders, layer 5 anniversary) → מגיעים מ-Brevo עם sender mioshy.com.
- [ ] שליחת מייל ל-`support@mioshy.com` מבחוץ → מגיע לתיבת Google Workspace.
- [ ] בדיקה ב-[mail-tester.com](https://mail-tester.com) — ציון מינימלי 9/10.
- [ ] בדיקה ב-[mxtoolbox.com/domain/mioshy.com](https://mxtoolbox.com) — SPF, DKIM, DMARC, MX — כולם ירוקים.

---

## רצף ביצוע מומלץ (סדר תלויות)

| יום | פעולה | תלות |
|---|---|---|
| 1 | רכישת Google Workspace + יצירת התיבות | אין |
| 1 | הוספת MX + SPF + TXT לאימות בעלות | DNS |
| 1 | הוספת domain ב-Brevo + DKIM של Brevo ל-DNS | אין |
| 2 | המתנה להתפלגות DNS + אימות ב-Brevo וב-Google | יום 1 |
| 2 | הגדרת ENV vars ב-Vercel | אימות Brevo |
| 3 | יצירת SMTP credentials ב-Brevo עבור Supabase | אימות Brevo |
| 3 | הגדרת Custom SMTP ב-Supabase + Site URL | SMTP creds |
| 3 | עיצוב 5 תבניות מייל בעברית ב-Supabase | Custom SMTP |
| 4 | DMARC לעלייה ל-`p=quarantine` | יום 2 |
| 4 | מבחן end-to-end מלא לפי הצ'קליסט | הכל |
| 5 | פרישת DMARC ל-`p=reject` אחרי שבוע ללא דוחות שליליים | יום 4 |

---

## סיכון ושאלות פתוחות לאיציק

1. **בחירת ספק תיבות:** Google Workspace ($14/חודש ל-2 תיבות) או Zoho (חינם)? *המלצה: Google.*
2. **גורל `mioshyoffice@gmail.com`:** להמשיך כ-admin login ולסנכרן ל-`office@mioshy.com`, או לעבור החלף-במלואו ולעדכן `lib/auth/admin-bypass.ts` (שינוי קוד עתידי)?
3. **תיבת `no-reply`:** לפתוח כתיבה אמיתית (forwarder ל-support) או שהדואר ייפול שם בלי משגיח?
4. **תבניות המייל ב-Supabase:** מי כותב את הטקסט בעברית? יש מי שמעצב את ה-HTML, או להשתמש בברירת מחדל מינימליסטית עם לוגו בלבד?
5. **תקופת ניסיון של DMARC:** להתחיל ב-`p=none` שבוע מלא, או לעבור ישר ל-`p=quarantine` אם הסבלנות נמוכה?

---

עלות חודשית מוערכת בסיום: ~$14 Google Workspace + Brevo קיים = תוספת ~50₪/חודש. השאר חד-פעמי.
