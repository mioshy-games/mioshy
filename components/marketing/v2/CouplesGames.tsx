import { Link } from "@/navigation";

/**
 * CouplesGames — energetic two-column section with text content on the right
 * (RTL) and a fanned stack of 3 game cards on the left.
 */
export function CouplesGames() {
  return (
    <section className="couples-games" id="couples-games">
      <div className="container">
        <div className="cg-grid">
          <div className="cg-text">
            <div className="eyebrow">המשחקים של מיאושי</div>
            <h2>
              המשחקים שכבר
              <br />
              <span className="text-mark">הטריפו</span> את המדינה.
            </h2>
            <p className="lead">
              רוצים להיפתח? להתחבר? להתגלות מחדש? אלפי זוגות בישראל כבר ממליצים — מהסלון, מהמיטה,
              ואפילו כשאחד מכם בחו&quot;ל. אתם הבאים בתור.
            </p>

            <div className="cg-callout">
              <p>
                &quot;תכניסו תשוקה. תתחברו מחדש. תתאהבו ותחזירו את הפרפרים — במיוחד למי שבזוגיות
                ארוכה עם ילדים, ומרגיש איך השחיקה עושה את שלה.&quot;
              </p>
            </div>

            <div className="cg-stats">
              <div className="cg-stat">
                <div className="num">+500</div>
                <div className="label">משימות ואתגרים</div>
              </div>
              <div className="cg-stat">
                <div className="num">+100</div>
                <div className="label">המלצות</div>
              </div>
              <div className="cg-stat">
                <div className="num">3 רמות</div>
                <div className="label">לכל זוג</div>
              </div>
            </div>

            <div className="cg-actions">
              <Link href="/games" className="btn btn-primary">
                לכל המשחקים <span className="arrow">←</span>
              </Link>
              <Link href="/how-it-works" className="btn btn-ghost">
                איך בוחרים?
              </Link>
            </div>
          </div>

          <div className="cg-visual">
            <div className="cg-card cg-card-3">
              <div className="cg-card-noise"></div>
              <div className="cg-card-content">
                <div className="cg-card-tag">קליל</div>
                <div className="cg-card-title">
                  50 שאלות
                  <br />
                  שלא שאלנו
                </div>
              </div>
            </div>
            <div className="cg-card cg-card-2">
              <div className="cg-card-noise"></div>
              <div className="cg-card-content">
                <div className="cg-card-tag">מעמיק</div>
                <div className="cg-card-title">
                  סיפור
                  <br />
                  החיים שלנו
                </div>
              </div>
            </div>
            <div className="cg-card cg-card-1">
              <div className="cg-card-noise"></div>
              <div className="cg-card-content">
                <div className="cg-card-tag">מסקרן</div>
                <div className="cg-card-title">
                  אמת או
                  <br />
                  אמת
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
