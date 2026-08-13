/*
 * FAQ for /he/research — built for organic search and AI-engine citation.
 *
 * DESIGN: identical to the homepage FAQ, by construction rather than by
 * imitation. It imports the same `components/marketing/v2/styles.css` and
 * renders the same class names (`faq`, `faq-grid`, `faq-side`, `faq-list`,
 * `faq-item`, `faq-q`, `faq-icon`, `faq-answer`) inside a `.home-v2` wrapper,
 * so the two sections cannot drift apart: a change to the homepage FAQ's
 * styling lands here automatically.
 *
 * That stylesheet is safe to pull into this page. Every rule in it is nested
 * under `.home-v2` — including the bare `h1/h2/p/section` ones — so nothing
 * escapes the wrapper and repaints the article. globals.css documents
 * embedding `.home-v2` inside another surface as a supported pattern.
 *
 * WHAT DIFFERS from the homepage, and why: the homepage's side column carries
 * an eyebrow, a description and a "contact us" button, all of them CMS copy.
 * The brief froze the copy for this section and supplied a heading and eight
 * Q&As, nothing else, so the side column here is the heading alone. The layout
 * is the homepage's; only the elements we have no approved copy for are absent.
 *
 * NOT CMS-backed, unlike components/marketing/v2/FAQ.tsx. That component
 * resolves its strings from `cms_texts` at request time. This page is a static
 * snapshot whose copy is frozen and verbatim in code, and it must not gain a
 * database dependency — nor can frozen copy live somewhere it can be edited
 * out from under the article's claims.
 *
 * Server component: the answers are in the markup, not fetched. `<details>`
 * hides them visually until opened, but a crawler reads the DOM, so every
 * answer is present on first response.
 */

import "@/components/marketing/v2/styles.css";
import { faqPageJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";
import styles from "./research.module.css";

/**
 * Copy is frozen: verbatim from the approved brief, no em-dashes.
 * The same strings feed the visible accordion and the FAQPage JSON-LD, so the
 * schema text cannot drift from what a reader sees. That is a requirement of
 * the markup, not a nicety: Google treats mismatched FAQ schema as spam.
 */
const FAQ_ITEMS: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: "מה הדבר שהכי חסר לזוגות בישראל?",
    answer:
      "על פי מחקר הזוגיות הישראלי של מיאושי (2026), הפער הגדול ביותר הוא תשוקה. 42.5% מתוך 482 משיבים בחרו בתשוקה ומשיכה כדבר האחד שהיו משפרים בזוגיות, יותר מכל אפשרות אחרת. רק 7.7% בחרו לריב פחות.",
  },
  {
    question: "כמה זוגות בישראל מרוצים מחיי המין שלהם?",
    answer:
      "במחקר הזוגיות הישראלי של מיאושי נמצא שרק 25.4% מתוך 720 משיבים מדווחים על שביעות רצון גבוהה מחיי המין, בעוד 50.3% מדווחים על שביעות רצון נמוכה.",
  },
  {
    question: "מה ההרגל שנמצא הכי קשור לזוגיות טובה?",
    answer:
      "רגעים קבועים שרק שייכים לבני הזוג, כמו קפה של בוקר או דייט שבועי. במחקר של מיאושי, זוגות עם רגעים קבועים דיווחו על שביעות רצון גבוהה מחיי המין פי 4.5, והתאוששו מריבים מהר יותר פי 2.5, בהשוואה לזוגות בלי רגעים כאלה. המחקר מתאר קשר בין התופעות, לא סיבה ותוצאה.",
  },
  {
    question: "האם גברים מתעניינים בשיפור הזוגיות?",
    answer:
      "כן, ויותר משנהוג לחשוב. 61.6% מתוך 619 המשיבים על שאלת המגדר במחקר הזוגיות הישראלי של מיאושי היו גברים.",
  },
  {
    question: "מה יותר חשוב לזוגות, תקשורת או תשוקה?",
    answer:
      "שתי תשובות שונות לשתי שאלות שונות. כשהתבקשו לדרג חשיבות, 60.2% מהמשיבים במחקר של מיאושי דירגו תקשורת במקום הראשון. אבל כשנשאלו מה היו משפרים בפועל, תשוקה ניצחה בפער גדול. תקשורת היא הבסיס, ותשוקה היא מה שנשחק ראשון.",
  },
  {
    question: "מה הלך יחד עם תשוקה גבוהה בנתונים?",
    answer:
      "שלושה דברים בלטו במחקר הזוגיות הישראלי של מיאושי: אנרגיה שנשארת בערב לרומנטיקה (פי 7 בשביעות רצון), נוכחות אמיתית ברגעים האינטימיים (פי 2.6), ורגעים קבועים משותפים (פי 4.5). המחקר מראה מה הולך יחד עם מה, לא מה גורם למה.",
  },
  {
    question: "על כמה משתתפים מבוסס מחקר הזוגיות הישראלי?",
    answer:
      "על 904 אבחונים זוגיים של 869 משתתפים, שענו יחד על 9,246 שאלות בין אפריל לאוגוסט 2026. המחקר נערך על ידי מיאושי על בסיס האבחון הזוגי המקוון שלה.",
  },
  {
    question: "איך אפשר לבדוק את מצב הזוגיות שלי?",
    answer:
      "דרך האבחון הזוגי החינמי של מיאושי, אותו כלי שעליו מבוסס המחקר. 13 שאלות קצרות, ובסוף תמונה אישית של החוזקות והפערים בזוגיות שלכם.",
  },
];

export function ResearchFaq() {
  return (
    <div id="faq" className={`${styles.faqScope} home-v2`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(faqPageJsonLd([...FAQ_ITEMS])),
        }}
      />
      <section className="faq">
        <div className="container">
          <div className="faq-grid">
            <div className="faq-side">
              <h2>שאלות ותשובות על המחקר</h2>
            </div>

            <div className="faq-list">
              {FAQ_ITEMS.map((item, i) => (
                <details className="faq-item" key={item.question} open={i === 0}>
                  <summary>
                    {/* <h3> under the section's <h2>: no level skip (WCAG
                        1.3.1), and it mirrors the homepage FAQ exactly. */}
                    <h3 className="faq-q">{item.question}</h3>
                    <span className="faq-icon">+</span>
                  </summary>
                  <div className="faq-answer">
                    <p>{item.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
