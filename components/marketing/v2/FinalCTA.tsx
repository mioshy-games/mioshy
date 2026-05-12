"use client";

import { TrackedLink } from "./TrackedLink";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * FinalCTA - closing section with animated background blobs, dramatic
 * headline, and two-column choice grid (online vs adults).
 *
 * CMS-migrated (Sprint 1, feature/admin-cms). Every editable string
 * now flows through useCmsText / <CmsText>, with JSON fallback when
 * the CMS row is missing or empty.
 */
export function FinalCTA() {
  const eyebrow = useCmsText("homeV2.finalCta.eyebrow");
  const description = useCmsText("homeV2.finalCta.description");
  const choice1Tag = useCmsText("homeV2.finalCta.choice1Tag");
  const choice1Title = useCmsText("homeV2.finalCta.choice1Title");
  const choice1Body = useCmsText("homeV2.finalCta.choice1Body");
  const choice1Cta = useCmsText("homeV2.finalCta.choice1Cta");
  const choice2Tag = useCmsText("homeV2.finalCta.choice2Tag");
  const choice2Title = useCmsText("homeV2.finalCta.choice2Title");
  const choice2Body = useCmsText("homeV2.finalCta.choice2Body");
  const choice2Cta = useCmsText("homeV2.finalCta.choice2Cta");
  const trust1 = useCmsText("homeV2.finalCta.trust1");
  const trust2 = useCmsText("homeV2.finalCta.trust2");
  const trust3 = useCmsText("homeV2.finalCta.trust3");

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
          style={{ justifyContent: "center", display: "flex", ...eyebrow.style }}
        >
          {eyebrow.text}
        </div>
        {/* headline contains <br> markup — render via CmsText so
            dangerouslySetInnerHTML resolves the tag identically to the
            previous t.rich({ br: () => <br /> }) path. */}
        <CmsText cmsKey="homeV2.finalCta.headline" as="h2" className="display" />
        <p style={description.style}>{description.text}</p>

        <div className="final-choice-grid">
          <div className="final-choice final-choice-featured">
            <span className="final-choice-tag" style={choice1Tag.style}>
              {choice1Tag.text}
            </span>
            <h3 style={choice1Title.style}>{choice1Title.text}</h3>
            <p style={choice1Body.style}>{choice1Body.text}</p>
            <TrackedLink
              href="/journey"
              className="btn btn-primary"
              ctaId="final_primary"
              section="final"
            >
              {choice1Cta.text} <span className="arrow">←</span>
            </TrackedLink>
          </div>

          <div className="final-choice">
            <span className="final-choice-tag" style={choice2Tag.style}>
              {choice2Tag.text}
            </span>
            <h3 style={choice2Title.style}>{choice2Title.text}</h3>
            <p style={choice2Body.style}>{choice2Body.text}</p>
            <TrackedLink
              href="/mioshy-sex"
              className="btn btn-ghost"
              ctaId="final_secondary"
              section="final"
            >
              {choice2Cta.text} <span className="arrow">←</span>
            </TrackedLink>
          </div>
        </div>

        <div className="final-trust">
          <span style={trust1.style}>{trust1.text}</span>
          <span style={trust2.style}>{trust2.text}</span>
          <span style={trust3.style}>{trust3.text}</span>
        </div>
      </div>
    </section>
  );
}
