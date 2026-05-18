# דוח חילוץ אנשי קשר — mioshy

נוצר: 2026-05-14 12:30:26

---

## 📊 סך מספרים ישראלים

- **208** מספרים ייחודיים בפורמט מקומי (0XXXXXXXXX)
- vCard נכתב עם **208** רשומות
- xlsx נכתב עם **208** רשומות
- ✅ ספירות **תואמות**

## 🌍 סך מספרים בינלאומיים

- **7** מספרים ייחודיים (E.164)
- vCard נכתב עם **7** רשומות
- xlsx נכתב עם **7** רשומות
- ✅ ספירות **תואמות**

### פילוח לפי קוד מדינה

| Country | Count |
|---|---|
| AU (+61) | 1 |
| UK (+44) | 2 |
| US/CA (+1) | 4 |

## 📧 מיילים מ-ecommerce

- **1658** מיילים ייחודיים תקינים
- **2** מיילים לא תקינים → emails_review_needed.xlsx
- **3414** תאי מייל גולמיים נסרקו

## 🔁 כפילויות שהוסרו

| מקור | גולמי | ייחודי | כפילויות |
|---|---|---|---|
| OCR מספרים | 377 | 215 | 135 |
| מיילים | 3414 | 1658 | 1754 |

## ⚠️ פריטים שדורשים בדיקה ידנית

- **27** מספרי טלפון חשודים → `phones_review_needed.xlsx`
- **2** מיילים לא תקינים → `emails_review_needed.xlsx`

הסיבות הנפוצות במספרים:
- אורך לא תקין (פחות מ-9 ספרות או יותר מ-13)
- OCR מעורפל שלא תאם לאף קוד מדינה מוכר

## 🖼️ פילוח לפי תמונה

| Screenshot | Raw OCR hits | Unique (after dedup) | Status |
|---|---|---|---|
| Screenshot 2026-05-14 at 14.47.06.png | 14 | 11 | ✅ |
| Screenshot 2026-05-14 at 14.47.20.png | 11 | 9 | ✅ |
| Screenshot 2026-05-14 at 14.47.31.png | 10 | 9 | ✅ |
| Screenshot 2026-05-14 at 14.47.39.png | 18 | 9 | ✅ |
| Screenshot 2026-05-14 at 14.47.49.png | 21 | 7 | ✅ |
| Screenshot 2026-05-14 at 14.47.58.png | 17 | 8 | ✅ |
| Screenshot 2026-05-14 at 14.48.05.png | 16 | 8 | ✅ |
| Screenshot 2026-05-14 at 14.48.13.png | 14 | 8 | ✅ |
| Screenshot 2026-05-14 at 14.48.22.png | 12 | 10 | ✅ |
| Screenshot 2026-05-14 at 14.48.29.png | 15 | 10 | ✅ |
| Screenshot 2026-05-14 at 14.48.37.png | 20 | 8 | ✅ |
| Screenshot 2026-05-14 at 14.48.46.png | 13 | 10 | ✅ |
| Screenshot 2026-05-14 at 14.48.53.png | 15 | 9 | ✅ |
| Screenshot 2026-05-14 at 14.49.02.png | 15 | 8 | ✅ |
| Screenshot 2026-05-14 at 14.49.10.png | 17 | 8 | ✅ |
| Screenshot 2026-05-14 at 14.49.20.png | 12 | 8 | ✅ |
| Screenshot 2026-05-14 at 14.49.27.png | 17 | 8 | ✅ |
| Screenshot 2026-05-14 at 14.49.36.png | 17 | 13 | ✅ |
| Screenshot 2026-05-14 at 14.49.48.png | 17 | 8 | ✅ |
| Screenshot 2026-05-14 at 14.49.57.png | 15 | 9 | ✅ |
| Screenshot 2026-05-14 at 14.50.08.png | 16 | 8 | ✅ |
| Screenshot 2026-05-14 at 14.50.21.png | 20 | 8 | ✅ |
| Screenshot 2026-05-14 at 14.50.30.png | 15 | 8 | ✅ |
| Screenshot 2026-05-14 at 14.50.45.png | 18 | 12 | ✅ |
| Screenshot 2026-05-14 at 14.50.51.png | 2 | 1 | ✅ |

✅ כל התמונות הניבו תוצאות.

## ⏱️ זמן ריצה

- OCR: 36.8 שניות
- כולל הכל: ~37.4 שניות

## הערה על Detected_Name

חבילת השפה Hebrew של tesseract אינה זמינה בסביבה (אין הרשאות root). לכן עמודת `Detected_Name` ב-xlsx ריקה כמעט תמיד. מספרי הטלפון עצמם חולצו במלואם.
אם בעתיד תרצה שמות לצד מספרים — צריך להריץ זאת על מכונה שיש בה `tesseract-ocr-heb` מותקן.

---

קבצים שנוצרו ב-`contact/output/`:

| קובץ | תוכן |
|---|---|
| `whats_mioshy_may.vcf` | vCard, ישראלים, FN="whats_mioshy_may" |
| `whats_mioshy_may.xlsx` | גיבוי Excel — Name, Phone, Source, Detected_Name |
| `whats_mioshy_international.vcf` | vCard, חו"ל, FN="whats_mioshy_international" |
| `whats_mioshy_international.xlsx` | גיבוי Excel — Name, Phone, Country, Source |
| `emails_from_ecommerce.xlsx` | 1658 מיילים ייחודיים |
| `phones_review_needed.xlsx` | 27 מספרים לבדיקה ידנית |
| `emails_review_needed.xlsx` | 2 מיילים לבדיקה ידנית |
| `extraction_report.md` | דוח זה |
