import { useTranslations } from "next-intl";
import { ReviewsGrid } from "./ReviewsGrid";
import { Counter } from "./Counter";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Authority - third section. "5 years. Thousands of couples." narrative + stat banner +
 * 6-card reviews grid (with mobile load-more behavior in ReviewsGrid).
 */
export function Authority() {
  const t = useTranslations("homeV2.authority");
  return (
    <section className="authority" id="reviews">
      <div className="container">
        <RevealOnScroll variant="scale-up">
          <div className="section-head">
            <div className="eyebrow">{t("eyebrow")}</div>
            <h2>
              {t("headlinePart1")}
              <br />
              {t("headlinePart2")}
              <em
                style={{
                  color: "var(--accent)",
                  fontStyle: "italic",
                  fontFamily: "'Frank Ruhl Libre', serif",
                }}
              >
                {t("headlineEm")}
              </em>
              {t("headlinePart3")}
            </h2>
          </div>
        </RevealOnScroll>

        <RevealOnScroll variant="fade-up" delay={0.1}>
          <div className="auth-narrative">
            <p>
              {t.rich("narrative", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll variant="fade-up" delay={0.15}>
          <div className="auth-banner">
            <div className="auth-stat">
              <div className="num">
                <em>
                  <Counter to={1000} prefix="+" />
                </em>
              </div>
              <div className="label">{t("statCouplesLabel")}</div>
            </div>
            <div className="auth-divider"></div>
            <div className="auth-stat">
              <div className="num">{t("since")}</div>
              <div className="label">{t("sinceLabel")}</div>
            </div>
            <div className="auth-divider"></div>
            <div className="auth-stat">
              <div className="num">
                <Counter to={4.8} decimals={1} thousands={false} /> / 5
              </div>
              <div className="label">{t("ratingLabel")}</div>
            </div>
            <div className="auth-divider"></div>
            <div className="auth-stat">
              <div className="num">
                <em>
                  <Counter to={94} suffix="%" />
                </em>
              </div>
              <div className="label">{t("improvementLabel")}</div>
            </div>
          </div>
        </RevealOnScroll>

        <ReviewsGrid />
      </div>
    </section>
  );
}
