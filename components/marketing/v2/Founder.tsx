"use client";

import { Link } from "@/navigation";
import { ParallaxImage } from "./ParallaxImage";
import { RevealOnScroll } from "./RevealOnScroll";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Founder - Itzik Berlev section. Two-column layout with photo +
 * floating badge on the left, full bio + CTAs on the right.
 *
 * CMS-migrated (Sprint 1). The headline carries <em> + <br>, the
 * lead carries <strong> — both render via CmsText.
 */
export function Founder() {
  const imageAlt = useCmsText("homeV2.founder.imageAlt");
  const badgeIcon = useCmsText("homeV2.founder.badgeIcon");
  const badgeTitle = useCmsText("homeV2.founder.badgeTitle");
  const badgeName = useCmsText("homeV2.founder.badgeName");
  const eyebrow = useCmsText("homeV2.founder.eyebrow");
  const bioRoleLabel = useCmsText("homeV2.founder.bioRoleLabel");
  const bioRoleValue = useCmsText("homeV2.founder.bioRoleValue");
  const bioExpertiseLabel = useCmsText("homeV2.founder.bioExpertiseLabel");
  const bioExpertiseValue = useCmsText("homeV2.founder.bioExpertiseValue");
  const bioLifeLabel = useCmsText("homeV2.founder.bioLifeLabel");
  const bioLifeValue = useCmsText("homeV2.founder.bioLifeValue");
  const cta = useCmsText("homeV2.founder.cta");

  return (
    <section className="founder" id="about">
      <div className="container">
        <div className="founder-grid">
          <div className="founder-image">
            <ParallaxImage
              src="/images/itzik-barlev.webp"
              alt={imageAlt.text}
              width={600}
              height={750}
              className="founder-img"
              range={14}
            />
            <div className="founder-badge">
              <div className="founder-badge-icon">{badgeIcon.text}</div>
              <div className="founder-badge-text">
                <div className="t1" style={badgeTitle.style}>
                  {badgeTitle.text}
                </div>
                <div className="t2" style={badgeName.style}>
                  {badgeName.text}
                </div>
              </div>
            </div>
          </div>

          <RevealOnScroll
            variant="fade-up"
            delay={0.1}
            className="founder-content"
          >
            <div className="eyebrow" style={eyebrow.style}>
              {eyebrow.text}
            </div>
            {/* headline carries <em> + <br> */}
            <CmsText cmsKey="homeV2.founder.headline" as="h2" />
            {/* lead carries <strong> */}
            <CmsText cmsKey="homeV2.founder.lead" as="p" className="lead" />

            <div className="founder-bio">
              <div className="bio-item">
                <div className="bio-item-label" style={bioRoleLabel.style}>
                  {bioRoleLabel.text}
                </div>
                <div className="bio-item-value" style={bioRoleValue.style}>
                  {bioRoleValue.text}
                </div>
              </div>
              <div className="bio-item">
                <div
                  className="bio-item-label"
                  style={bioExpertiseLabel.style}
                >
                  {bioExpertiseLabel.text}
                </div>
                <div
                  className="bio-item-value"
                  style={bioExpertiseValue.style}
                >
                  {bioExpertiseValue.text}
                </div>
              </div>
              <div className="bio-item">
                <div className="bio-item-label" style={bioLifeLabel.style}>
                  {bioLifeLabel.text}
                </div>
                <div className="bio-item-value" style={bioLifeValue.style}>
                  {bioLifeValue.text}
                </div>
              </div>
            </div>

            {/* Single CTA - was a primary + ghost pair, but the ghost was
                "המומחים שלנו" which over-promised: today the entire
                methodology is Itzik's. Adding a fake-team affordance would
                erode trust the moment a visitor clicked through. We can
                bring it back when there are actual additional experts on
                the masthead. */}
            <div className="founder-actions">
              <Link href="/about/founder" className="btn btn-primary">
                {cta.text} <span className="arrow">←</span>
              </Link>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
