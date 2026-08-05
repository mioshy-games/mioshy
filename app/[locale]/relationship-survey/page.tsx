import type { Metadata } from "next";
import { SurveyLinkRaw } from "@/components/analytics/SurveyLink";
import { buildAlternates, buildOgLocale } from "@/lib/seo/alternates";
import { breadcrumbJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";
import styles from "./marketing.module.css";

export const dynamic = "force-dynamic";

const TITLE = "סקר הזוגיות של ישראל · מיאושי";
const DESCRIPTION =
  "סקר הזוגיות של ישראל: שאלות קצרות על זוגיות, ומיד אחרי כל תשובה רואים מה זוגות אחרים בישראל ענו. חינם ואנונימי.";

/**
 * The page shipped with no canonical and no hreflang, which — together with
 * being absent from the sitemap and having zero inbound internal links — left
 * all three of Google's discovery mechanisms empty at once. Built from the same
 * helper /couples-assessment uses so the canonical/hreflang/og-locale trio stays
 * identical across the site.
 *
 * The body below is Hebrew-only, so the `en` alternate points at a page that
 * renders Hebrew. That is the same situation as issue #48 and is NOT fixed
 * here: the alternate is emitted for consistency with every other route in the
 * sitemap (all of which publish both locales), and the English copy is a
 * separate piece of work.
 */
export function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Metadata {
  const locale = params.locale === "en" ? "en" : "he";
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com").replace(/\/+$/, "");
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: buildAlternates(locale, "/relationship-survey"),
    openGraph: {
      ...buildOgLocale(locale),
      type: "website",
      url: `${base}/${locale}/relationship-survey`,
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

/**
 * Stage 8 — standalone marketing page for the survey (NEW route, does NOT touch
 * the existing homepage). Own header + sticky mobile CTA. The Meta Pixel loads
 * site-wide via app/[locale]/layout.tsx (PageView); CompleteRegistration fires
 * on signup. Campaign target = this page → /he/survey.
 */
export default function RelationshipSurveyMarketing({
  params,
}: {
  params: { locale: string };
}) {
  const locale = params.locale === "en" ? "en" : "he";
  return (
    <div className={styles.page} dir="rtl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            ...breadcrumbJsonLd(locale, [
              { name: "סקר הזוגיות של ישראל", path: "/relationship-survey" },
            ]),
          }),
        }}
      />
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
