import { Link } from "@/navigation";
import { ParallaxImage } from "./ParallaxImage";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Founder — Itzik Berlev section. Two-column layout with photo + floating
 * badge on the left, full bio + CTAs on the right.
 */
export function Founder() {
  return (
    <section className="founder" id="about">
      <div className="container">
        <div className="founder-grid">
          <div className="founder-image">
            <ParallaxImage
              src="/images/itzik-barlev.webp"
              alt="איציק ברלב — מייסד מיאושי"
              width={600}
              height={750}
              className="founder-img"
              range={14}
            />
            <div className="founder-badge">
              <div className="founder-badge-icon">א</div>
              <div className="founder-badge-text">
                <div className="t1">מייסד מיאושי</div>
                <div className="t2">איציק ברלב</div>
              </div>
            </div>
          </div>

          <RevealOnScroll variant="fade-up" delay={0.1} className="founder-content">
            <div className="eyebrow">הכירו את המייסד · איציק ברלב</div>
            <h2>
              שינה את הזוגיות של אלפי זוגות.
              <br />
              <em>בעזרת משחק.</em>
            </h2>
            <p className="lead">
              המומחה לזוגיות שעומד מאחורי מיאושי — והמלווה שלכם בכל צעד. במשך שנים, איציק שינה את
              עולם הזוגיות עבור אלפי זוגות בישראל ובעולם — דרך משחקים, תקשורת אינטימית, ופשוט עוד דרך
              לדבר. החזון שלו אחד וברור: <strong>לשבור את השגרה. להחזיר את הקרבה.</strong>
            </p>

            <div className="founder-bio">
              <div className="bio-item">
                <div className="bio-item-label">תפקיד</div>
                <div className="bio-item-value">מייסד מיאושי</div>
              </div>
              <div className="bio-item">
                <div className="bio-item-label">מומחיות</div>
                <div className="bio-item-value">זוגיות ואינטימיות</div>
              </div>
              <div className="bio-item">
                <div className="bio-item-label">בחיים האמיתיים</div>
                <div className="bio-item-value">נשוי, אבא ל-3</div>
              </div>
            </div>

            {/* Single CTA — was a primary + ghost pair, but the ghost was
                "המומחים שלנו" which over-promised: today the entire
                methodology is Itzik's. Adding a fake-team affordance would
                erode trust the moment a visitor clicked through. We can
                bring it back when there are actual additional experts on
                the masthead. */}
            <div className="founder-actions">
              <Link href="/about/founder" className="btn btn-primary">
                קראו את הסיפור המלא <span className="arrow">←</span>
              </Link>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
