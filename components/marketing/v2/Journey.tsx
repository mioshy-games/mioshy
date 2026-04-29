import { Link } from "@/navigation";

type Stage = {
  num: string;
  title: string;
  description: string;
  bullets: string[];
};

const STAGES: Stage[] = [
  {
    num: "01",
    title: "היכרות מחדש",
    description: "אבחון אישי קצר, שאלות שלא שאלתם — ופתאום אתם מתחילים לדבר על מה שבאמת חשוב.",
    bullets: ["אבחון מותאם", "תוכנית אישית", "שאלות פתיחה"],
  },
  {
    num: "02",
    title: "שבירת השעמום המיני",
    description:
      "משימות, אתגרים וחוויות חדשות — ופתאום אתם זוכרים בדיוק למה התאהבתם פעם. גם בחדר השינה.",
    bullets: ["משימות שבועיות", "אתגרים זוגיים", "חוויות חדשות"],
  },
  {
    num: "03",
    title: "חיבור עמוק",
    description:
      "האינטימיות חוזרת. השיחות מעמיקות. אתם שוב חברים לדרך — ומתחברים גם בחדר השינה.",
    bullets: ["קרבה רגשית", "אינטימיות אמיתית", "שיחות עומק"],
  },
  {
    num: "04",
    title: "התחדשות שלא נגמרת",
    description: "אנחנו ממשיכים אתכם כל עוד תרצו. כי זוגיות בריאה — היא משהו שמתחדש כל יום.",
    bullets: ["הרגלים חדשים", "תוכן מתעדכן", "קהילת זוגות"],
  },
];

/**
 * Journey — editorial timeline of 4 stages. Connecting hairline line through
 * all 4 numbers, each stage with its own checklist of features. Closing CTA
 * banner at the bottom.
 */
export function Journey() {
  return (
    <section className="journey" id="journey">
      <div className="container">
        <div className="section-head journey-head">
          <div className="eyebrow">ליווי חודשי · ללא התחייבות</div>
          <h2>
            כל חודש שעובר —
            <br />
            הזוגיות שלכם <em>מתחזקת.</em>
          </h2>
          <p>
            אנחנו אתכם חודש בחודש, עובדים ושרים את הזוגיות יחד. ללא התחייבות, ללא חוזה ארוך טווח.
            ניתן לעצור בכל רגע. ככה זה נראה בפועל.
          </p>
        </div>

        <div className="journey-timeline">
          <div className="journey-line"></div>
          <div className="journey-stages">
            {STAGES.map((stage) => (
              <div className="journey-stage" key={stage.num}>
                <div className="journey-num-wrap">
                  <div className="journey-num">
                    {stage.num}
                    <span className="dot">.</span>
                  </div>
                </div>
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
                <ul className="journey-list">
                  {stage.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="journey-cta">
          <div className="journey-cta-text">מוכנים להתחיל? אפשר לעצור בכל רגע.</div>
          <Link href="/journey/assessment" className="btn btn-primary">
            התחילו את האבחון <span className="arrow">←</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
