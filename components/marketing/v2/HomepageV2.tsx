import "./styles.css";
import ReactDOM from "react-dom";
import dynamic from "next/dynamic";
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
//
// `Intimacy` (./Intimacy.tsx) had two halves on 2026-05-18: a
// loneliness framing on top + "how Mioshy solves it" on bottom.
// Itzik kept only the bottom half (bridge + 3 pillars + CTA) — the
// loneliness framing wasn't on-brand and the top half was occupying
// expensive above-the-fold real estate. Top-half JSX is removed from
// this file's render, but the JSON keys, CSS classes, and the
// FeelsCard helper are intentionally retained on disk for re-use.
//
// `Education` (./Education.tsx) was removed on 2026-05-18 — Itzik
// felt the content didn't fit Mioshy's voice and the unsourced
// stats violated his rule against statistics without a source.
// Component file kept on disk.
import { Intimacy } from "./Intimacy";
// `Authority` (./Authority.tsx) was removed from the homepage
// 2026-05-19 per Itzik. Component file + CMS keys
// (homeV2.authority.*) stay on disk for possible re-introduction.
// PERF 2026-05-21 — below-fold sections converted to next/dynamic.
// Each gets its own client JS chunk, so the main route chunk shrinks
// and the chunks for these sections load in parallel after the
// critical-path resources. Server-side rendering is preserved
// (no `ssr:false`) — SEO + first-paint HTML are unchanged, only the
// client hydration JS is deferred/split.
// Loading placeholder returns null because:
//   • The section's HTML is fully rendered server-side (SSR retained).
//   • content-visibility:auto + contain-intrinsic-size already reserve
//     the right amount of vertical space per-section, so no skeleton
//     is needed visually.
const MediaSlider = dynamic(
  () => import("./MediaSlider").then((m) => ({ default: m.MediaSlider })),
  { loading: () => null },
);
const Founder = dynamic(
  () => import("./Founder").then((m) => ({ default: m.Founder })),
  { loading: () => null },
);
// `Journey` (./Journey.tsx) was moved off the homepage 2026-05-19 per
// Itzik — the inside-look promise now lives on /mioshy-sex. Component
// file is still imported by /mioshy-sex so we don't delete it; we
// simply no longer render it here.
import { CouplesGames } from "./CouplesGames";
import { AdultGames } from "./AdultGames";
import { ForWhom } from "./ForWhom";
// `Pricing` (./Pricing.tsx) was removed from the homepage per Itzik
// 2026-05-06. JourneyStages — rewritten as a "mood swiper" — is now
// the single pricing surface on the homepage. The file is no longer
// imported anywhere and can be deleted.
import { JourneyStages } from "./JourneyStages";
const ReviewsGrid = dynamic(
  () => import("./ReviewsGrid").then((m) => ({ default: m.ReviewsGrid })),
  { loading: () => null },
);
// `FinalCTA` (./FinalCTA.tsx) was removed from the homepage on
// 2026-05-11 (I11, content brief). The "הצעד הראשון" eyebrow that
// section opened with duplicated the funnel work that JourneyStages
// + the per-section CTAs already do. Kept on disk for future use.
// FAQ converted to a Server Component on 2026-05-21 — pure structural
// JSX with <details> + <CmsText> inside, no client features. Direct
// import is fine: no client chunk, no hydration overhead. next/dynamic
// was removed here because dynamic() is designed for client components.
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

  // LCP preload (2026-05-21) — hero.webp is the LCP candidate on this
  // page only. ReactDOM.preload() emits a <link rel="preload"> that
  // Next.js hoists into <head> at SSR time, before the React tree
  // renders. Bound to this component (not the root layout) so we
  // don't waste bytes preloading the marketing hero on /pricing,
  // /games, /journey, /auth etc. — only when this homepage actually
  // renders.
  // `imageSrcSet` + `imageSizes` MUST match the props passed to
  // <ParallaxImage> in Hero.tsx so the browser doesn't double-fetch
  // or pick the wrong size. Single-source srcset is intentional —
  // next/image with priority emits its own srcset entry; the
  // preload's job is just to kick the request earlier.
  ReactDOM.preload("/images/hero.webp", {
    as: "image",
    imageSrcSet: "/images/hero.webp",
    imageSizes: "(max-width: 1024px) 100vw, 720px",
    fetchPriority: "high",
  });

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
      {/* Section order set 2026-05-19 by Itzik. Authority also
         removed this day. Current storyline:
            1. Hero            — hook + price floor
            2. Intimacy        — bridge + 3 pillars + CTA
            3. ForWhom         — "is this for me" sorter
            4. AdultGames      — bold offering
            5. CouplesGames    — light offering
            6. JourneyStages   — the three "moods" / pricing pivot
            7. Founder         — human face behind it
            8. MediaSlider     — press / social-proof images
            9. ReviewsGrid     — couples talking
           10. FAQ             — close objections                         */}
      <Hero />
      <Intimacy />
      <ForWhom />
      <AdultGames />
      <CouplesGames />
      <JourneyStages />
      <Founder />
      {/* 2026-06-09 — MediaSlider ("כתבו עלינו") moved below
          ReviewsGrid per Itzik, so the press logos close the
          social-proof block instead of opening it. */}
      <ReviewsGrid />
      <MediaSlider />
      <FAQ />
    </div>
  );
}
