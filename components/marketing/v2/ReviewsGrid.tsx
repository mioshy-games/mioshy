"use client";

import { useState } from "react";

type Review = {
  text: string;
  initial: string;
  name: string;
  source: string;
};

const REVIEWS: Review[] = [
  {
    text: "\"אז קניתי את 'שאלות שלא שאלנו' כמתנה ליום הנישואים שלנו, חצי בצחוק וחצי באמת. אחרי 11 שנה חשבתי שאני יודעת עליו הכל. טעיתי. גילינו דברים אחד על השני שלא ידענו וצחקנו עד 2 בלילה. וואו.\"",
    initial: "ש",
    name: "שירה לוי",
    source: "נשואים 11 שנים",
  },
  {
    text: '"תראו, הייתי בשלוש מטפלות בשנה האחרונה — כלום לא עזר. בייאוש ניסיתי את הליווי של מיאושי. בחודש הראשון כבר הרגשתי שמישהו סוף סוף שומע אותנו באמת. אנחנו עדיין יחד, והפעם זה אמיתי."',
    initial: "ד",
    name: "דניאל ק.",
    source: "נשואים 13 שנים",
  },
  {
    text: "\"אנחנו לקוחות 4 שנים. כל פעם שאני אומרת ליובל 'אולי נוריד את המנוי?' יוצא משהו חדש. ערכה חדשה, אתגר חדש, משחק שלא הכרנו. הם פשוט לא נותנים לנו להתעייף אחד מהשנייה. אחרי 16 שנה.\"",
    initial: "ר",
    name: "רוני ויובל",
    source: "בזוגיות 16 שנים",
  },
  {
    text: "\"אגיד את זה ככה — היום זו השיחה הקבועה של יום שני בערב אצלנו: 'מה המשימה הפעם?'. עידן רץ לפתוח את האפליקציה לפני. דבר שלא חשבתי שיכול לקרות אצלנו.\"",
    initial: "מ",
    name: "מיכל ועידן",
    source: "נשואים 8 שנים",
  },
  {
    text: '"לקחתי את בעלי למלון ליום הולדת, ופתאום הבנתי שאין לנו ממש תוכנית לערב. הורדתי משחק של מיאושי, וזה הציל את הסיטואציה. צחקנו, שתינו, ודיברנו על דברים שלא דיברנו עליהם בחיים. הוא עוד מדבר על הערב הזה."',
    initial: "ע",
    name: "עינת ברוך",
    source: "נשואה 9 שנים",
  },
  {
    text: '"ביום האהבה כל המסעדות היו מלאות, אז במקום לצאת — הורדנו משחק של מיאושי בבית. זה היה ערב הרבה יותר טוב מכל מסעדה שהיינו בה השנה. רצינית."',
    initial: "ט",
    name: "טל ועומרי",
    source: "בזוגיות 6 שנים",
  },
];

export function ReviewsGrid() {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className={`reviews-grid${expanded ? " expanded" : ""}`}>
        {REVIEWS.map((review, i) => (
          <div className="review-card" key={i}>
            <div className="review-stars">★★★★★</div>
            <p className="review-text">{review.text}</p>
            <div className="review-meta">
              <div className="review-avatar">{review.initial}</div>
              <div>
                <div className="review-name">{review.name}</div>
                <div className="review-source">{review.source}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!expanded && (
        <div className="reviews-load-more">
          <button type="button" onClick={() => setExpanded(true)}>
            טען עוד המלצות <span>↓</span>
          </button>
        </div>
      )}
    </>
  );
}
