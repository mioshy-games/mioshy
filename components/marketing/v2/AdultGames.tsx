// Side-effect import: ensures the v2 scoped styles are loaded whenever
// AdultGames is rendered, even on pages that don't import HomepageV2.
// Safe because CSS imports are de-duplicated by Next.js.
import "./styles.css";
import { Link } from "@/navigation";

/**
 * AdultGames - "החדר הסגור". Premium private-chamber section with midnight
 * wine + bronze palette, 3 manifesto pillars, signature whisper, and dramatic
 * closer CTA.
 */
export function AdultGames() {
  return (
    <section className="adult-games" id="adult-games">
      <span className="ag-aura ag-aura-1" aria-hidden="true"></span>
      <span className="ag-aura ag-aura-2" aria-hidden="true"></span>

      <div className="ag-frame">
        <div className="ag-stage">
          <div className="ag-pills">
            <span className="ag-pill">18+</span>
            <span className="ag-pill">למבוגרים בלבד</span>
            <span className="ag-pill">פרטיות מוחלטת</span>
          </div>

          <span className="ag-eyebrow">- החדר הסגור -</span>

          <h2>
            לא לכל אחד.
            <br />
            <em>לאמיצים בלבד.</em>
          </h2>

          <p className="ag-lead">
            אוסף משחקי זוגיות שכתבו <strong>הבכירים בעולם</strong> בתחומי האינטימיות, הסקסולוגיה
            והטיפול הזוגי - ועוצבו במדויק לחדר המיטות שלכם. לא טיפים מהאינטרנט, לא רשימות גנריות.
            חוויות שלמות, מובְנות, מהוקצעות.{" "}
            <strong>לאמיצים. למתפנקים. לזוגות שמוכנים לגלות מה עוד אפשר להיות.</strong>
          </p>

          <div className="ag-pillars">
            <article className="ag-pillar">
              <span className="ag-pillar-num">I</span>
              <h4>נכתב על־ידי מומחים</h4>
              <p>סקסולוגים בכירים, מטפלים זוגיים מהאקדמיה, וחוקרי אינטימיות.</p>
            </article>
            <article className="ag-pillar">
              <span className="ag-pillar-num">II</span>
              <h4>עוצב לחדר המיטות</h4>
              <p>
                לא טיפים, לא רשימות. כל משחק הוא חוויה שלמה - עם התחלה, מתח שנבנה, ושיא שתזכרו.
              </p>
            </article>
            <article className="ag-pillar">
              <span className="ag-pillar-num">III</span>
              <h4>רק לכם. רק יחד.</h4>
              <p>
                פרטיות מוחלטת, ללא שיתוף נתונים, ללא היסטוריה. רכישה אחת - ושניכם בפנים, לכל החיים.
              </p>
            </article>
          </div>

          <div className="ag-signature">
            <span className="ag-signature-line" aria-hidden="true"></span>
            <em>משחקי מין לאמיצים בלבד.</em>
            <span className="ag-signature-line" aria-hidden="true"></span>
          </div>

          <div className="ag-closer">
            <h3 className="ag-closer-statement">
              אולי הגיע הזמן
              <br />
              <em>לדבר אחרת.</em>
            </h3>
            <Link href="/adults" className="ag-closer-cta">
              כניסה לחדר הסגור
            </Link>
            <div className="ag-closer-trust">
              <span>כניסה לבני 18+</span>
              <span>מאומת על־ידי מומחים</span>
              <span>פרטיות מוחלטת</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
