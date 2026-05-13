"use client";

import { Counter } from "./Counter";
import { RevealOnScroll } from "./RevealOnScroll";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Education — narrative + 4 dramatic stats.
 * Sprint 4 #1 closeout: DOM text via <CmsText>; suffix / prefix
 * keys for Counter stay on useCmsText since they're prop values.
 */
export function Education() {
  // Counter suffix / prefix are prop strings, not DOM children.
  const stat1Suffix = useCmsText("homeV2.education.stat1Suffix");
  const stat2Suffix = useCmsText("homeV2.education.stat2Suffix");
  const stat3Prefix = useCmsText("homeV2.education.stat3Prefix");
  const stat4Suffix = useCmsText("homeV2.education.stat4Suffix");

  return (
    <section className="education">
      <div className="edu-orb"></div>
      <div className="edu-particles">
        <span className="edu-particle"></span>
        <span className="edu-particle"></span>
        <span className="edu-particle"></span>
        <span className="edu-particle"></span>
        <span className="edu-particle"></span>
      </div>
      <div className="container">
        <div className="edu-grid">
          <RevealOnScroll variant="fade-up">
            <div>
              <CmsText cmsKey="homeV2.education.eyebrow" as="div" className="eyebrow" />
              <CmsText cmsKey="homeV2.education.headline" as="h2" />
              <CmsText cmsKey="homeV2.education.body" as="p" />
            </div>
          </RevealOnScroll>
          <RevealOnScroll variant="fade-up" delay={0.15}>
            <div>
              <div className="edu-stat-grid">
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      <Counter to={67} suffix={stat1Suffix.text} />
                    </em>
                  </div>
                  <CmsText cmsKey="homeV2.education.stat1Label" as="div" className="label" />
                </div>
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      <Counter to={3} suffix={stat2Suffix.text} />
                    </em>
                  </div>
                  <CmsText cmsKey="homeV2.education.stat2Label" as="div" className="label" />
                </div>
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      {stat3Prefix.text}
                      <Counter to={4} />
                    </em>
                  </div>
                  <CmsText cmsKey="homeV2.education.stat3Label" as="div" className="label" />
                </div>
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      <Counter to={30} suffix={stat4Suffix.text} />
                    </em>
                  </div>
                  <CmsText cmsKey="homeV2.education.stat4Label" as="div" className="label" />
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
