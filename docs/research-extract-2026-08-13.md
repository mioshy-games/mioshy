# Mioshy research extraction — answer distributions

Generated 2026-08-12T21:51:24.542Z · read-only · aggregates only · no PII.

Primary artifact: `docs/research-extract-2026-08-13.json` (3353 KB).
This file is the readable summary; compute from the JSON.

## Study period and scale

| | Survey (poll) | Assessment (journey) |
|---|---|---|
| Period (UTC) | 2026-07-14 → 2026-08-12 | 2026-04-19 → 2026-08-12 |
| Answers | 2316 | 10317 (9874 categorical) |
| Distinct respondents | **102** | **902** journeys |
| Signed in / anonymous | 9 / 93 | 180 / 724 |
| Questions in catalogue | 239 | 29 |
| Test votes excluded | 4 | 0 |

## Read this before quoting any survey number

**2316 survey answers come from 102 people.**
The distribution is extremely concentrated:

| | answers | share of all 2316 |
|---|---|---|
| Top 1 respondent | 239 | 10.3% |
| Top 5 | 829 | 35.8% |
| Top 10 | 1194 | 51.6% |
| Top 20 | 1620 | 69.9% |
| Remaining 82 | 696 | 30.1% |

Median questions answered: **6**. Max: **239** (one person answered the entire catalogue).
37 respondents answered exactly one question.

The assessment is the denser dataset: median **13** of 29 questions across 902 journeys.

## What the schema does and does not support

| Requested split | Survey | Assessment |
|---|---|---|
| Hebrew vs English | **Not available** — `poll_votes` has no locale column and `poll_questions` has no English text | Available — `journey_responses.locale` |
| Signed-in vs anonymous | Available | Available |
| By month | Available | Available |
| Category | Available (`poll_questions.domain`) | Available (`journey_questions.domain` + `axes`) |

## Survey — top 15 questions by volume

| N | A % | B % | category | question (truncated) |
|---|---|---|---|---|
| 103 | 81.6% | 18.4% | — | החשק המיני שלכם הוא בדרך כלל: |
| 65 | 41.5% | 58.5% | — | בחדר השינה, מה יותר חשוב לכם כרגע? |
| 62 | 40.3% | 59.7% | — | במגע פיזי שאינו מיני (כמו ליטוף ביד), מה המוקד שלכם? |
| 56 | 76.8% | 23.2% | — | בשבילכם, הילדים בקשר הם: |
| 54 | 68.5% | 31.5% | — | אחרי ויכוח סוער, מי בדרך כלל יוזם את ה"תיקון" הראשון? |
| 52 | 55.8% | 44.2% | — | האם אתם מרגישים בנוח להגיד "לא" לסקס בלי להרגיש אשמה? |
| 50 | 74% | 26% | — | האם החמאתם לבן בת הזוג על משהו קטן שהם עשו היום? |
| 50 | 88% | 12% | — | כשקורה לכם משהו מצחיק, האם בן בת הזוג הם האדם הראשון שתספר |
| 47 | 57.4% | 42.6% | — | האם אתם מרגישים שיש לכם "חשבון רגשי" פתוח שבו אתם סופרים מ |
| 46 | 97.8% | 2.2% | — | האם יוצא לכם "להיענות להצעה מינית של השני גם כשאתם עייפים? |
| 45 | 91.1% | 8.9% | — | מה מעורר אתכם יותר? |
| 44 | 25% | 75% | — | מה אתם מעדיפים? |
| 43 | 58.1% | 41.9% | — | האם בזמן ריב אתם מרגישים "הצפה" פיזיולוגית (דופק מהיר, מחנ |
| 39 | 76.9% | 23.1% | — | האם אתם מרגישים שיש לכם "חזון משותף" ברור לעוד חמש שנים? |
| 38 | 47.4% | 52.6% | — | כשאתם במיטה יחד, אתם בדרך כלל: |

Full per-question data, all 239 questions with both options' full text and every split, is in the JSON under `survey.questions`.

## Survey — cross-tabs

1540 pairs emitted, 26901 skipped for having fewer than 10 respondents who answered both (out of 28441 possible pairs).

Strongest 10 by overlap:

| answered both | A → B(a) | A → B(b) | question A | question B |
|---|---|---|---|---|
| 65 | 40.4% | 59.6% | החשק המיני שלכם הוא בדרך כלל: | בחדר השינה, מה יותר חשוב לכם כרגע? |
| 62 | 40.7% | 59.3% | החשק המיני שלכם הוא בדרך כלל: | במגע פיזי שאינו מיני (כמו ליטוף בי |
| 62 | 56% | 44% | במגע פיזי שאינו מיני (כמו ליטוף בי | בחדר השינה, מה יותר חשוב לכם כרגע? |
| 56 | 79.2% | 20.8% | החשק המיני שלכם הוא בדרך כלל: | בשבילכם, הילדים בקשר הם: |
| 56 | 71.4% | 28.6% | במגע פיזי שאינו מיני (כמו ליטוף בי | בשבילכם, הילדים בקשר הם: |
| 56 | 34.9% | 65.1% | בשבילכם, הילדים בקשר הם: | בחדר השינה, מה יותר חשוב לכם כרגע? |
| 54 | 71.7% | 28.3% | החשק המיני שלכם הוא בדרך כלל: | אחרי ויכוח סוער, מי בדרך כלל יוזם  |
| 54 | 40.5% | 59.5% | אחרי ויכוח סוער, מי בדרך כלל יוזם  | במגע פיזי שאינו מיני (כמו ליטוף בי |
| 54 | 78.4% | 21.6% | אחרי ויכוח סוער, מי בדרך כלל יוזם  | בשבילכם, הילדים בקשר הם: |
| 54 | 35.1% | 64.9% | אחרי ויכוח סוער, מי בדרך כלל יוזם  | בחדר השינה, מה יותר חשוב לכם כרגע? |

Every pair carries the full 2×2 with both row denominators in the JSON under `survey.cross_tabs`.

## Assessment — top 15 questions by volume

| N | top value | category | question (truncated) |
|---|---|---|---|
| 819 | 1 11.6% | emotional_connection | באיזו תדירות במהלך קיום יחסי מין את/ה מאט/ה את הקצב  |
| 806 | 1 8.6% | emotional_connection | באיזו מידה אתה מרגיש שאתה ובן/בת הזוג פועלים כצוות מ |
| 774 | 1 10.1% | communication | אחרי כעס או עימות, כמה מהר אתם מצליחים להירגע ולחזור |
| 754 | 1 11.7% | intimacy | במהלך שבוע שגרתי, באיזו תדירות את/ה מייחל/ת לזמן איכ |
| 749 | 1 9.5% | communication | באיזו תדירות אתה מביע הערכה או אומר מילה טובה לבן/בת |
| 745 | 1 16.9% | family | באיזו מידה יש לך ולבן/בת זוגך מנהגים או טקסים קטנים  |
| 729 | 1 26.1% | friendship | באיזו מידה את/ה מרגיש/ה בנוח לחשוף בפני בן/בת זוגך א |
| 719 | 1 24.8% | — | באיזו מידה חיי המין עם בן/בת זוגך מעניקים לך תחושת ס |
| 719 | passion 29.2% | — | אם היה אפשר לשפר דבר אחד בלבד בזוגיות שלכם בחודש הקר |
| 717 | 1 18.4% | intimacy | כשמגיע הערב, עד כמה יש לך אנרגיה להשקיע בחיזור או בי |
| 683 | 1 14.1% | family | בעת שאת/ה ובן/בת זוגך מבלים זמן איכות יחד (כמו ביציא |
| 618 | male 61.5% | — | מה המגדר שלך? |
| 454 | communication>intimacy>emotional_connection>friendship>family 36.8% | — | דרג/י את הקטגוריות לפי סדר החשיבות עבורך |
| 154 | 1 4.5% | friendship | כשאתה משתף במשהו שמעסיק אותך, באיזו מידה אתה מרגיש ש |
| 136 | 1 14% | friendship | בימים רגילים (לא רק באירועים מיוחדים) - עד כמה יש בי |

## Assessment — cross-tabs

347 pairs emitted, 211 skipped (below 10 overlap, or a ranking question whose permutations are near-unique per person).

| answered both | question A | question B |
|---|---|---|
| 793 | באיזו תדירות במהלך קיום יחסי מין את/ה מא | באיזו מידה אתה מרגיש שאתה ובן/בת הזוג פו |
| 768 | באיזו מידה אתה מרגיש שאתה ובן/בת הזוג פו | אחרי כעס או עימות, כמה מהר אתם מצליחים ל |
| 764 | באיזו תדירות במהלך קיום יחסי מין את/ה מא | אחרי כעס או עימות, כמה מהר אתם מצליחים ל |
| 752 | אחרי כעס או עימות, כמה מהר אתם מצליחים ל | במהלך שבוע שגרתי, באיזו תדירות את/ה מייח |
| 750 | באיזו מידה אתה מרגיש שאתה ובן/בת הזוג פו | במהלך שבוע שגרתי, באיזו תדירות את/ה מייח |
| 748 | אחרי כעס או עימות, כמה מהר אתם מצליחים ל | באיזו תדירות אתה מביע הערכה או אומר מילה |
| 745 | באיזו תדירות במהלך קיום יחסי מין את/ה מא | במהלך שבוע שגרתי, באיזו תדירות את/ה מייח |
| 745 | במהלך שבוע שגרתי, באיזו תדירות את/ה מייח | באיזו מידה יש לך ולבן/בת זוגך מנהגים או  |

## Suppression

Counts of 1–4 are reported as `"<5"`. Zero is reported as `0` — an empty cell identifies nobody, and rewriting it as `"<5"` would imply someone is there.

**Residual disclosure, since this becomes public:** primary suppression alone is not always sufficient. Where a 2×2 row has one suppressed cell, the row total `of_n` and the other cell make it arithmetically recoverable. Closing that needs complementary suppression, which would blank additional non-sensitive cells. I did not apply it — flagging it so the decision is yours before publication.

## Data-quality observations — reported, not corrected

1. **One respondent answered all 239 survey questions**, another 206, another 173. Whether these are real participants, staff, or QA sessions is not determinable from the data.
2. **9 of 102 survey respondents are signed in.** Any signed-in vs anonymous split on the survey rests on that 9.
3. **443 free-text assessment answers exist and were counted but never extracted.** A visible portion of them are keyboard-mash test entries.
4. **The assessment period starts 2026-04-19**, nearly three months before the survey's first vote. They are not the same study window.
5. **All 239 survey questions have at least one vote**, but 211 have fewer than 30 and are flagged `thin` in the JSON.
