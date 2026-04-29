import { Link } from "@/navigation";
import { TrackedLink } from "./TrackedLink";

/**
 * FinalCTA — closing section with animated background blobs, dramatic
 * headline, and two-column choice grid (online vs adults).
 */
export function FinalCTA() {
  return (
    <section className="final" id="start">
      <div className="final-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>
      <div className="container">
        <div className="eyebrow" style={{ justifyContent: "center", display: "flex" }}>
          הצעד הראשון
        </div>
        <h2 className="display">
          תרגישו קרובים שוב.
          <br />
          זה מתחיל הערב.
        </h2>
        <p>מצטרפים לאלפי זוגות שכבר עשו את הצעד הראשון. בחרו איך להתחיל:</p>

        <div className="final-choice-grid">
          <div className="final-choice final-choice-featured">
            <span className="final-choice-tag">הכי פופולרי</span>
            <h3>משחקי זוגיות אונליין</h3>
            <p>
              לשבור את הקרח, להנות מערב מהנה יחד. שאלות, אתגרים ומשחקים שיוצרים שיחה אמיתית —
              מהסלון, בלי הכנה.
            </p>
            <TrackedLink href="/journey" className="btn btn-primary" ctaId="final_primary" section="final">
              התחילו עכשיו <span className="arrow">←</span>
            </TrackedLink>
          </div>

          <div className="final-choice">
            <span className="final-choice-tag">למבוגרים בלבד</span>
            <h3>משחקים להרפתקנים</h3>
            <p>
              למי שמוכן ואוהב לשבור את השגרה — גם בסקס. משחקים נועזים שעיצבנו עבור הזוגות הכי
              הרפתקניים שלנו.
            </p>
            <TrackedLink href="/adults" className="btn btn-ghost" ctaId="final_secondary" section="final">
              גלו את המשחקים <span className="arrow">←</span>
            </TrackedLink>
          </div>
        </div>

        <div className="final-trust">
          <span>ללא מחויבות</span>
          <span>פרטיות מלאה</span>
          <span>ביטול בכל עת</span>
        </div>
      </div>
    </section>
  );
}
