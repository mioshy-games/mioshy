"use client";

import { ReviewsGrid } from "./ReviewsGrid";
import { Counter } from "./Counter";
import { RevealOnScroll } from "./RevealOnScroll";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Authority - third section. "5 years. Thousands of couples." narrative
 * + stat banner + 6-card reviews grid (with mobile load-more behavior
 * in ReviewsGrid).
 *
 * CMS-migrated (Sprint 1). The headline is split into 3 plain parts
 * + 1 italic-serif emphasis word (homeV2.authority.headlineEm). The
 * narrative paragraph carries <strong> markup and renders via CmsText.
 */
export function Authority() {
  const eyebrow = useCmsText("homeV2.authority.eyebrow");
  const headlinePart1 = useCmsText("homeV2.authority.headlinePart1");
  const headlinePart2 = useCmsText("homeV2.authority.headlinePart2");
  const headlineEm = useCmsText("homeV2.authority.headlineEm");
  const headlinePart3 = useCmsText("homeV2.authority.headlinePart3");
  const statCouplesLabel = useCmsText("homeV2.authority.statCouplesLabel");
  const since = useCmsText("homeV2.authority.since");
  const sinceLabel = useCmsText("homeV2.authority.sinceLabel");
  const ratingLabel = useCmsText("homeV2.authority.ratingLabel");
  const improvementLabel = useCmsText("homeV2.authority.improvementLabel");

  return (
    <section className="authority" id="reviews">
      <div className="container">
        <RevealOnScroll variant="scale-up">
          <div className="section-head">
            <div className="eyebrow" style={eyebrow.style}>
              {eyebrow.text}
            </div>
            <h2>
              {headlinePart1.text}
              <br />
              {/* Wrap line 2 ("אותה תוצאה.") in a non-breaking span so
                  the italic-serif <em> doesn't push "תוצאה" onto its
                  own line on mobile. With this, the heading reliably
                  reads as two lines: "5 שנים. 500+ זוגות." then
                  "אותה תוצאה." */}
              <span style={{ whiteSpace: "nowrap" }}>
                {headlinePart2.text}
                <em
                  style={{
                    color: "var(--accent)",
                    fontStyle: "italic",
                    fontFamily: "'Frank Ruhl Libre', serif",
                    display: "inline",
                  }}
                >
                  {headlineEm.text}
                </em>
                {headlinePart3.text}
              </span>
            </h2>
          </div>
        </RevealOnScroll>

        <RevealOnScroll variant="fade-up" delay={0.1}>
          <div className="auth-narrative">
            {/* narrative paragraph carries <strong> emphasis tags */}
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
              <div className="label" style={statCouplesLabel.style}>
                {statCouplesLabel.text}
              </div>
            </div>
            <div className="auth-divider"></div>
            <div className="auth-stat">
              <div className="num" style={since.style}>
                {since.text}
              </div>
              <div className="label" style={sinceLabel.style}>
                {sinceLabel.text}
              </div>
            </div>
            <div className="auth-divider"></div>
            <div className="auth-stat">
              <div className="num">
                <Counter to={4.8} decimals={1} thousands={false} /> / 5
              </div>
              <div className="label" style={ratingLabel.style}>
                {ratingLabel.text}
              </div>
            </div>
            <div className="auth-divider"></div>
            <div className="auth-stat">
              <div className="num">
                <em>
                  <Counter to={94} suffix="%" />
                </em>
              </div>
              <div className="label" style={improvementLabel.style}>
                {improvementLabel.text}
              </div>
            </div>
          </div>
        </RevealOnScroll>

        <ReviewsGrid />
      </div>
    </section>
  );
}
