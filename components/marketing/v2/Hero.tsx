import { useTranslations } from "next-intl";
import { TrackedLink } from "./TrackedLink";
import { RevealOnScroll } from "./RevealOnScroll";
import { Counter } from "./Counter";
import { ParallaxImage } from "./ParallaxImage";

/**
 * Hero - first section of HomepageV2.
 * Dark animated background with 5 floating blobs, headline, lead paragraph,
 * primary + secondary CTAs, social-proof meta strip, and right-side image
 * with two floating badge cards.
 *
 * Animations:
 *  • Headline: scale-up reveal (94% → 100%) on first paint
 *  • Lead, CTAs, meta: fade-up reveal staggered
 *  • Stat numbers: count-up from 0 when in view
 *  • Hero image: subtle parallax on scroll (16px range)
 *  • Background blobs: CSS-driven (in styles.css), pause on reduced-motion
 */
export function Hero() {
  const t = useTranslations("homeV2.hero");
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
              <div className="hero-tag">
                <span className="dot"></span> {t("tag")}
              </div>
            </RevealOnScroll>

            <RevealOnScroll variant="scale-up" delay={0.05}>
              <h1>
                {t.rich("headline", { em: (chunks) => <em>{chunks}</em> })}
              </h1>
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.15}>
              <p className="lead">{t("lead")}</p>
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.25}>
              <div className="hero-actions">
                <TrackedLink href="/journey" className="btn btn-primary" ctaId="hero_primary" section="hero">
                  {t("ctaPrimary")} <span className="arrow">←</span>
                </TrackedLink>
              </div>
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.30}>
              <div className="hero-price-from" aria-label={t("priceFromLabel").replace(/<\/?strong>/g, "")}>
                <span className="dot" aria-hidden></span>
                <span>
                  {t.rich("priceFromLabel", {
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </span>
              </div>
            </RevealOnScroll>

            <RevealOnScroll variant="fade-up" delay={0.35}>
              <div className="hero-meta">
                <div className="hero-meta-item">
                  <span className="num">
                    <Counter to={1000} prefix="+" />
                  </span>
                  <span className="label">{t("statCouplesLabel")}</span>
                </div>
                <div className="hero-meta-item">
                  <span className="num">
                    <Counter to={10} prefix="+" />
                  </span>
                  <span className="label">{t("statExpertsLabel")}</span>
                </div>
                <div className="hero-meta-item">
                  <span className="num">
                    <Counter to={4.8} decimals={1} suffix="★" thousands={false} />
                  </span>
                  <span className="label">{t("statRatingLabel")}</span>
                </div>
              </div>
            </RevealOnScroll>
          </div>

          <div className="hero-visual">
            <ParallaxImage
              src="/images/hero.webp"
              alt={t("imageAlt")}
              width={720}
              height={900}
              className="hero-img"
              priority
              range={16}
            />
            <div className="badge-floating badge-1">
              <div className="badge-icon">♡</div>
              <div className="badge-text">
                <div className="t1">{t("badge1Title")}</div>
                <div className="t2">{t("badge1Body")}</div>
              </div>
            </div>
            <div className="badge-floating badge-2">
              <div className="badge-icon">✦</div>
              <div className="badge-text">
                <div className="t1">{t("badge2Title")}</div>
                <div className="t2">{t("badge2Body")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
