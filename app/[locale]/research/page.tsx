import type { Metadata } from "next";
import { buildAlternates, buildOgLocale } from "@/lib/seo/alternates";
import { ResearchToc } from "./ResearchToc";
import { ShareRow } from "./ShareRow";
import { ResearchCta } from "./ResearchCta";
import styles from "./research.module.css";

/**
 * /he/research — "מחקר הזוגיות הישראלי 2026".
 *
 * A STATIC SNAPSHOT. Every number, percentage and N below is hardcoded content,
 * not a query. The single source for all of it is
 *
 *     data/research-extract/assessment-research-extract-2026-08-13.md
 *
 * (machine-readable twin: the .json beside it), produced read-only from
 * production on 2026-08-13. Nothing on this page touches the database, so the
 * figures cannot drift under the prose that interprets them — which is the
 * point: the article makes claims about these specific numbers.
 *
 * Refreshing the page means re-running that extract and editing this file
 * deliberately, in an edition. The methodology box says so in as many words.
 *
 * Copy is frozen: the Hebrew is verbatim from docs/research-page-mockup.html.
 * It was proofread deliberately and contains no em-dashes. The only sentence
 * that is not from the mockup is the edition line in the methodology box, added
 * on explicit instruction.
 */

const TITLE = "מחקר הזוגיות הישראלי 2026 · מיאושי";
const DESCRIPTION =
  "מה באמת חסר לזוגות בישראל? 869 אנשים ענו על שאלות שלא שואלים בקול רם. אלה התשובות שלהם.";

export function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Metadata {
  const locale = params.locale === "en" ? "en" : "he";
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com").replace(
    /\/+$/,
    "",
  );
  return {
    title: TITLE,
    description: DESCRIPTION,
    // canonical + hreflang + x-default. With the sitemap entry added in
    // app/sitemap.ts, all three of Google's discovery mechanisms are populated
    // — the checklist the /relationship-survey incident left behind.
    alternates: buildAlternates(locale, "/research"),
    openGraph: {
      ...buildOgLocale(locale),
      // A dated content piece, not a product surface.
      type: "article",
      url: `${base}/${locale}/research`,
      siteName: "Mioshy",
      title: TITLE,
      description: DESCRIPTION,
      images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630, alt: TITLE }],
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
      images: ["/twitter-image.jpg"],
    },
  };
}

/* ── Presentational primitives ───────────────────────────────────────────────
 * The mockup repeats three shapes many times over. Expressing them as small
 * components keeps every figure in one data literal per chart, so a reviewer
 * diffing against the mockup compares numbers rather than markup.
 *
 * Note `width` and `value` are separate on a Bar: the mockup scales bar widths
 * relative to the largest option (42.5% draws at 100%), while the printed label
 * stays the true percentage.
 */

function Bar({
  label,
  width,
  value,
  hot = false,
}: {
  label: string;
  width: string;
  value: string;
  hot?: boolean;
}) {
  return (
    <div className={`${styles.brow} ${hot ? styles.browHot : ""}`}>
      <span className={styles.lbl}>{label}</span>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width }} />
      </div>
      <span className={styles.val}>{value}</span>
    </div>
  );
}

function Segments({
  title,
  low,
  mid,
  high,
  flip = false,
}: {
  title: string;
  low: string;
  mid: string;
  high: string;
  flip?: boolean;
}) {
  return (
    <div className={`${styles.seg} ${flip ? styles.segFlip : ""}`}>
      <div className={styles.stitle}>{title}</div>
      <div className={styles.strip}>
        <div className={`${styles.s} ${styles.sLow}`} style={{ width: low }}>
          {low}
        </div>
        <div className={`${styles.s} ${styles.sMid}`} style={{ width: mid }}>
          {mid}
        </div>
        <div className={`${styles.s} ${styles.sHigh}`} style={{ width: high }}>
          {high}
        </div>
      </div>
    </div>
  );
}

function Compare({
  factor,
  what,
  withLabel,
  withValue,
  withoutLabel,
  withoutValue,
  footnote,
}: {
  factor: string;
  what: string;
  withLabel: string;
  withValue: string;
  withoutLabel: string;
  withoutValue: string;
  footnote: string;
}) {
  return (
    <div className={styles.cmp}>
      <div className={styles.x}>{factor}</div>
      <div className={styles.what}>{what}</div>
      <div className={styles.pair}>
        <div className={styles.p}>
          <span>{withLabel}</span>
          <div className={styles.t}>
            <div className={styles.f} style={{ width: withValue }} />
          </div>
          <b>{withValue}</b>
        </div>
        <div className={`${styles.p} ${styles.pDim}`}>
          <span>{withoutLabel}</span>
          <div className={styles.t}>
            <div className={styles.f} style={{ width: withoutValue }} />
          </div>
          <b>{withoutValue}</b>
        </div>
      </div>
      <div className={styles.pn}>{footnote}</div>
    </div>
  );
}

export default function ResearchPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = params.locale === "en" ? "en" : "he";

  return (
    // `data-research-root` is where ResearchToc writes the measured
    // `--research-stack`, so the anchor offset stays inside this subtree.
    <div className={styles.page} dir="rtl" lang="he" data-research-root>
      {/* ============ HERO ============ */}
      <div className={styles.hero}>
        <div className={styles.wrap}>
          <div className={styles.brand}>Mioshy</div>
          <div className={styles.kicker}>
            מחקר מקורי · מבוסס על נתוני האבחון הזוגי של מיאושי
          </div>
          <h1 className={styles.h1}>מחקר הזוגיות הישראלי 2026</h1>
          <p className={styles.sub}>
            מה באמת חסר לזוגות בישראל? 869 אנשים ענו על שאלות שלא שואלים בקול רם.
            אלה התשובות שלהם.
          </p>
          <div className={styles.metaRow}>
            <div>
              <b>869</b>משתתפים
            </div>
            <div>
              <b>904</b>אבחונים
            </div>
            <div>
              <b>9,246</b>תשובות
            </div>
            <div>
              <b>4</b>חודשי איסוף
            </div>
          </div>
        </div>
      </div>

      {/* ============ ניווט אנקורים ============ */}
      <ResearchToc />

      <div className={styles.wrap}>
        {/* ============ פרק 1 ============ */}
        <section id="finding-passion">
          <span className={`${styles.chip} ${styles.chipPink}`}>הממצא המרכזי</span>
          <h2>אף אחד לא רוצה לריב פחות. כולם רוצים יותר תשוקה</h2>
          <p className={styles.lede}>
            שאלנו: אם היה אפשר לשפר דבר אחד בלבד בזוגיות שלכם בחודש הקרוב, מה זה
            היה? התשובה לא הייתה צמודה.{" "}
            <b>תשוקה ניצחה את כל שאר האפשרויות ביחד כמעט</b>. ומה במקום האחרון?
            לריב פחות.
          </p>

          <div className={styles.card}>
            <h3>הדבר האחד שהייתם משפרים החודש</h3>
            <p className={styles.q}>
              &quot;אם היה אפשר לשפר דבר אחד בלבד בזוגיות שלכם בחודש הקרוב, מה זה
              היה?&quot;
            </p>
            <Bar label="להרגיש יותר תשוקה ומשיכה" width="100%" value="42.5%" hot />
            <Bar label="להרגיש יותר קרובים רגשית" width="38.6%" value="16.4%" />
            <Bar label="לקבל יותר הערכה והכרה" width="32.7%" value="13.9%" />
            <Bar label="להרגיש שמכירים אחד את השני" width="24.9%" value="10.6%" />
            <Bar label="להבין לאן אנחנו הולכים יחד" width="20.9%" value="8.9%" />
            <Bar label="לריב פחות" width="18.1%" value="7.7%" />
            <div className={styles.n}>482 משיבים · אפריל עד יולי 2026</div>
          </div>

          <div className={styles.pull}>
            הריבים הם לא הבעיה. רק 7.7% היו בוחרים לריב פחות. פי חמישה יותר אנשים
            היו בוחרים להחזיר את התשוקה.
          </div>

          <p className={styles.lede}>
            וזה מסתדר עם מה שמצאנו כששאלנו ישירות.{" "}
            <b>מחצית מהמשיבים דיווחו על שביעות רצון נמוכה מחיי המין</b>, ורק רבע
            על שביעות רצון גבוהה:
          </p>

          <div className={styles.card}>
            <Segments
              title="שביעות רצון מחיי המין · 720 משיבים"
              low="50.3%"
              mid="24.3%"
              high="25.4%"
            />
            <Segments
              title="אנרגיה בערב לחיזור ורומנטיקה · 609 משיבים"
              low="46.3%"
              mid="26.9%"
              high="26.8%"
            />
            <Segments
              title="נוכחות מלאה בזמן אינטימיות, בלי מחשבות שמסיחות · 644 משיבים"
              low="32.6%"
              mid="41.8%"
              high="25.6%"
            />
            <div className={styles.seglegend}>
              <span>
                <i className={styles.swPink} />
                נמוך
              </span>
              <span>
                <i className={styles.swMid} />
                באמצע
              </span>
              <span>
                <i className={styles.swHigh} />
                גבוה
              </span>
            </div>
          </div>

          <p className={styles.lede}>
            ומה הולך יחד עם שביעות רצון גבוהה? שני קשרים בלטו מעל כל השאר:
          </p>

          <div className={styles.cmpgrid}>
            <Compare
              factor="פי 7"
              what="שביעות רצון גבוהה מחיי המין, אצל מי שמגיע לערב עם אנרגיה לרומנטיקה"
              withLabel="יש אנרגיה בערב"
              withValue="53.4%"
              withoutLabel="אין אנרגיה"
              withoutValue="7.4%"
              footnote="609 משיבים שענו על שתי השאלות"
            />
            <Compare
              factor="פי 2.6"
              what="שביעות רצון גבוהה, אצל מי שנוכח באמת ברגעים האינטימיים"
              withLabel="נוכחים באמת"
              withValue="42.8%"
              withoutLabel="הראש במקום אחר"
              withoutValue="16.2%"
              footnote="590 משיבים שענו על שתי השאלות"
            />
          </div>

          <div className={styles.note}>
            מה שעולה מהנתונים: התשוקה לא מתחילה בחדר השינה. היא מתחילה בכמה כוח
            נשאר לנו בסוף היום, ובאיזו מידה אנחנו באמת שם כשאנחנו יחד.
          </div>
        </section>

        {/* ============ פרק 2 ============ */}
        <section id="paradox">
          <span className={`${styles.chip} ${styles.chipViolet}`}>הפרדוקס</span>
          <h2>תקשורת היא הכי חשובה. אבל לא היא מה שחסר</h2>
          <p className={styles.lede}>
            כשביקשנו לדרג מה הכי חשוב בזוגיות, <b>תקשורת ניצחה בפער עצום</b>: 60%
            דירגו אותה במקום הראשון. אבל כששאלנו מה הייתם משפרים עכשיו, תשוקה לקחה
            הכל. המסקנה שעולה מהנתונים: תקשורת היא הבסיס שאנשים בונים עליו, ותשוקה
            היא מה שנשחק ראשון.
          </p>

          <div className={styles.card}>
            <h3>דירוג חשיבות מול הפער בפועל</h3>
            <p className={styles.q}>
              &quot;דרגו את התחומים לפי סדר החשיבות עבורכם&quot; · 455 מדרגים
            </p>
            <div className={styles.ptableWrap}>
              <table className={styles.ptable}>
                <tbody>
                  <tr>
                    <th>תחום</th>
                    <th>מקום ממוצע בדירוג</th>
                    <th>בחרו בו כחשוב ביותר</th>
                  </tr>
                  <tr>
                    <td>תקשורת זוגית</td>
                    <td className={styles.rank}>1.62</td>
                    <td>60.2%</td>
                  </tr>
                  <tr className={styles.hl}>
                    <td>מיניות ואינטימיות</td>
                    <td className={styles.rank}>2.46</td>
                    <td>16.3%</td>
                  </tr>
                  <tr>
                    <td>אהבה וחיבור רגשי</td>
                    <td className={styles.rank}>2.69</td>
                    <td>13.6%</td>
                  </tr>
                  <tr>
                    <td>חברות ושותפות</td>
                    <td className={styles.rank}>3.61</td>
                    <td>5.9%</td>
                  </tr>
                  <tr>
                    <td>משפחה והורות</td>
                    <td className={styles.rank}>4.62</td>
                    <td>4.0%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className={styles.n}>
              מקום 1 הוא הראשון בחשיבות. השורה המודגשת: התחום שבו רוב האנשים
              מרגישים את הפער הגדול ביותר.
            </div>
          </div>
        </section>

        {/* ============ פרק 3 ============ */}
        <section id="rituals">
          <span className={`${styles.chip} ${styles.chipGold}`}>הממצא המפתיע</span>
          <h2>הקפה של הבוקר מגיע עד חדר השינה</h2>
          <p className={styles.lede}>
            שאלנו על דבר קטן: האם יש לכם רגעים קבועים ביום או בשבוע שרק שייכים
            לכם? קפה של בוקר, דייט קבוע, טקס ערב.{" "}
            <b>אצל 55% מהזוגות אין אף רגע כזה.</b> וכשמצליבים את התשובה הזו עם כל
            השאר, מתגלה הפער הגדול ביותר שמצאנו במחקר.
          </p>

          <div className={styles.card}>
            <Segments
              title="רגעים קבועים שרק שלכם · 687 משיבים"
              low="23.4%"
              mid="21.7%"
              high="54.9%"
              flip
            />
            <div className={styles.seglegend}>
              <span>
                <i className={styles.swHigh} />
                יש לנו
              </span>
              <span>
                <i className={styles.swMid} />
                קצת
              </span>
              <span>
                <i className={styles.swPink} />
                אין לנו
              </span>
            </div>
          </div>

          <p className={styles.lede}>
            עכשיו תראו מה קורה כשמשווים זוגות שיש להם רגעים קבועים לזוגות שאין
            להם:
          </p>

          <div className={styles.cmpgrid}>
            <Compare
              factor="פי 4.5"
              what="שביעות רצון גבוהה מחיי המין"
              withLabel="יש רגעים"
              withValue="56.3%"
              withoutLabel="אין רגעים"
              withoutValue="12.4%"
              footnote="667 משיבים שענו על שתי השאלות"
            />
            <Compare
              factor="פי 2.5"
              what="נרגעים מהר אחרי ריב וחוזרים לשגרה"
              withLabel="יש רגעים"
              withValue="64.6%"
              withoutLabel="אין רגעים"
              withoutValue="26.0%"
              footnote="686 משיבים שענו על שתי השאלות"
            />
            <Compare
              factor="פי 2.5"
              what="מרגישים צוות מאוחד מול החיים"
              withLabel="יש רגעים"
              withValue="71.9%"
              withoutLabel="אין רגעים"
              withoutValue="28.9%"
              footnote="562 משיבים שענו על שתי השאלות"
            />
          </div>

          <div className={styles.note}>
            חשוב לומר ביושר: הנתונים מראים קשר חזק, לא סיבה ותוצאה. יכול להיות
            שהרגעים הקבועים מחזקים את הזוגיות, ויכול להיות שזוגות חזקים פשוט
            שומרים על רגעים קבועים. כנראה שניהם נכונים.
          </div>

          <div className={styles.pull}>
            מכל מה שבדקנו, שום דבר לא הפריד בין זוגות מרוצים לזוגות מתוסכלים כמו
            שאלה אחת פשוטה: יש לכם רגע קבוע שרק שלכם?
          </div>
        </section>

        {/* ============ פרק 4 ============ */}
        <section id="appreciation">
          <span className={`${styles.chip} ${styles.chipGold}`}>נקודת האור</span>
          <h2>מילה טובה, וכל מה שבא איתה</h2>
          <p className={styles.lede}>
            בתוך כל הנתונים על מה שחסר, מצאנו גם את מה שעובד.{" "}
            <b>
              מחצית מהמשיבים מרבים להגיד מילה טובה לבן או בת הזוג על דברים קטנים.
            </b>{" "}
            ואצל מי שעושה את זה, כמעט כל שאר המדדים נראים אחרת.
          </p>

          <div className={styles.card}>
            <Segments
              title="מביעים הערכה על דברים קטנים · 620 משיבים"
              low="22.3%"
              mid="27.4%"
              high="50.3%"
            />
            <div className={styles.seglegend}>
              <span>
                <i className={styles.swPink} />
                לעיתים רחוקות
              </span>
              <span>
                <i className={styles.swMid} />
                לפעמים
              </span>
              <span>
                <i className={styles.swHigh} />
                לעיתים קרובות
              </span>
            </div>
          </div>

          <div className={styles.cmpgrid}>
            <Compare
              factor="פי 6"
              what="שביעות רצון גבוהה מחיי המין"
              withLabel="מרבים להעריך"
              withValue="40.1%"
              withoutLabel="ממעטים"
              withoutValue="6.7%"
              footnote="605 משיבים שענו על שתי השאלות"
            />
            <Compare
              factor="פי 3.8"
              what="מייחלים לזמן איכות יחד במהלך השבוע"
              withLabel="מרבים להעריך"
              withValue="65.3%"
              withoutLabel="ממעטים"
              withoutValue="17.5%"
              footnote="617 משיבים שענו על שתי השאלות"
            />
          </div>

          <p className={styles.lede}>
            ועוד ממצא שכדאי לשים לב אליו: גם כשזוגות כן מבלים יחד,{" "}
            <b>רק רבע מרגישים ששניהם נוכחים באמת</b>. 41.7% מדווחים שגם בדייט,
            הראש נמצא במקום אחר. 684 משיבים ענו על השאלה הזו.
          </p>
        </section>

        {/* ============ פרק 5 ============ */}
        <section id="who">
          <span className={`${styles.chip} ${styles.chipViolet}`}>מי ענה</span>
          <h2>ועוד הפתעה אחת: רוב המשיבים הם גברים</h2>
          <p className={styles.lede}>
            יש הנחה רווחת שרק נשים מתעניינות בעבודה על זוגיות. הנתונים שלנו אומרים
            אחרת. <b>62% ממי שענו על שאלת המגדר הם גברים.</b> גברים ישראלים יושבים
            לבד מול מסך ועונים ברצינות על 13 שאלות על הזוגיות שלהם. זה כשלעצמו
            ממצא.
          </p>

          <div className={styles.card}>
            <h3>מי עשה את האבחון</h3>
            <Bar label="גברים" width="100%" value="61.6%" hot />
            <Bar label="נשים" width="61%" value="37.6%" />
            <Bar label="אחר או מעדיפים לא לציין" width="1.3%" value="0.8%" />
            <div className={styles.n}>
              619 השיבו על שאלת המגדר · 99.7% מהמשתתפים ענו בעברית
            </div>
          </div>
        </section>

        {/* ============ SHARE ============ */}
        <div className={styles.share} id="share">
          <h2>הנתונים האלה שווים שיחה</h2>
          <p>
            אולי עם בן או בת הזוג. שתפו את המחקר, או שלחו למי שצריך לראות אותו.
          </p>
          <ShareRow />
          <div className={styles.cite}>
            <b>רוצים לצטט? בשמחה.</b> הנתונים פתוחים לשימוש עיתונאי ומחקרי, בתנאי
            אחד: ציון המקור וקישור פעיל.
            <br />
            ציטוט מוכן: מתוך &quot;מחקר הזוגיות הישראלי 2026&quot; של מיאושי
            (mioshy.com), על בסיס 904 אבחונים זוגיים.
          </div>
        </div>

        {/* ============ CTA ============ */}
        <div className={styles.cta}>
          <h2>ואיפה הזוגיות שלכם בתוך כל זה?</h2>
          <p>
            המחקר הזה נבנה מתשובות של אנשים אמיתיים באבחון הזוגי של מיאושי. 13
            שאלות, כמה דקות, ובסוף תמונה אישית של החוזקות והפערים שלכם.
          </p>
          <ResearchCta locale={locale} />
        </div>

        {/* ============ METHOD ============ */}
        <div className={styles.method} id="method">
          <h3>איך נעשה המחקר</h3>
          <p>
            הנתונים נאספו מהאבחון הזוגי המקוון של מיאושי בין 19 באפריל ל־13
            באוגוסט 2026: 904 אבחונים של 869 משתתפים, שהניבו 9,246 תשובות. המחקר
            מתעדכן במהדורות; זו מהדורת אוגוסט 2026. ההשתתפות אנונימית ופתוחה לכל
            גולש, ולכן התמונה משקפת את מי שבחר לענות, לא מדגם מייצג של כלל
            האוכלוסייה. התשובות ניתנו על סולם של 1 עד 5, ובמחקר קיבצנו אותן לשלוש
            רמות: נמוך (1 עד 2), באמצע (3) וגבוה (4 עד 5). כל הנתונים נותחו במצטבר
            בלבד, בלי גישה לתשובות של אדם מסוים, וקבוצות של פחות מ־5 משיבים לא
            פורסמו כדי לשמור על פרטיות. חלק מהשאלות נוסחו מחדש במהלך התקופה; בכל
            מקרה כזה נכללו רק התשובות שניתנו על הנוסח שמופיע כאן, כך שכל מספר
            משקף בדיוק את מה שהמשיבים ראו מול העיניים. כל אחוז מלווה במספר המשיבים
            שעומד מאחוריו. ההצלבות בין שאלות כוללות רק את מי שענו על שתיהן, והן
            מראות מה הולך יחד עם מה, לא מה גורם למה.
          </p>
        </div>
      </div>

      <footer className={styles.pageFooter}>
        <div className={styles.logo}>Mioshy</div>
        מחקר הזוגיות הישראלי 2026 · כל הזכויות שמורות למיאושי
      </footer>
    </div>
  );
}
