import type { Metadata } from "next";
import { SurveyLinkRaw } from "@/components/analytics/SurveyLink";
import styles from "./marketing.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "סקר הזוגיות של ישראל · מיאושי",
  description: "סקר הזוגיות של ישראל: שאלות קצרות על זוגיות, ומיד אחרי כל תשובה רואים מה זוגות אחרים בישראל ענו. חינם ואנונימי.",
};

/**
 * Stage 8 — standalone marketing page for the survey (NEW route, does NOT touch
 * the existing homepage). Own header + sticky mobile CTA. The Meta Pixel loads
 * site-wide via app/[locale]/layout.tsx (PageView); CompleteRegistration fires
 * on signup. Campaign target = this page → /he/survey.
 */
export default function RelationshipSurveyMarketing() {
  return (
    <div className={styles.page} dir="rtl">
      <header className={styles.header}>
        <div className={styles.logo}>Mioshy</div>
        <SurveyLinkRaw location="nav" href="/he/survey" className={styles.headerCta}>לסקר ←</SurveyLinkRaw>
      </header>

      <main className={styles.main}>
        <div className={styles.eyebrow}>חינם · אנונימי · בקצב שלכם</div>
        <h1 className={styles.h1}>
          סקר הזוגיות <span className={styles.em}>של ישראל</span>
        </h1>
        <p className={styles.lead}>
          שאלות קצרות על הזוגיות שלכם — ומיד אחרי כל תשובה תראו מה זוגות אחרים בישראל ענו. עונים כמה שבא לכם, ועוצרים מתי שרוצים.
          זה מכניס פלפל לזוגיות ופותח שיחות שלא העזתם. הכי כיף לענות יחד.
        </p>
        <SurveyLinkRaw location="hero" href="/he/survey" className={styles.cta}>לסקר ←</SurveyLinkRaw>
        <p className={styles.sub}>אפשר לענות ולראות תוצאות בלי הרשמה. רוצים לשמור את התשובות שלכם? מצטרפים בחינם.</p>

        <div className={styles.cards}>
          <div className={styles.card}><div className={styles.cardBig}>בקצב שלכם</div><div className={styles.cardSub}>שתי אפשרויות, 10 שניות</div></div>
          <div className={styles.card}><div className={styles.cardBig}>אחוזים חיים</div><div className={styles.cardSub}>מה זוגות בישראל ענו</div></div>
          <div className={styles.card}><div className={styles.cardBig}>יחד</div><div className={styles.cardSub}>הכי כיף עם בן/בת הזוג</div></div>
        </div>
      </main>

      {/* sticky mobile CTA */}
      <div className={styles.sticky}>
        <SurveyLinkRaw location="banner" href="/he/survey" className={styles.stickyCta}>לסקר ←</SurveyLinkRaw>
      </div>
    </div>
  );
}
