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
              {/* Wrap line 2 ("אותה תוצאה.") in a non-breaking span so
                  the italic-serif <em> doesn't push "תוצאה" onto its
                  own line on mobile. With this, the heading reliably
                  reads as two lines: "5 שנים. 500+ זוגות." then
                  "אותה תוצאה." */}
              <span style={{ whiteSpace: "nowrap" }}>
                {t("headlinePart2")}
                {/* `display:"inline"` overrides the global
                    `h1 em, h2 em { display: block }` rule in styles.css.
                    Without this, the <em> forces "תוצאה" onto its own
                    line and the trailing "." into a 3rd line — even with
                    whiteSpace:nowrap on the wrapping span, because the
                    block-level child breaks inline flow. We keep the
                    nowrap as a safety belt for narrow viewports. */}
                <em
                  style={{
                    color: "var(--accent)",
                    fontStyle: "italic",
                    fontFamily: "'Frank Ruhl Libre', serif",
                    display: "inline",
                  }}
                >
                  {t("headlineEm")}
                </em>
                {t("headlinePart3")}
              </span>
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
                  <Counter to={500} prefix="+" />
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
