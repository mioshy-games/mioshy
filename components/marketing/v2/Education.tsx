import { Counter } from "./Counter";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Education - "למה זה קורה". Light cream section with two-column flow:
 * narrative on the right, 4 dramatic stats on the left.
 */
export function Education() {
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
              <div className="eyebrow">למה זה קורה</div>
              <h2>
                זוגיות לא נשברת בלילה אחד.
                <br />
                היא נשחקת לאט.
              </h2>
              <p>
                שגרה, ילדים, קריירה, עייפות - הם לא רעים. הם פשוט{" "}
                <strong>דוחקים את הזוגיות לפינה</strong>. וביום שבו אתם מבינים שאתם זרים, השחיקה
                כבר נעשתה לפני שנים.
              </p>
            </div>
          </RevealOnScroll>
          <RevealOnScroll variant="fade-up" delay={0.15}>
            <div>
              <div className="edu-stat-grid">
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      <Counter to={67} suffix="%" />
                    </em>
                  </div>
                  <div className="label">מהזוגות מדווחים על ירידה בקרבה הרגשית אחרי 5 שנים</div>
                </div>
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      <Counter to={3} suffix=" דק׳" />
                    </em>
                  </div>
                  <div className="label">
                    מספיקות ביום כדי לשנות את הדינמיקה - אם משקיעים נכון
                  </div>
                </div>
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      ×<Counter to={4} />
                    </em>
                  </div>
                  <div className="label">
                    שיפור בשביעות רצון אצל זוגות שעוסקים בקשר באופן יזום
                  </div>
                </div>
                <div className="edu-stat">
                  <div className="num">
                    <em>
                      <Counter to={30} suffix=" יום" />
                    </em>
                  </div>
                  <div className="label">
                    הזמן הממוצע שלוקח לזוגות אצלנו להרגיש שינוי אמיתי
                  </div>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
