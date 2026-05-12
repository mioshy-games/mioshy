"use client";

import { Counter } from "./Counter";
import { RevealOnScroll } from "./RevealOnScroll";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Education - "Why this happens". Light cream section with two-column
 * flow: narrative on the right, 4 dramatic stats on the left.
 *
 * CMS-migrated (Sprint 1). headline carries <br>, body carries <strong>.
 */
export function Education() {
  const eyebrow = useCmsText("homeV2.education.eyebrow");
  const stat1Suffix = useCmsText("homeV2.education.stat1Suffix");
  const stat1Label = useCmsText("homeV2.education.stat1Label");
  const stat2Suffix = useCmsText("homeV2.education.stat2Suffix");
  const stat2Label = useCmsText("homeV2.education.stat2Label");
  const stat3Prefix = useCmsText("homeV2.education.stat3Prefix");
  const stat3Label = useCmsText("homeV2.education.stat3Label");
  const stat4Suffix = useCmsText("homeV2.education.stat4Suffix");
  const stat4Label = useCmsText("homeV2.education.stat4Label");

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
              <div className="eyebrow" style={eyebrow.style}>
                {eyebrow.text}
              </div>
              {/* headline carries <br> */}
              <CmsText cmsKey="homeV2.education.headline" as="h2" />
              {/* body carries <strong> */}
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
                  <div className="label" style={stat1Label.style}>
                    {stat1Label.text}
                  </div>
                </div>
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      <Counter to={3} suffix={stat2Suffix.text} />
                    </em>
                  </div>
                  <div className="label" style={stat2Label.style}>
                    {stat2Label.text}
                  </div>
                </div>
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      {stat3Prefix.text}
                      <Counter to={4} />
                    </em>
                  </div>
                  <div className="label" style={stat3Label.style}>
                    {stat3Label.text}
                  </div>
                </div>
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      <Counter to={30} suffix={stat4Suffix.text} />
                    </em>
                  </div>
                  <div className="label" style={stat4Label.style}>
                    {stat4Label.text}
                  </div>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
