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
              src="/images/itzik-barlev_new.webp"
              alt={imageAlt.text}
              width={700}
              height={700}
              className="founder-img"
              range={14}
              // PERF 2026-05-21 — without `sizes`, next/image defaults to 100vw
              // and the browser picks the largest srcset entry (w=1200). PSI
              // 2026-05-21 flagged a 89KB waste — image displays at 372×464
              // but served at 1154×1440. Breakpoints below match styles.css:
              //   • mobile (≤640): .founder-image is full width minus 40px padding
              //   • tablet (≤1100): max-width:480px capped + centered
              //   • desktop: 480px (right column ~0.95fr of grid)
              sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1100px) 480px, 480px"
            />
            {/* 2026-06-09 — floating founder badge (יב / מייסד מיאושי /
                יצחק ברלב) removed per Itzik. CMS keys homeV2.founder.
                badgeIcon/badgeTitle/badgeName and the `.founder-badge*`
                CSS stay on disk for possible re-use. */}
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
                <CmsText cmsKey="homeV2.founder.cta" />
              </Link>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
