import { useTranslations } from "next-intl";
import { Counter } from "./Counter";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Education - "Why this happens". Light cream section with two-column flow:
 * narrative on the right, 4 dramatic stats on the left.
 */
export function Education() {
  const t = useTranslations("homeV2.education");
  return (
    <section className="education">
      <div className="edu-orb"></div>
      <div className="edu-particles">
        <span className="edu-particle"></span>
        <span className="edu-particle"></span>
        <span className="edu-particle"></span>
        <span className="edu-particle"></span>
        <span className="edu-particle"></span>
      </div>
      <div className="container">
        <div className="edu-grid">
          <RevealOnScroll variant="fade-up">
            <div>
              <div className="eyebrow">{t("eyebrow")}</div>
              <h2>
                {t.rich("headline", { br: () => <br /> })}
              </h2>
              <p>
                {t.rich("body", {
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
            </div>
          </RevealOnScroll>
          <RevealOnScroll variant="fade-up" delay={0.15}>
            <div>
              <div className="edu-stat-grid">
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      <Counter to={67} suffix={t("stat1Suffix")} />
                    </em>
                  </div>
                  <div className="label">{t("stat1Label")}</div>
                </div>
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      <Counter to={3} suffix={t("stat2Suffix")} />
                    </em>
                  </div>
                  <div className="label">{t("stat2Label")}</div>
                </div>
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      {t("stat3Prefix")}<Counter to={4} />
                    </em>
                  </div>
                  <div className="label">{t("stat3Label")}</div>
                </div>
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      <Counter to={30} suffix={t("stat4Suffix")} />
                    </em>
                  </div>
                  <div className="label">{t("stat4Label")}</div>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
