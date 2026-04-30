/**
 * Problem - second section. Two-column layout (image + text). Sets up the
 * emotional pain ("you forgot how to be a couple") with a 3-item checklist
 * of warning signs.
 */
export function Problem() {
  return (
    <section className="problem" id="problem">
      <div className="container">
        <div className="problem-grid">
          <div className="problem-image">
            <picture>
              <source media="(max-width: 640px)" srcSet="/images/woman-w.webp" />
              <img
                src="/images/woman%20mioshy.webp"
                alt="אישה בריחוק רגשי בסלון - רגע של שגרה ועייפות"
                className="problem-img"
                loading="lazy"
              />
            </picture>
          </div>

          <div className="problem-text">
            <div className="eyebrow">המציאות שאף אחד לא מדבר עליה</div>
            <h2>
              אתם לא שבורים. פשוט שכחתם <em>להיות זוג.</em>
            </h2>
            <p className="lead">
              הנה 3 הסימנים שכדאי לזהות בזמן, ולהצית מחדש את הזוגיות.
            </p>

            <div className="problem-list">
              <div className="problem-item">
                <span className="problem-num">01</span>
                <div>
                  <h3>השיחות הפכו לרשימת מטלות</h3>
                  <p>
                    מתי בפעם האחרונה יצרתם חיבור אינטימי באמצעות שיחה?
                    <br />
                    על מה שאתם חולמים, חושקים, רוצים יותר?
                  </p>
                </div>
              </div>
              <div className="problem-item">
                <span className="problem-num">02</span>
                <div>
                  <h3>פעם זה היה אש. היום זה מתוזמן.</h3>
                  <p>
                    פעם זה היה מלא תשוקה. היום אנחנו גדושים במשימות ומטלות.
                  </p>
                </div>
              </div>
              <div className="problem-item">
                <span className="problem-num">03</span>
                <div>
                  <h3>הרצון קיים - אבל השגרה מנצחת.</h3>
                  <p>
                    המחויבויות גברו, אבל הגעגוע נשאר. מתי בפעם האחרונה בחרתם בזוגיות - ולא רק תחזקתם אותה?
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
