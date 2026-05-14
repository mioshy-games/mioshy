"use client";

import { Link } from "@/navigation";
import { ParallaxImage } from "./ParallaxImage";
import { RevealOnScroll } from "./RevealOnScroll";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Founder — Itzik Berlev section. Sprint 4 #1 closeout: all DOM text
 * via <CmsText>; only `imageAlt` keeps useCmsText for the <img> alt.
 */
export function Founder() {
  const imageAlt = useCmsText("homeV2.founder.imageAlt");

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
              <CmsText
                cmsKey="homeV2.founder.badgeIcon"
                as="div"
                className="founder-badge-icon"
              />
              <div className="founder-badge-text">
                <CmsText cmsKey="homeV2.founder.badgeTitle" as="div" className="t1" />
                <CmsText cmsKey="homeV2.founder.badgeName" as="div" className="t2" />
              </div>
            </div>
          </div>

          <RevealOnScroll
            variant="fade-up"
            delay={0.1}
            className="founder-content"
          >
            <CmsText cmsKey="homeV2.founder.eyebrow" as="div" className="eyebrow" />
            <CmsText cmsKey="homeV2.founder.headline" as="h2" />
            <CmsText cmsKey="homeV2.founder.lead" as="p" className="lead" />

            <div className="founder-bio">
              <div className="bio-item">
                <CmsText
                  cmsKey="homeV2.founder.bioRoleLabel"
                  as="div"
                  className="bio-item-label"
                />
                <CmsText
                  cmsKey="homeV2.founder.bioRoleValue"
                  as="div"
                  className="bio-item-value"
                />
              </div>
              <div className="bio-item">
                <CmsText
                  cmsKey="homeV2.founder.bioExpertiseLabel"
                  as="div"
                  className="bio-item-label"
                />
                <CmsText
                  cmsKey="homeV2.founder.bioExpertiseValue"
                  as="div"
                  className="bio-item-value"
                />
              </div>
              <div className="bio-item">
                <CmsText
                  cmsKey="homeV2.founder.bioLifeLabel"
                  as="div"
                  className="bio-item-label"
                />
                <CmsText
                  cmsKey="homeV2.founder.bioLifeValue"
                  as="div"
                  className="bio-item-value"
                />
              </div>
            </div>

            <div className="founder-actions">
              <Link href="/about/founder" className="btn btn-primary">
                <CmsText cmsKey="homeV2.founder.cta" />{" "}
                <span className="arrow">←</span>
              </Link>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
