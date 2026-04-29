/**
 * Problem — second section. Two-column layout (image + text). Sets up the
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
                alt="אישה בריחוק רגשי בסלון — רגע של שגרה ועייפות"
                className="problem-img"
                loading="lazy"
              />
            </picture>
          </div>

          <div className="problem-text">
            <div className="eyebrow">המציאות שאף אחד לא מדבר עליה</div>
            <h2>
              אתם לא שבורים.
              <br />
              פשוט שכחתם <em>להיות זוג.</em>
            </h2>
            <p className="lead">
              השגרה לא נכנסה ביום אחד — ויתור אחר ויתור. הנה 3 הסימנים שכדאי לזהות בזמן, ולעצור.
            </p>

            <div className="problem-list">
              <div className="problem-item">
                <span className="problem-num">01</span>
                <div>
                  <h3>השיחות הפכו לרשימת מטלות</h3>
                  <p>
                    &quot;מי לוקח את הילדים?&quot;, &quot;תזכרי לקנות חלב&quot;. מתי בפעם האחרונה
                    דיברתם על מה שבאמת מגרה אתכם — על מה שאתם חולמים, חושקים, רוצים יותר?
                  </p>
                </div>
              </div>
              <div className="problem-item">
                <span className="problem-num">02</span>
                <div>
                  <h3>פעם זה היה אש. היום זה מתוזמן.</h3>
                  <p>
                    פעם זה היה מלא תשוקה. היום זה מתערבב עם עייפות, חזרתיות וחיים. מתי בפעם האחרונה
                    שמתם את זה על השולחן — באמת דיברתם על מה שאתם רוצים?
                  </p>
                </div>
              </div>
              <div className="problem-item">
                <span className="problem-num">03</span>
                <div>
                  <h3>השגרה משתיקה. הרצון לא נעלם.</h3>
                  <p>
                    המחויבויות גברו. הרצון, הצורך, הגעגוע — נשארו בשיאם. מתי בפעם האחרונה השקעתם
                    בעצמכם, לא ויתרתם, ובחרתם לקחת אחריות לשנות?
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
