"use client";

import { Link } from "@/navigation";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Journey - editorial timeline of 4 stages. Connecting hairline line
 * through all 4 numbers, each stage with its own checklist of features.
 * Closing CTA banner at the bottom.
 *
 * CMS-migrated (Sprint 1). The 4 stages × 5 fields (title, description,
 * 3 bullets) are read via the JourneyStage sub-component below — keeps
 * the parent's hook order shallow and lets each stage have its own
 * stable hook sequence.
 */
export function Journey() {
  const eyebrow = useCmsText("homeV2.journey.eyebrow");
  const description = useCmsText("homeV2.journey.description");
  const ctaText = useCmsText("homeV2.journey.ctaText");
  const cta = useCmsText("homeV2.journey.cta");

  return (
    <section className="journey" id="journey">
      <div className="container">
        <div className="section-head journey-head">
          <div className="eyebrow" style={eyebrow.style}>
            {eyebrow.text}
          </div>
          {/* headline carries <em> + <br> */}
          <CmsText cmsKey="homeV2.journey.headline" as="h2" />
          <p style={description.style}>{description.text}</p>
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
          <div className="journey-cta-text" style={ctaText.style}>
            {ctaText.text}
          </div>
          <Link href="/journey/assessment" className="btn btn-primary">
            {cta.text} <span className="arrow">←</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Per-stage row. Each stage reads 5 keys (title, description, 3 bullets);
 * extracting into a component gives each stage its own stable hook order.
 */
function JourneyStage({
  num,
  stageKey,
}: {
  num: string;
  stageKey: "stage1" | "stage2" | "stage3" | "stage4";
}) {
  const title = useCmsText(`homeV2.journey.${stageKey}Title`);
  const description = useCmsText(`homeV2.journey.${stageKey}Description`);
  const b1 = useCmsText(`homeV2.journey.${stageKey}Bullet1`);
  const b2 = useCmsText(`homeV2.journey.${stageKey}Bullet2`);
  const b3 = useCmsText(`homeV2.journey.${stageKey}Bullet3`);

  return (
    <div className="journey-stage">
      <div className="journey-num-wrap">
        <div className="journey-num">
          {num}
          <span className="dot">.</span>
        </div>
      </div>
      <h3 style={title.style}>{title.text}</h3>
      <p style={description.style}>{description.text}</p>
      <ul className="journey-list">
        <li style={b1.style}>{b1.text}</li>
        <li style={b2.style}>{b2.text}</li>
        <li style={b3.style}>{b3.text}</li>
      </ul>
    </div>
  );
}
