import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { TrackedLink } from "./TrackedLink";

/**
 * Pricing - 3-card transparent pricing section with featured middle card.
 * The middle card highlights "couples in one price" - both partners included
 * at no extra cost.
 */
export function Pricing() {
  const t = useTranslations("homeV2.pricing");
  return (
    <section className="pricing" id="pricing">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">{t("eyebrow")}</div>
          <h2>
            {t.rich("headline", { br: () => <br /> })}
          </h2>
          <p>{t("description")}</p>
        </div>

        <div className="pricing-grid">
          {/* Card 1: Online games - weekly */}
          <div className="price-card">
            <div className="price-tag">{t("card1Tag")}</div>
            <div className="price-amount-wrap">
              <div className="price-amount">
                <span className="amount">{t("card1Amount")}</span>
                <span className="currency">{t("card1Currency")}</span>
                <span className="period">{t("card1Period")}</span>
              </div>
              <div className="price-original">
                {t.rich("card1Original", {
                  s: (chunks) => <s>{chunks}</s>,
                })}
              </div>
            </div>
            <ul className="price-features">
              <li>{t("card1Feat1")}</li>
              <li>{t("card1Feat2")}</li>
              <li>{t("card1Feat3")}</li>
              <li>{t("card1Feat4")}</li>
              <li>{t("card1Feat5")}</li>
            </ul>
            <div className="price-cta">
              <Link href="/pricing" className="btn btn-ghost">
                {t("card1Cta")} <span className="arrow">←</span>
              </Link>
            </div>
          </div>

          {/* Card 2: Featured - couples coaching */}
          <div className="price-card price-card-featured">
            <span className="price-badge">{t("card2Badge")}</span>
            <div className="price-tag">{t("card2Tag")}</div>
            <div className="price-amount-wrap">
              <div className="price-amount">
                <span className="amount">{t("card2Amount")}</span>
                <span className="currency">{t("card2Currency")}</span>
                <span className="period">{t("card2Period")}</span>
              </div>
              <div className="price-original">
                {t.rich("card2Original", {
                  s: (chunks) => <s>{chunks}</s>,
                })}
              </div>
            </div>
            <ul className="price-features">
              <li>
                <div className="price-feat-stack">
                  <strong>{t("card2Feat1Title")}</strong>
                  <span>{t("card2Feat1Sub")}</span>
                </div>
              </li>
              <li>
                <div className="price-feat-stack">
                  <strong>{t("card2Feat2Title")}</strong>
                  <span>{t("card2Feat2Sub")}</span>
                </div>
              </li>
              <li>
                <div className="price-feat-stack">
                  <strong>{t("card2Feat3Title")}</strong>
                  <span>{t("card2Feat3Sub")}</span>
                </div>
              </li>
              <li>
                <div className="price-feat-stack">
                  <strong>{t("card2Feat4Title")}</strong>
                  <span>{t("card2Feat4Sub")}</span>
                </div>
              </li>
              <li>{t("card2Feat5")}</li>
              <li>{t("card2Feat6")}</li>
            </ul>
            <div className="price-cta">
              <TrackedLink href="/pricing" className="btn btn-primary" ctaId="pricing_featured" section="pricing">
                {t("card2Cta")} <span className="arrow">←</span>
              </TrackedLink>
            </div>
          </div>

          {/* Card 3: Adults - one-time */}
          <div className="price-card">
            <div className="price-tag">{t("card3Tag")}</div>
            <div className="price-amount-wrap">
              <div className="price-amount">
                <span className="amount">{t("card3Amount")}</span>
                <span className="currency">{t("card3Currency")}</span>
                <span className="period">{t("card3Period")}</span>
              </div>
              <div className="price-original">
                {t.rich("card3Original", {
                  s: (chunks) => <s>{chunks}</s>,
                })}
              </div>
            </div>
            <ul className="price-features">
              <li>{t("card3Feat1")}</li>
              <li>{t("card3Feat2")}</li>
              <li>{t("card3Feat3")}</li>
              <li>{t("card3Feat4")}</li>
              <li>{t("card3Feat5")}</li>
            </ul>
            <div className="price-cta">
              <Link href="/adults" className="btn btn-ghost">
                {t("card3Cta")} <span className="arrow">←</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="pricing-trust">
          <span>{t("trust1")}</span>
          <span>{t("trust2")}</span>
          <span>{t("trust3")}</span>
          <span>{t("trust4")}</span>
        </div>
      </div>
    </section>
  );
}
