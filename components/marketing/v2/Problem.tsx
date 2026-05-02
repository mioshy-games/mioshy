import { useTranslations } from "next-intl";

/**
 * Problem - second section. Two-column layout (image + text). Sets up the
 * emotional pain ("you forgot how to be a couple") with a 3-item checklist
 * of warning signs.
 */
export function Problem() {
  const t = useTranslations("homeV2.problem");
  return (
    <section className="problem" id="problem">
      <div className="container">
        <div className="problem-grid">
          <div className="problem-image">
            <picture>
              <source media="(max-width: 640px)" srcSet="/images/woman-w.webp" />
              <img
                src="/images/woman%20mioshy.webp"
                alt={t("imageAlt")}
                className="problem-img"
                loading="lazy"
              />
            </picture>
          </div>

          <div className="problem-text">
            <div className="eyebrow">{t("eyebrow")}</div>
            <h2>
              {t.rich("headline", { em: (chunks) => <em>{chunks}</em> })}
            </h2>
            <p className="lead">{t("lead")}</p>

            <div className="problem-list">
              <div className="problem-item">
                <span className="problem-num">01</span>
                <div>
                  <h3>{t("item1Title")}</h3>
                  <p>
                    {t.rich("item1Body", { br: () => <br /> })}
                  </p>
                </div>
              </div>
              <div className="problem-item">
                <span className="problem-num">02</span>
                <div>
                  <h3>{t("item2Title")}</h3>
                  <p>{t("item2Body")}</p>
                </div>
              </div>
              <div className="problem-item">
                <span className="problem-num">03</span>
                <div>
                  <h3>{t("item3Title")}</h3>
                  <p>{t("item3Body")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
