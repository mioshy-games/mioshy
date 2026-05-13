"use client";

import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Problem — "the warning signs" section. Sprint 4 #1 closeout: every
 * DOM text via <CmsText>. `imageAlt` keeps useCmsText for the <img>
 * alt attribute.
 */
export function Problem() {
  const imageAlt = useCmsText("homeV2.problem.imageAlt");

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
            <CmsText cmsKey="homeV2.problem.eyebrow" as="div" className="eyebrow" />
            <CmsText cmsKey="homeV2.problem.headline" as="h2" />
            <CmsText cmsKey="homeV2.problem.lead" as="p" className="lead" />

            <div className="problem-list">
              <div className="problem-item">
                <span className="problem-num">01</span>
                <div>
                  <CmsText cmsKey="homeV2.problem.item1Title" as="h3" />
                  <CmsText cmsKey="homeV2.problem.item1Body" as="p" />
                </div>
              </div>
              <div className="problem-item">
                <span className="problem-num">02</span>
                <div>
                  <CmsText cmsKey="homeV2.problem.item2Title" as="h3" />
                  <CmsText cmsKey="homeV2.problem.item2Body" as="p" />
                </div>
              </div>
              <div className="problem-item">
                <span className="problem-num">03</span>
                <div>
                  <CmsText cmsKey="homeV2.problem.item3Title" as="h3" />
                  <CmsText cmsKey="homeV2.problem.item3Body" as="p" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
