import "./styles.css";
import { useLocale } from "next-intl";
import { Hero } from "./Hero";
import { Problem } from "./Problem";
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
import { FinalCTA } from "./FinalCTA";
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
  return (
    <div className="home-v2 bg-white" dir={dir} lang={locale}>
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
      <FinalCTA />
      <FAQ />
      {/* <Problem /> moved from second-position (right under Hero) to
          end of page per Itzik 2026-05-08. The section also got
          re-toned from "you're not broken..." to a more optimistic
          frame — see messages/he.json:homeV2.problem. */}
      <Problem />
    </div>
  );
}
