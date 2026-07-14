import type { Metadata } from "next";
import Link from "next/link";
import styles from "./marketing.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "סקר הזוגיות של ישראל · מיאושי",
  description: "כל יום שאלה אחת על הזוגיות שלכם — ורואים מיד מה זוגות אחרים בישראל ענו. חינם, בלי הרשמה כדי להתחיל.",
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
        <Link href="/he/survey" className={styles.headerCta}>לשאלה של היום</Link>
      </header>

      <main className={styles.main}>
        <div className={styles.eyebrow}>חינם · אנונימי · שאלה ביום</div>
        <h1 className={styles.h1}>
          סקר הזוגיות <span className={styles.em}>של ישראל</span>
        </h1>
        <p className={styles.lead}>
          כל יום שאלה אחת על הזוגיות שלכם. בוחרים תשובה — ורואים מיד באחוזים חיים כמה זוגות בישראל ענו כמוכם, וכמה הפוך.
          זה מכניס פלפל לזוגיות ופותח שיחות שלא העזתם. הכי כיף לענות יחד.
        </p>
        <Link href="/he/survey" className={styles.cta}>מתחילים עכשיו ←</Link>
        <p className={styles.sub}>אפשר לענות ולראות תוצאות בלי הרשמה. רוצים שאלה חדשה כל יום? מצטרפים בחינם.</p>

        <div className={styles.cards}>
          <div className={styles.card}><div className={styles.cardBig}>שאלה ביום</div><div className={styles.cardSub}>שתי אפשרויות, 10 שניות</div></div>
          <div className={styles.card}><div className={styles.cardBig}>אחוזים חיים</div><div className={styles.cardSub}>מה זוגות בישראל ענו</div></div>
          <div className={styles.card}><div className={styles.cardBig}>יחד</div><div className={styles.cardSub}>הכי כיף עם בן/בת הזוג</div></div>
        </div>
      </main>

      {/* sticky mobile CTA */}
      <div className={styles.sticky}>
        <Link href="/he/survey" className={styles.stickyCta}>לשאלה של היום ←</Link>
      </div>
    </div>
  );
}
