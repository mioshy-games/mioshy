"use client";

import { TrackedLink } from "./TrackedLink";
import { RevealOnScroll } from "./RevealOnScroll";
import { Counter } from "./Counter";
import { ParallaxImage } from "./ParallaxImage";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Hero - first section of HomepageV2.
 *
 * CMS migration (Sprint 4 #1 closeout, 2026-05-13):
 *   Every DOM text now flows through <CmsText cmsKey="…" /> instead of
 *   `{useCmsText(key).text}`. CmsText picks plain text-node rendering
 *   vs dangerouslySetInnerHTML based on the row's is_rich flag — so
 *   when an admin promotes a plain key like homeV2.hero.tag to rich
 *   via the toolbar toggle, the next render switches to HTML mode
 *   automatically. No per-component changes needed.
 *
 *   useCmsText() is still used directly for VALUES THAT AREN'T DOM
 *   children — alt attributes, aria-labels, Counter suffix props.
 */
export function Hero() {
  // Non-DOM consumers (attributes / prop values). These need raw
  // strings, not JSX, so they keep the useCmsText hook.
  const priceFromLabel = useCmsText("homeV2.hero.priceFromLabel");
  const imageAlt = useCmsText("homeV2.hero.imageAlt");

  return (
    <section className="hero">
      {/* Performance: hero animation count cut nearly in half per Itzik
          2026-05-06. Was 36 simultaneous animated layers (5 blobs + 1
          circle + 18 sparkles + 12 orbits) — the audit found this was
          a major source of GPU pressure. Now 16 (3 blobs + 1 circle +
          6 sparkles + 6 orbits) — same atmosphere, half the cost. */}
      <div className="hero-bg">
        <div className="hero-blob hero-blob-1"></div>
        <div className="hero-blob hero-blob-2"></div>
        <div className="hero-blob hero-blob-3"></div>
        {/* Floating soft-blurred circle. */}
        <div className="hero-floating-circle"></div>
        {/* Floating orbs (single-layer .hero-orbs-field) removed
            2026-05-19 per Itzik — sizing experiments didn't land.
            CSS rule in styles.css kept inert for future reuse. */}
      </div>
      <div className="hero-grain"></div>
      <div className="container">
        <div className="hero-grid">
          <div className="hero-text">
            <RevealOnScroll variant="fade-up" delay={0}>
              <div className="hero-tag">
                <span className="dot"></span>{" "}
                <CmsText cmsKey="homeV2.hero.tag" />
              </div>
            </RevealOnScroll>

            <RevealOnScroll variant="scale-up" delay={0.05}>
              <CmsText cmsKey="homeV2.hero.headline" as="h1" />
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.15}>
              <CmsText cmsKey="homeV2.hero.lead" as="p" className="lead" />
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.25}>
              <div className="hero-actions">
                <TrackedLink
                  href="/journey"
                  className="btn btn-primary"
                  ctaId="hero_primary"
                  section="hero"
                >
                  <CmsText cmsKey="homeV2.hero.ctaPrimary" />
                </TrackedLink>
              </div>
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.30}>
              {/* priceFromLabel is used twice: once via CmsText for the
                  visible text (rich, so <strong> renders correctly),
                  and once via useCmsText().text for the aria-label
                  where we strip <strong> via regex. Two distinct
                  rendering paths, same key. */}
              <div
                className="hero-price-from"
                aria-label={priceFromLabel.text.replace(/<\/?strong>/g, "")}
              >
                <span className="dot" aria-hidden></span>
                <CmsText cmsKey="homeV2.hero.priceFromLabel" />
              </div>
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.35}>
              <div className="hero-meta">
                <div className="hero-meta-item">
                  <span className="num">
                    <Counter to={500} prefix="+" />
                  </span>
                  <CmsText
                    cmsKey="homeV2.hero.statCouplesLabel"
                    className="label"
                  />
                </div>
                <div className="hero-meta-item">
                  <span className="num">
                    <Counter to={3} />
                  </span>
                  <CmsText
                    cmsKey="homeV2.hero.statExpertsLabel"
                    className="label"
                  />
                </div>
              </div>
            </RevealOnScroll>
          </div>

          <div className="hero-visual">
            <ParallaxImage
              src="/images/hero.webp"
              alt={imageAlt.text}
              width={720}
              height={900}
              className="hero-img"
              priority
              // The hero image is the LCP element on mobile. Without `sizes`
              // Next picks the widest srcset entry on every viewport, which
              // shipped a ~720px image to phones rendering it at ~340px and
              // pushed mobile LCP past 4 s. The breakpoint matches the
              // single-column → two-column flip in styles.css (the .hero-grid
              // collapses to one column below 1024 px and the image fills the
              // viewport; on desktop it tops out near 720 px in the right
              // column).
              sizes="(max-width: 1024px) 100vw, 720px"
              // fetchPriority="high" — pairs with `priority` and the
              // ReactDOM.preload() in HomepageV2 so the browser network
              // stack treats this resource as critical-path. PSI 2026-05-21.
              fetchPriority="high"
              range={16}
            />
            <div className="badge-floating badge-1">
              <div className="badge-icon">♡</div>
              <div className="badge-text">
                <CmsText cmsKey="homeV2.hero.badge1Title" as="div" className="t1" />
                <CmsText cmsKey="homeV2.hero.badge1Body" as="div" className="t2" />
              </div>
            </div>
            <div className="badge-floating badge-2">
              <div className="badge-icon">✦</div>
              <div className="badge-text">
                <CmsText cmsKey="homeV2.hero.badge2Title" as="div" className="t1" />
                <CmsText cmsKey="homeV2.hero.badge2Body" as="div" className="t2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
