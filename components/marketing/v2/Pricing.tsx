import { Link } from "@/navigation";
import { TrackedLink } from "./TrackedLink";

/**
 * Pricing - 3-card transparent pricing section with featured middle card.
 * The middle card highlights "couples in one price" - both partners included
 * at no extra cost.
 */
export function Pricing() {
  return (
    <section className="pricing" id="pricing">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">המחירים שלנו</div>
          <h2>
            שקיפות מלאה.
            <br />
            בלי הפתעות, בלי התחייבות.
          </h2>
          <p>שלושה שירותים, שלוש דרכים להתחבר. בחרו מה שמתאים לכם - ועצרו בכל רגע שתרצו.</p>
        </div>

        <div className="pricing-grid">
          {/* Card 1: Online games - weekly */}
          <div className="price-card">
            <div className="price-tag">משחקי זוגיות אונליין</div>
            <div className="price-amount-wrap">
              <div className="price-amount">
                <span className="amount">9</span>
                <span className="currency">₪</span>
                <span className="period">/ שבוע</span>
              </div>
              <div className="price-original">
                ניתן לעצור בכל רגע · <s>₪87 למשחק בקופסה</s>
              </div>
            </div>
            <ul className="price-features">
              <li>גישה לכל המשחקים בפלטפורמה</li>
              <li>מגוון משחקים: גלגל הזוגיות, סולמות ונחשים זוגי, ועוד</li>
              <li>אפשר לשחק גם כשאתם רחוקים אחד מהשני</li>
              <li>3 רמות עומק לכל זוג</li>
              <li>ניתן לעצור בכל רגע</li>
            </ul>
            <div className="price-cta">
              <Link href="/pricing" className="btn btn-ghost">
                בחרו תוכנית <span className="arrow">←</span>
              </Link>
            </div>
          </div>

          {/* Card 2: Featured - couples coaching */}
          <div className="price-card price-card-featured">
            <span className="price-badge">המומלץ ביותר</span>
            <div className="price-tag">ליווי עם מיאושי</div>
            <div className="price-amount-wrap">
              <div className="price-amount">
                <span className="amount">57</span>
                <span className="currency">₪</span>
                <span className="period">/ שבוע</span>
              </div>
              <div className="price-original">
                במקום <s>₪114 לשבוע</s>
              </div>
            </div>
            <ul className="price-features">
              <li>
                <div className="price-feat-stack">
                  <strong>שניכם במחיר אחד</strong>
                  <span>זוגי לחלוטין</span>
                </div>
              </li>
              <li>
                <div className="price-feat-stack">
                  <strong>כולל הכל</strong>
                  <span>משחקי זוגיות אונליין + משחקים למבוגרים בלבד</span>
                </div>
              </li>
              <li>
                <div className="price-feat-stack">
                  <strong>אבחון אישי מכוון</strong>
                  <span>המומחים שלנו לומדים להכיר אתכם באופן ייחודי, מה שזוגות אחרים לא יקבלו</span>
                </div>
              </li>
              <li>
                <div className="price-feat-stack">
                  <strong>אזור אימון זוגי משותף</strong>
                  <span>סביבה שנבנית בדיוק עבורכם, מרחב אישי לשניכם</span>
                </div>
              </li>
              <li>המומחים שואלים את השאלות הקשות, אתם עונים - והם בונים עבורכם אסטרטגיית זוגיות אישית</li>
              <li>מענה אישי מהמומחים בצ&apos;אט פנימי</li>
            </ul>
            <div className="price-cta">
              <TrackedLink href="/pricing" className="btn btn-primary" ctaId="pricing_featured" section="pricing">
                התחילו עכשיו <span className="arrow">←</span>
              </TrackedLink>
            </div>
          </div>

          {/* Card 3: Adults - one-time */}
          <div className="price-card">
            <div className="price-tag">משחקים למבוגרים בלבד</div>
            <div className="price-amount-wrap">
              <div className="price-amount">
                <span className="amount">97</span>
                <span className="currency">₪</span>
                <span className="period">/ משחק</span>
              </div>
              <div className="price-original">
                רכישה בודדת · <s>₪200 למשחק</s>
              </div>
            </div>
            <ul className="price-features">
              <li>חוויה מודרכת - ננחה אתכם שלב אחר שלב</li>
              <li>משחקים מקוריים של מיאושי</li>
              <li>רכישה אחת - גישה חופשית לבן/ת הזוג</li>
              <li>חד-פעמי, בלי מנוי</li>
              <li>פרטיות מלאה</li>
            </ul>
            <div className="price-cta">
              <Link href="/adults" className="btn btn-ghost">
                בחרו משחק <span className="arrow">←</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="pricing-trust">
          <span>ניתן לעצור בכל רגע</span>
          <span>ללא דמי ביטול</span>
          <span>תשלום מאובטח</span>
          <span>פרטיות מלאה</span>
        </div>
      </div>
    </section>
  );
}
