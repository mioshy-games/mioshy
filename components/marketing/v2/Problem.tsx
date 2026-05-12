"use client";

import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Problem - "the warning signs" section. Two-column layout (image +
 * text) with a 3-item numbered list. The headline carries an <em> for
 * the wine-colour emphasis; item1Body has a <br> mid-line.
 *
 * CMS-migrated (Sprint 1).
 */
export function Problem() {
  const imageAlt = useCmsText("homeV2.problem.imageAlt");
  const eyebrow = useCmsText("homeV2.problem.eyebrow");
  const lead = useCmsText("homeV2.problem.lead");
  const item1Title = useCmsText("homeV2.problem.item1Title");
  const item2Title = useCmsText("homeV2.problem.item2Title");
  const item2Body = useCmsText("homeV2.problem.item2Body");
  const item3Title = useCmsText("homeV2.problem.item3Title");
  const item3Body = useCmsText("homeV2.problem.item3Body");

  return (
    <section className="problem" id="problem">
      <div className="container">
        <div className="problem-grid">
          <div className="problem-image">
            <picture>
              <source
                media="(max-width: 640px)"
                srcSet="/images/woman-w.webp"
              />
              <img
                src="/images/woman%20mioshy.webp"
                alt={imageAlt.text}
                className="problem-img"
                loading="lazy"
              />
            </picture>
          </div>

          <div className="problem-text">
            <div className="eyebrow" style={eyebrow.style}>
              {eyebrow.text}
            </div>
            {/* headline carries <em> markup */}
            <CmsText cmsKey="homeV2.problem.headline" as="h2" />
            <p className="lead" style={lead.style}>
              {lead.text}
            </p>

            <div className="problem-list">
              <div className="problem-item">
                <span className="problem-num">01</span>
                <div>
                  <h3 style={item1Title.style}>{item1Title.text}</h3>
                  {/* item1Body has inline <br> */}
                  <CmsText cmsKey="homeV2.problem.item1Body" as="p" />
                </div>
              </div>
              <div className="problem-item">
                <span className="problem-num">02</span>
                <div>
                  <h3 style={item2Title.style}>{item2Title.text}</h3>
                  <p style={item2Body.style}>{item2Body.text}</p>
                </div>
              </div>
              <div className="problem-item">
                <span className="problem-num">03</span>
                <div>
                  <h3 style={item3Title.style}>{item3Title.text}</h3>
                  <p style={item3Body.style}>{item3Body.text}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
