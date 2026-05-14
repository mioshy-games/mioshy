"use client";

import { Link } from "@/navigation";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Journey — 4-stage editorial timeline + closing CTA banner.
 * Sprint 4 #1 closeout: every DOM text via <CmsText>.
 */
export function Journey() {
  return (
    <section className="journey" id="journey">
      <div className="container">
        <div className="section-head journey-head">
          <CmsText cmsKey="homeV2.journey.eyebrow" as="div" className="eyebrow" />
          <CmsText cmsKey="homeV2.journey.headline" as="h2" />
          <CmsText cmsKey="homeV2.journey.description" as="p" />
        </div>

        <div className="journey-timeline">
          <div className="journey-line"></div>
          <div className="journey-stages">
            <JourneyStage num="01" stageKey="stage1" />
            <JourneyStage num="02" stageKey="stage2" />
            <JourneyStage num="03" stageKey="stage3" />
            <JourneyStage num="04" stageKey="stage4" />
          </div>
        </div>

        <div className="journey-cta">
          <CmsText
            cmsKey="homeV2.journey.ctaText"
            as="div"
            className="journey-cta-text"
          />
          <Link href="/journey/assessment" className="btn btn-primary">
            <CmsText cmsKey="homeV2.journey.cta" /> <span className="arrow">←</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function JourneyStage({
  num,
  stageKey,
}: {
  num: string;
  stageKey: "stage1" | "stage2" | "stage3" | "stage4";
}) {
  return (
    <div className="journey-stage">
      <div className="journey-num-wrap">
        <div className="journey-num">
          {num}
          <span className="dot">.</span>
        </div>
      </div>
      <CmsText cmsKey={`homeV2.journey.${stageKey}Title`} as="h3" />
      <CmsText cmsKey={`homeV2.journey.${stageKey}Description`} as="p" />
      <ul className="journey-list">
        <li>
          <CmsText cmsKey={`homeV2.journey.${stageKey}Bullet1`} />
        </li>
        <li>
          <CmsText cmsKey={`homeV2.journey.${stageKey}Bullet2`} />
        </li>
        <li>
          <CmsText cmsKey={`homeV2.journey.${stageKey}Bullet3`} />
        </li>
      </ul>
    </div>
  );
}
