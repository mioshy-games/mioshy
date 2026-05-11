import { useTranslations } from "next-intl";
import { TrackedLink } from "./TrackedLink";

/**
 * FinalCTA - closing section with animated background blobs, dramatic
 * headline, and two-column choice grid (online vs adults).
 */
export function FinalCTA() {
  const t = useTranslations("homeV2.finalCta");
  return (
    <section className="final" id="start">
      <div className="final-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>
      <div className="container">
        <div className="eyebrow" style={{ justifyContent: "center", display: "flex" }}>
          {t("eyebrow")}
        </div>
        <h2 className="display">
          {t.rich("headline", { br: () => <br /> })}
        </h2>
        <p>{t("description")}</p>

        <div className="final-choice-grid">
          <div className="final-choice final-choice-featured">
            <span className="final-choice-tag">{t("choice1Tag")}</span>
            <h3>{t("choice1Title")}</h3>
            <p>{t("choice1Body")}</p>
            <TrackedLink href="/journey" className="btn btn-primary" ctaId="final_primary" section="final">
              {t("choice1Cta")} <span className="arrow">←</span>
            </TrackedLink>
          </div>

          <div className="final-choice">
            <span className="final-choice-tag">{t("choice2Tag")}</span>
            <h3>{t("choice2Title")}</h3>
            <p>{t("choice2Body")}</p>
            <TrackedLink href="/mioshy-sex" className="btn btn-ghost" ctaId="final_secondary" section="final">
              {t("choice2Cta")} <span className="arrow">←</span>
            </TrackedLink>
          </div>
        </div>

        <div className="final-trust">
          <span>{t("trust1")}</span>
          <span>{t("trust2")}</span>
          <span>{t("trust3")}</span>
        </div>
      </div>
    </section>
  );
}
