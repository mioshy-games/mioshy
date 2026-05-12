"use client";

import { TrackedLink } from "./TrackedLink";
import { RevealOnScroll } from "./RevealOnScroll";
import { Counter } from "./Counter";
import { ParallaxImage } from "./ParallaxImage";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Hero - first section of HomepageV2.
 * Dark animated background with 5 floating blobs, headline, lead paragraph,
 * primary + secondary CTAs, social-proof meta strip, and right-side image
 * with two floating badge cards.
 *
 * CMS migration (2026-05-12, feature/admin-cms Phase 2):
 *   Every editable string is now sourced via `useCmsText(key)` instead of
 *   `useTranslations()`. The hook returns `{ text, style? }` — text resolves
 *   to the CMS row if non-empty, otherwise falls back to messages/*.json.
 *   `<CmsText cmsKey="..." />` is used for keys that carry inline HTML
 *   markup (<em>, <strong>) since dangerouslySetInnerHTML matches the
 *   existing render shape without parsing.
 *
 * Animations:
 *  • Headline: scale-up reveal (94% → 100%) on first paint
 *  • Lead, CTAs, meta: fade-up reveal staggered
 *  • Stat numbers: count-up from 0 when in view
 *  • Hero image: subtle parallax on scroll (16px range)
 *  • Background blobs: CSS-driven (in styles.css), pause on reduced-motion
 */
export function Hero() {
  // ── Plain-text keys (no HTML markup) ──────────────────────────────
  // Each call returns { text, style? }. `text` is the resolved string
  // (CMS → JSON fallback). `style` is set only when the CMS row has
  // per-language typography overrides; otherwise undefined — React
  // skips empty style attributes so the DOM stays identical to the
  // pre-migration version.
  const tag = useCmsText("homeV2.hero.tag");
  const lead = useCmsText("homeV2.hero.lead");
  const ctaPrimary = useCmsText("homeV2.hero.ctaPrimary");
  const priceFromLabel = useCmsText("homeV2.hero.priceFromLabel");
  const statCouplesLabel = useCmsText("homeV2.hero.statCouplesLabel");
  const statExpertsLabel = useCmsText("homeV2.hero.statExpertsLabel");
  const statRatingLabel = useCmsText("homeV2.hero.statRatingLabel");
  const imageAlt = useCmsText("homeV2.hero.imageAlt");
  const badge1Title = useCmsText("homeV2.hero.badge1Title");
  const badge1Body = useCmsText("homeV2.hero.badge1Body");
  const badge2Title = useCmsText("homeV2.hero.badge2Title");
  const badge2Body = useCmsText("homeV2.hero.badge2Body");

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
        {/* Drifting sparkles — 6 (was 18). Same look at half the cost. */}
        <div className="hero-particles" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className={`hero-spark hero-spark-${(i % 6) + 1}`}></span>
          ))}
        </div>
        {/* Wheels-game-style orbit dots — 6 (was 12). */}
        <span className="hero-orbit hero-orbit-1" aria-hidden></span>
        <span className="hero-orbit hero-orbit-2" aria-hidden></span>
        <span className="hero-orbit hero-orbit-3" aria-hidden></span>
        <span className="hero-orbit hero-orbit-4" aria-hidden></span>
        <span className="hero-orbit hero-orbit-5" aria-hidden></span>
        <span className="hero-orbit hero-orbit-6" aria-hidden></span>
      </div>
      <div className="hero-grain"></div>
      <div className="container">
        <div className="hero-grid">
          <div className="hero-text">
            <RevealOnScroll variant="fade-up" delay={0}>
              <div className="hero-tag" style={tag.style}>
                <span className="dot"></span> {tag.text}
              </div>
            </RevealOnScroll>

            <RevealOnScroll variant="scale-up" delay={0.05}>
              {/* Rich text — contains <em> markup. CmsText renders via
                  dangerouslySetInnerHTML on the h1 itself so styles
                  (per-language typography overrides) apply to the
                  heading element directly. */}
              <CmsText cmsKey="homeV2.hero.headline" as="h1" />
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.15}>
              <p className="lead" style={lead.style}>
                {lead.text}
              </p>
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.25}>
              <div className="hero-actions">
                <TrackedLink
                  href="/journey"
                  className="btn btn-primary"
                  ctaId="hero_primary"
                  section="hero"
                >
                  {ctaPrimary.text} <span className="arrow">←</span>
                </TrackedLink>
              </div>
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.30}>
              {/* priceFromLabel contains <strong> markup. The aria-label
                  needs the same string with the tag stripped — we read
                  via useCmsText (raw, includes tags) and apply the same
                  regex strip the old code used. */}
              <div
                className="hero-price-from"
                aria-label={priceFromLabel.text.replace(/<\/?strong>/g, "")}
              >
                <span className="dot" aria-hidden></span>
                <CmsText cmsKey="homeV2.hero.priceFromLabel" as="span" />
              </div>
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.35}>
              <div className="hero-meta">
                <div className="hero-meta-item">
                  <span className="num">
                    <Counter to={500} prefix="+" />
                  </span>
                  <span className="label" style={statCouplesLabel.style}>
                    {statCouplesLabel.text}
                  </span>
                </div>
                <div className="hero-meta-item">
                  <span className="num">
                    <Counter to={10} prefix="+" />
                  </span>
                  <span className="label" style={statExpertsLabel.style}>
                    {statExpertsLabel.text}
                  </span>
                </div>
                <div className="hero-meta-item">
                  <span className="num">
                    <Counter to={4.8} decimals={1} suffix="★" thousands={false} />
                  </span>
                  <span className="label" style={statRatingLabel.style}>
                    {statRatingLabel.text}
                  </span>
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
              range={16}
            />
            <div className="badge-floating badge-1">
              <div className="badge-icon">♡</div>
              <div className="badge-text">
                <div className="t1" style={badge1Title.style}>
                  {badge1Title.text}
                </div>
                <div className="t2" style={badge1Body.style}>
                  {badge1Body.text}
                </div>
              </div>
            </div>
            <div className="badge-floating badge-2">
              <div className="badge-icon">✦</div>
              <div className="badge-text">
                <div className="t1" style={badge2Title.style}>
                  {badge2Title.text}
                </div>
                <div className="t2" style={badge2Body.style}>
                  {badge2Body.text}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
