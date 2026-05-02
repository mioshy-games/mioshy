import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { ParallaxImage } from "./ParallaxImage";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Founder - Itzik Berlev section. Two-column layout with photo + floating
 * badge on the left, full bio + CTAs on the right.
 */
export function Founder() {
  const t = useTranslations("homeV2.founder");
  return (
    <section className="founder" id="about">
      <div className="container">
        <div className="founder-grid">
          <div className="founder-image">
            <ParallaxImage
              src="/images/itzik-barlev.webp"
              alt={t("imageAlt")}
              width={600}
              height={750}
              className="founder-img"
              range={14}
            />
            <div className="founder-badge">
              <div className="founder-badge-icon">{t("badgeIcon")}</div>
              <div className="founder-badge-text">
                <div className="t1">{t("badgeTitle")}</div>
                <div className="t2">{t("badgeName")}</div>
              </div>
            </div>
          </div>

          <RevealOnScroll variant="fade-up" delay={0.1} className="founder-content">
            <div className="eyebrow">{t("eyebrow")}</div>
            <h2>
              {t.rich("headline", {
                em: (chunks) => <em>{chunks}</em>,
                br: () => <br />,
              })}
            </h2>
            <p className="lead">
              {t.rich("lead", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>

            <div className="founder-bio">
              <div className="bio-item">
                <div className="bio-item-label">{t("bioRoleLabel")}</div>
                <div className="bio-item-value">{t("bioRoleValue")}</div>
              </div>
              <div className="bio-item">
                <div className="bio-item-label">{t("bioExpertiseLabel")}</div>
                <div className="bio-item-value">{t("bioExpertiseValue")}</div>
              </div>
              <div className="bio-item">
                <div className="bio-item-label">{t("bioLifeLabel")}</div>
                <div className="bio-item-value">{t("bioLifeValue")}</div>
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
                {t("cta")} <span className="arrow">←</span>
              </Link>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
