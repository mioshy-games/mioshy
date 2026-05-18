"use client";

import { TrackedLink } from "./TrackedLink";
import { CmsText } from "@/components/cms/CmsText";

/**
 * FinalCTA — closing two-column choice grid. Sprint 4 #1 closeout:
 * every DOM text via <CmsText>. `headline` is pre-flagged is_rich
 * so its `<br>` renders correctly.
 */
export function FinalCTA() {
  return (
    <section className="final" id="start">
      <div className="final-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>
      <div className="container">
        <div
          className="eyebrow"
          style={{ justifyContent: "center", display: "flex" }}
        >
          <CmsText cmsKey="homeV2.finalCta.eyebrow" />
        </div>
        <CmsText cmsKey="homeV2.finalCta.headline" as="h2" className="display" />
        <CmsText cmsKey="homeV2.finalCta.description" as="p" />

        <div className="final-choice-grid">
          <div className="final-choice final-choice-featured">
            <CmsText
              cmsKey="homeV2.finalCta.choice1Tag"
              className="final-choice-tag"
            />
            <CmsText cmsKey="homeV2.finalCta.choice1Title" as="h3" />
            <CmsText cmsKey="homeV2.finalCta.choice1Body" as="p" />
            <TrackedLink
              href="/journey"
              className="btn btn-primary"
              ctaId="final_primary"
              section="final"
            >
              <CmsText cmsKey="homeV2.finalCta.choice1Cta" />{" "}
              <span className="arrow">←</span>
            </TrackedLink>
          </div>

          <div className="final-choice">
            <CmsText
              cmsKey="homeV2.finalCta.choice2Tag"
              className="final-choice-tag"
            />
            <CmsText cmsKey="homeV2.finalCta.choice2Title" as="h3" />
            <CmsText cmsKey="homeV2.finalCta.choice2Body" as="p" />
            <TrackedLink
              href="/mioshy-sex"
              className="btn btn-ghost"
              ctaId="final_secondary"
              section="final"
            >
              <CmsText cmsKey="homeV2.finalCta.choice2Cta" />{" "}
              <span className="arrow">←</span>
            </TrackedLink>
          </div>
        </div>

        <div className="final-trust">
          <CmsText cmsKey="homeV2.finalCta.trust1" />
          <CmsText cmsKey="homeV2.finalCta.trust2" />
          <CmsText cmsKey="homeV2.finalCta.trust3" />
        </div>
      </div>
    </section>
  );
}
