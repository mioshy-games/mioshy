import { TrackedLink } from "./TrackedLink";

type Persona = {
  icon: string;
  title: string;
  desc: string;
  linkLabel: string;
  href: string;
};

const PERSONAS: Persona[] = [
  {
    icon: "✦",
    title: "רוצים להחזיר את הניצוץ",
    desc: "השגרה השתלטה ואתם מתגעגעים למבטים של פעם, לרצון להיות יחד, לחיוך הספונטני.",
    linkLabel: "המסע הזוגי המודרך",
    href: "#journey",
  },
  {
    icon: "⌛",
    title: "רוצים זמן זוגי באמת",
    desc: "הילדים, העבודה, הבית - והזוגיות נשארה אחרונה. אתם רוצים להחזיר אותה לראש הסדר.",
    linkLabel: "ליווי חודשי גמיש",
    href: "#journey",
  },
  {
    icon: "◆",
    title: "מחפשים מומחה שיעזור",
    desc: "הייתם אצל מטפלת. עזר באופן חלקי. אתם מחפשים משהו אחר - חוויתי, פחות כבד, יותר ביחד.",
    linkLabel: "ליווי עם המומחים שלנו",
    href: "#journey",
  },
  {
    icon: "↻",
    title: "רוצים להתחבר מחדש",
    desc: "הקשר טוב. אתם רק רוצים להעלות הילוך - חוויות חדשות, שיחות חדשות, אינטימיות חדשה.",
    linkLabel: "משחקי חיבור ותקשורת",
    href: "#couples-games",
  },
  {
    icon: "★",
    title: "מחפשים בילוי אינטימי מהנה",
    desc: "אתם רוצים להחליף את הסדרה בנטפליקס בערב מהנה ומחבר באמת. בלי הכנה, בלי לחץ.",
    linkLabel: "משחקים אונליין",
    href: "#couples-games",
  },
  {
    icon: "♨",
    title: "רוצים לפלפל את חיי המין",
    desc: "אתם מוכנים לקצת הרפתקנות - להחזיר את התשוקה, לגלות צד חדש, לפתח את האינטימיות.",
    linkLabel: "משחקים למבוגרים בלבד",
    href: "#adult-games",
  },
];

/**
 * ForWhom - 6 personas grid. Each card is a clickable link to the matching
 * service section. CTA banner below points to the assessment quiz.
 */
export function ForWhom() {
  return (
    <section className="for-whom" id="for-whom">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">למי זה מתאים</div>
          <h2>
            אם אתם מזהים את עצמכם
            <br />
            באחד מאלה - מיאושי{" "}
            <em
              style={{
                fontFamily: "'Frank Ruhl Libre', serif",
                color: "var(--accent)",
                fontStyle: "italic",
              }}
            >
              בשבילכם.
            </em>
          </h2>
          <p>
            הליווי של מיאושי לא לכולם. הוא למי שמוכן לבחור בזוגיות אחרת.
          </p>
        </div>

        <div className="personas-grid">
          {PERSONAS.map((p) => (
            <a key={p.title} href={p.href} className="persona">
              <div className="persona-icon">{p.icon}</div>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
              <span className="persona-link">
                {p.linkLabel} <span>←</span>
              </span>
            </a>
          ))}
        </div>

        <div className="for-whom-cta">
          <div className="for-whom-cta-text">
            <span className="small">בחינם · 90 שניות · בלי הרשמה</span>
            <span className="big">
              בואו גלו על הזוגיות שלכם דברים שלא ידעתם - חינם לגמרי.
            </span>
          </div>
          <TrackedLink href="/journey/assessment" className="btn btn-primary" ctaId="for_whom_assessment" section="for-whom">
            בואו לגלות מה קורה בזוגיות שלכם <span className="arrow">←</span>
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}
