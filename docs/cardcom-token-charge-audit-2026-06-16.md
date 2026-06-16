# דו״ח ביקורת — מנגנון חיוב אסימון (Token) ב‑Cardcom
**תאריך:** 16.6.2026 · **טווח:** יצירת הטוקן → שמירה → חיוב חוזר (renewals)
**רקע:** 3 כרטיסי אשראי שונים, תקינים להוראת קבע, נדחו כולם בחיוב החוזר (`60000004`). הבקשה: סריקת קוד מלאה של הרכיב שיוצר/שומר/שולח את האסימון.

---

## 1. תקציר מנהלים — הממצא המרכזי

**יש באג אחד, חד‑משמעי, בשורה אחת בקוד.**

בקובץ `lib/cardcom.ts`, פונקציית החיוב החוזר `chargeToken()` שולחת לכל חיוב את הפרמטר:

```
TokenToCharge.JParameter = "5"
```

לפי התיעוד הרשמי של Cardcom, **`J5` אינו "חיוב הוראת קבע"** — אלא **"אישור בלבד" (תפיסת מסגרת אשראי, ללא חיוב בפועל)**. כלומר כל חיוב חוזר שאנחנו שולחים הוא בכלל לא חיוב — זו בקשת *שריון מסגרת* על הכרטיס. ההערה שמופיעה בקוד ("J5 marks this as a recurring/standing‑order charge") **שגויה**.

**ההשלכה:**
- חלק מהמנפיקים דוחים עסקת אישור‑בלבד שכזו → `60000004` "סירוב מחברת האשראי" (מה שראינו ב‑3 הכרטיסים).
- גם כש‑Cardcom מחזיר `ResponseCode=0` ("הצלחה"), **לא יורד כסף בפועל** — רק נתפסת מסגרת שמשתחררת לבד אחרי כמה ימים/שבועות. כלומר גם "ההצלחה" שראינו (oshratas) ככל הנראה לא גבתה כסף אמיתי.

**התיקון:** להסיר את שורת ה‑`JParameter=5`, כך שהחיוב יתבצע כעסקה רגילה (ברירת המחדל) — בדיוק כמו התשלום הראשוני שעובד.

> הערה: לא ערכתי את הקוד. זהו דו״ח בלבד; התיקון מובא להלן לאישורך.

---

## 2. למה אנחנו בטוחים — שלוש שכבות הוכחה

**שכבה א׳ — התיעוד הרשמי של Cardcom.**
מתוך "מסוף וירטואלי – חיוב/זיכוי כרטיס אשראי" (support.cardcom.solutions):

> **בדיקה בלבד** — ... לא בודק יתרה ... לא מחייב את הלקוח. (**J2** במונח המקצועי)
> **אישור בלבד** — שמסמנים פרמטר זה, המערכת תבצע **תפיסת מסגרת אשראי** על הסכום המבוקש, **לא תחייב בפועל** אלא תפיסת מסגרת (במונח המקצועי **J5**), נועד לבעלי עסקים שרוצים לשריין סכום עסקה לכרטיס לחייב אותו במועד מאוחר יותר.

`J5` = אישור/שריון. `J2` = בדיקת תקינות. אף אחד מהם אינו חיוב. חיוב בפועל = עסקה **רגילה** (ברירת המחדל, ללא JParameter).

**שכבה ב׳ — אסימטריה בקוד שמסבירה בדיוק מה שראינו.**

| נתיב | פונקציה | פרמטר עסקה | תוצאה בשטח |
|---|---|---|---|
| תשלום ראשוני | `openLowProfile()` (`Operation=2`) | **ללא J** → עסקה רגילה | ✅ נגבה כסף אמיתי |
| חיוב חוזר | `chargeToken()` | **`JParameter=5`** (אישור בלבד) | ❌ נדחה / לא גובה |

ההבדל היחיד בין "עובד" ל"לא עובד" הוא בדיוק שורת ה‑J5. התשלום הראשוני מוכיח שהמסוף (183655) **כן** מורשה לעסקאות רגילות.

**שכבה ג׳ — תגובת Cardcom האמיתית מהבדיקה (16.6).**
בכרטיס שנדחה: `"J_Paramter":"5"`, `"Description":"העסקה קיבלה סירוב מ חברת האשראי"`, `ResponseCode 60000004`. הפרמטר J5 אכן הגיע ל‑Cardcom ושוקלל בעסקה.

---

## 3. מפת זרימת האסימון (Token Lifecycle)

```
[1] יצירה            [2] שמירה                 [3] חיוב חוזר
LowProfile           indicator webhook          renewals cron (יומי 06:00 UTC)
Operation=2          ──────────────────►        ──────────────────────────►
(charge+token)       extractToken()             chargeToken()
ללא J → עסקה רגילה   encryptToken (AES‑256‑GCM)  ✗ JParameter=5  ← הבאג
   │                 customer_payment_methods       │
   ▼                 (token_enc, expiry_mmyy,       ▼
✅ כסף נגבה           card_brand, status=active)  ChargeToken.aspx
✅ token תקין         ✅ נשמר תקין                 ❌ אישור‑בלבד / סירוב
```

---

## 4. ניתוח שלב‑אחר‑שלב

### שלב 1 — יצירת הטוקן (`openLowProfile`, `lib/cardcom.ts:35`)
`Operation=2` (חיוב + יצירת טוקן לשימוש חוזר), `APILevel=10`, ללא פרמטר J. **תקין.** זה גם מוכיח שהמסוף מורשה לעסקאות רגילות וליצירת טוקנים.
**ורדיקט: ✅ תקין.**

### שלב 2 — שמירת הטוקן (`indicator/route.ts:226`, `tokenCrypto.ts`)
- `extractToken()` שולף את הטוקן + תוקף + מותג מתוך כמה שמות שדה אפשריים (עמיד לשונות של Cardcom).
- הצפנה: **AES‑256‑GCM** עם IV אקראי ו‑auth‑tag (`encryptToken`). תקין ומקובל.
- תוקף מנורמל ל‑`MMYY` (`normalizeExpiry`), נשמר ב‑`customer_payment_methods.expiry_mmyy`, `status='active'`, ייחודיות על `token_hash`. תקין.
**ורדיקט: ✅ תקין.** (הערה קלה: `card_brand` נשמר כקוד מספרי של שב״א, למשל `Mutag_24="2"`, ולא כשם מותג. זה משמש רק לחשבונית, לא לחיוב — לא קריטי.)

### שלב 3 — החיוב החוזר (`chargeToken`, `lib/cardcom.ts:168`)
שולח `TokenToCharge.Token/SumToBill/CoinID/UniqAsmachta`, מפצל תוקף ל‑`CardValidityMonth`+`CardValidityYear` (תיקון נכון מ‑27.5), **ואז מוסיף `JParameter=5`**.
**ורדיקט: ❌ הבאג.** ה‑J5 הופך כל חיוב ל"אישור בלבד".

מי שקורא ל‑`chargeToken`: רק `renewals/run` (נתיב החידושים). אין קוראים אחרים, כך שהתיקון ממוקד ובטוח.

---

## 5. ההשלכה החמורה שמעבר ל‑3 הדחיות

גם לכרטיסים שבהם Cardcom **לא** דחה (`ResponseCode=0`), עם J5 **לא יורד כסף** — רק נתפסת מסגרת זמנית שמשתחררת לבד. כלומר:

- ה‑cron מסמן את החיוב כ‑`succeeded`, מקדם את `next_billing_date` ב‑3 חודשים, ואף **מפיק חשבונית** — אבל בפועל לא נגבה כסף.
- זה אומר שכל מנוי "מחודש בהצלחה" עד היום עלול להיות חידוש‑רפאים: חשבונית הופקה, כסף לא נגבה.

**מומלץ לבדוק ב‑Dashboard של Cardcom** את העסקה של oshratas מ‑16.6: צפוי שתופיע כ"אישור/תפיסת מסגרת" ולא כעסקה שנסלקה. (בבדיקה שלנו ה‑cron החזיר `"status":"charged"`, אבל לפי התיעוד זה היה J5 — אישור בלבד.)

---

## 6. התיקון המומלץ

הסרה של שורה אחת ב‑`lib/cardcom.ts` (בתוך `chargeToken`), כך שהחיוב יתבצע כעסקה רגילה — בדיוק כמו התשלום הראשוני.

```diff
-  // JParameter=5 marks this as a recurring/standing-order charge. Cardcom
-  // requires this for ChargeToken renewals; without it, some terminals
-  // reject the call even with a valid token + expiry. Per the official
-  // example URL.
-  form.set("TokenToCharge.JParameter", "5")
+  // NOTE (2026-06-16 audit): JParameter=5 is "authorization only" (תפיסת
+  // מסגרת / J5) per Cardcom's official docs — it does NOT charge the card.
+  // It caused issuer declines (60000004) and ghost "successful" renewals
+  // that never settled. A regular charge is the default (no J param),
+  // matching the working initial LowProfile (Operation=2).
```

מדוע זה בטוח: התשלום הראשוני כבר רץ כעסקה רגילה ועובד על אותו מסוף. אנחנו פשוט מיישרים את החיוב החוזר לאותה התנהגות.

> אם בכל זאת מסוף מסוים ידרוש ערך J מפורש לעסקה רגילה — הערך הוא עסקה רגילה (ולא J2/J5). אבל ברירת המחדל של `ChargeToken.aspx` היא עסקה רגילה, ולכן הסרת השורה אמורה להספיק. נוודא בבדיקה למטה.

---

## 7. תוכנית בדיקה אחרי התיקון

1. לפרוס את התיקון (הסרת `JParameter=5`).
2. לקחת מנוי בדיקה (למשל dog1 או oshratas), לקדם `next_billing_date` לעבר, ולהריץ את ה‑cron ידנית (כמו שעשינו: `curl … /api/billing/renewals/run`).
3. לוודא `"status":"charged"` **וגם** — קריטי — לאמת ב‑Dashboard של Cardcom שהעסקה **נסלקה בפועל** (ולא "אישור/שריון").
4. לחזור על זה עם 1–2 כרטיסים שקודם נדחו, כדי לאשר שה‑`60000004` נעלם.
5. רק אחרי אישור — להחזיר את כל מנויי הבדיקה למצב נקי (`status='active'`, `failed_attempts=0`, `grace_until=null`, `next_billing_date` עתידי).

---

## 8. ממצאים משניים (לא חוסמים, שווה טיפול)

| # | ממצא | חומרה | המלצה |
|---|---|---|---|
| 8.1 | "הצלחות" קודמות של חידוש עלולות להיות J5 ללא גבייה בפועל | 🔴 גבוהה | להצליב ב‑Cardcom את כל ה‑`subscription_charges` עם `status='succeeded'`; לזהות חשבוניות שהופקו ללא סליקה |
| 8.2 | אין התראות כשחיוב נכשל / כש‑cron לא רץ (רק `console.error`) | 🟠 בינונית | מייל/Slack לאדמין על כשל חיוב; heartbeat ל‑cron |
| 8.3 | `.limit(20)` בריצה יומית = תקרת ~140 חידושים/שבוע | 🟡 נמוכה (טרום‑השקה) | להעלות limit / להריץ בתדירות גבוהה יותר כשגדלים |
| 8.4 | `failed_attempts` עולה ללא תקרה עד תום ה‑grace | 🟡 נמוכה | תקרת ניסיונות מפורשת |
| 8.5 | `card_brand` נשמר כקוד מספרי של שב״א, לא כשם מותג | 🟢 זניחה | מיפוי קוד→שם אם רוצים תצוגה ידידותית |

מה שנבדק ונמצא **תקין**: הצפנת הטוקן (AES‑256‑GCM), נורמליזציית התוקף, שדות התוקף בחיוב (`CardValidityMonth/Year`), אידמפוטנטיות (`uniq_asmachta`, `billing_events`), טיפול ב‑case‑insensitive ב‑webhook, חישוב התקופה הרבעונית (`addPlanPeriod` → +3 חודשים).

---

## 9. מקורות

- Cardcom — מסוף וירטואלי, חיוב/זיכוי כרטיס אשראי (הגדרת J2/J5): https://support.cardcom.solutions/hc/he/articles/360002246894
- Cardcom — חיוב/זיכוי אסימון (מודול אסימונים): https://support.cardcom.solutions/hc/he/articles/360020538559
- Cardcom — הוראות קבע (קטגוריה): https://support.cardcom.solutions/hc/he/categories/360000170674
- קוד: `lib/cardcom.ts` (`openLowProfile:35`, `chargeToken:168`, `JParameter:210`); `app/api/billing/renewals/run/route.ts:159`; `app/api/billing/cardcom/indicator/route.ts:226`; `lib/tokenCrypto.ts`; `supabase/migrations/016_cardcom_billing.sql`
- ביקורת קודמת: `docs/weekly-billing-audit-2026-05-27.md`
