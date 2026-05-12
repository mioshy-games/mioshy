import "./styles.css";
import { useLocale } from "next-intl";
import {
  organizationJsonLd,
  safeJsonLd,
  webSiteJsonLd,
} from "@/lib/seo/jsonLd";
import { Hero } from "./Hero";
// `Problem` (./Problem.tsx) was removed from the homepage on
// 2026-05-11 (K1, content brief). The component file is intentionally
// kept so it can be re-introduced without re-writing it — restoration
// just needs an `import { Problem }` line + `<Problem />` in the JSX.
import { Authority } from "./Authority";
import { MediaSlider } from "./MediaSlider";
import { Founder } from "./Founder";
import { Journey } from "./Journey";
import { CouplesGames } from "./CouplesGames";
import { AdultGames } from "./AdultGames";
import { Education } from "./Education";
import { ForWhom } from "./ForWhom";
// `Pricing` (./Pricing.tsx) was removed from the homepage per Itzik
// 2026-05-06. JourneyStages — rewritten as a "mood swiper" — is now
// the single pricing surface on the homepage. The file is no longer
// imported anywhere and can be deleted.
import { JourneyStages } from "./JourneyStages";
// `FinalCTA` (./FinalCTA.tsx) was removed from the homepage on
// 2026-05-11 (I11, content brief). The "הצעד הראשון" eyebrow that
// section opened with duplicated the funnel work that JourneyStages
// + the per-section CTAs already do. Kept on disk for future use.
import { FAQ } from "./FAQ";

/**
 * HomepageV2 - new marketing homepage.
 *
 * Wraps all 13 marketing sections under a single `.home-v2` class.
 * The class scopes all styles in `./styles.css` and pulls design
 * tokens defined in `app/globals.css` under `.home-v2`.
 *
 * `bg-white` is applied here explicitly so the homepage paints over
 * the legacy dark `body { background: #0d0a14 }`. The `.home-v2`
 * class itself no longer forces a background - that lets it be
 * embedded inside coloured surfaces (e.g. the cream press card on
 * /games) without painting over them.
 *
 * Direction (`dir`) and language (`lang`) are pulled from the active
 * next-intl locale so the same markup serves both Hebrew (RTL) and
 * English (LTR) without a separate component tree.
 *
 * This component is rendered conditionally from `app/[locale]/page.tsx`
 * when `?new=1` is present in the URL (feature flag for staged rollout).
 */
export function HomepageV2() {
  const locale = useLocale();
  const dir = locale === "he" ? "rtl" : "ltr";
  const localeKey: "he" | "en" = locale === "en" ? "en" : "he";
  return (
    <div className="home-v2 bg-white" dir={dir} lang={locale}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(webSiteJsonLd(localeKey)),
        }}
      />
      <Hero />
      <Authority />
      <MediaSlider />
      <Founder />
      <Journey />
      <CouplesGames />
      <AdultGames />
      <Education />
      <ForWhom />
      <JourneyStages />
      <FAQ />
    </div>
  );
}
