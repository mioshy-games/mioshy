"use client";

import { ReviewsGrid } from "./ReviewsGrid";
import { Counter } from "./Counter";
import { RevealOnScroll } from "./RevealOnScroll";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Authority — "5 years. 500+ couples." narrative + stat banner + 6-card
 * reviews grid. Sprint 4 #1 closeout: every DOM text flows through
 * <CmsText> so promoting a row plain→rich in the editor takes effect on
 * /he without per-component changes. The headline stays a 4-part split
 * because Itzik wants the italic-serif <em> on `headlineEm` to be
 * styled inline (wine-red Frank Ruhl Libre) regardless of CMS mode.
 */
export function Authority() {
  return (
    <section className="authority" id="reviews">
      <div className="container">
        <RevealOnScroll variant="scale-up">
          <div className="section-head">
            <CmsText cmsKey="homeV2.authority.eyebrow" as="div" className="eyebrow" />
            <h2>
              <CmsText cmsKey="homeV2.authority.headlinePart1" />
              <br />
              {/* Italic <em> with "תוצאה" removed 2026-05-19 per Itzik.
                  The non-breaking <span> that wrapped the second line
                  (so "אותה תוצאה." stayed together on mobile) is also
                  no longer needed without the em, so this whole block
                  is removed from the render. Keys headlinePart2,
                  headlineEm, headlinePart3 stay on disk for future use. */}
            </h2>
          </div>
        </RevealOnScroll>

        <RevealOnScroll variant="fade-up" delay={0.1}>
          <div className="auth-narrative">
            <CmsText cmsKey="homeV2.authority.narrative" as="p" />
          </div>
        </RevealOnScroll>

        <RevealOnScroll variant="fade-up" delay={0.15}>
          <div className="auth-banner">
            <div className="auth-stat">
              <div className="num">
                <em>
                  <Counter to={500} prefix="+" />
                </em>
              </div>
              <CmsText cmsKey="homeV2.authority.statCouplesLabel" as="div" className="label" />
            </div>
            <div className="auth-divider"></div>
            <div className="auth-stat">
              <CmsText cmsKey="homeV2.authority.since" as="div" className="num" />
              <CmsText cmsKey="homeV2.authority.sinceLabel" as="div" className="label" />
            </div>
            <div className="auth-divider"></div>
            <div className="auth-stat">
              <div className="num">
                <Counter to={4.8} decimals={1} thousands={false} /> / 5
              </div>
              <CmsText cmsKey="homeV2.authority.ratingLabel" as="div" className="label" />
            </div>
            <div className="auth-divider"></div>
            <div className="auth-stat">
              <div className="num">
                <em>
                  <Counter to={94} suffix="%" />
                </em>
              </div>
              <CmsText cmsKey="homeV2.authority.improvementLabel" as="div" className="label" />
            </div>
          </div>
        </RevealOnScroll>

        <ReviewsGrid />
      </div>
    </section>
  );
}
