import { ReviewsGrid } from "./ReviewsGrid";
import { Counter } from "./Counter";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Authority — third section. "5 שנים. אלפי זוגות." narrative + stat banner +
 * 6-card reviews grid (with mobile load-more behavior in ReviewsGrid).
 */
export function Authority() {
  return (
    <section className="authority" id="reviews">
      <div className="container">
        <RevealOnScroll variant="scale-up">
          <div className="section-head">
            <div className="eyebrow">מאז 2021</div>
            <h2>
              5 שנים. אלפי זוגות.
              <br />
              אותה{" "}
              <em
                style={{
                  color: "var(--accent)",
                  fontStyle: "italic",
                  fontFamily: "'Frank Ruhl Libre', serif",
                }}
              >
                תוצאה
              </em>
              .
            </h2>
          </div>
        </RevealOnScroll>

        <RevealOnScroll variant="fade-up" delay={0.1}>
          <div className="auth-narrative">
            <p>
              מאז 2021 אנחנו מלווים זוגות. <strong>שמענו אלפי סיפורים</strong> — ראינו זוגות צוחקים,
              בוכים, מתפייסים, חוזרים אחד אל השנייה. כל מה שאנחנו עושים — נולד מהם. מהשיחות,
              מהמשובים, מהדמעות, מהחיוכים. זאת הסיבה שמיאושי לא נשאר אותו דבר. הוא משתנה, גדל,
              מתחדש. <strong>בדיוק כמו זוגיות בריאה.</strong>
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
              <div className="label">זוגות פעילים</div>
            </div>
            <div className="auth-divider"></div>
            <div className="auth-stat">
              <div className="num">מאז 2021</div>
              <div className="label">בישראל וברחבי העולם</div>
            </div>
            <div className="auth-divider"></div>
            <div className="auth-stat">
              <div className="num">
                <Counter to={4.8} decimals={1} thousands={false} /> / 5
              </div>
              <div className="label">דירוג ממוצע</div>
            </div>
            <div className="auth-divider"></div>
            <div className="auth-stat">
              <div className="num">
                <em>
                  <Counter to={94} suffix="%" />
                </em>
              </div>
              <div className="label">מדווחים על שיפור</div>
            </div>
          </div>
        </RevealOnScroll>

        <ReviewsGrid />
      </div>
    </section>
  );
}
