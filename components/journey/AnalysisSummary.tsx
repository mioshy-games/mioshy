"use client";

import { useState } from "react";
import type { Analysis, Locale } from "@/lib/journey/types";
import type { CadenceOption } from "@/lib/billing/pricing-validations";

/**
 * Active journey marketing-promo summary, computed SERVER-SIDE (the promo
 * lookup + discount math are server-only). For each enabled cadence it carries
 * the discounted FIRST-charge price and the full (pre-discount) price, per
 * currency — derived via the same applyDiscount the checkout uses, so the
 * banner shows exactly what Cardcom will charge. null when no journey promo is
 * active. See app/[locale]/journey/assessment/page.tsx and lib/billing/promos.
 *
 * Kept exported — app/[locale]/journey/assessment/page.tsx imports this type.
 */
export type JourneyPromoSummary = {
  name: string;
  displayText: string | null;
  firstChargeByCadence: Record<string, { ils: number; usd: number }>;
  originalByCadence: Record<string, { ils: number; usd: number }>;
};

interface AnalysisSummaryProps {
  analysis: Analysis | null;
  locale: Locale;
  /** F3.3 — true when the user holds a journey subscription/entitlement. Gates
   *  the pre-purchase selling sections. Wired in Phase 3. */
  journeySubscribed?: boolean;
  /** Enabled cadences + prices (server-injected). Wired in Phase 3. */
  journeyCadences?: CadenceOption[];
  /** Active journey promo (server-computed). Wired in Phase 3. */
  activePromo?: JourneyPromoSummary | null;
}

/**
 * AnalysisSummary — short-assessment results / pre-purchase paywall
 * (route /journey/assessment, journeys.status='paywall').
 *
 * ── REDESIGN IN PROGRESS (mockup docs/assessment-results-mockup-v13.html) ──
 * Phase 1 (this commit): structure + skin, STATIC content, MOBILE only.
 *   • Faithful port of the approved mockup via scoped styled-jsx.
 *   • Content is hardcoded placeholder (the mockup's Hebrew example values).
 *   • Phase 2 adds the desktop @media (breakpoint 760).
 *   • Phase 3 wires the dynamic data (AI hero/narrative, the 5 category
 *     scores + feedback, prices/cadences/promo, JourneyCheckoutButton) using
 *     the props above — see the data map in the redesign brief.
 *   • Phase 4 validates displayed price == Cardcom charge.
 * The props are intentionally not yet consumed (Phase 3). The loading guard
 * on `analysis` is preserved so the flow still shows a wait state.
 */

// Brand gradient (purple → magenta → orange) is defined once as the CSS
// custom property --ar-grad on .ar-root (see styled-jsx below), so both the
// class-driven rules and the inline bar styles reference var(--ar-grad).

// Static placeholder data (Phase 1). Replaced by real props in Phase 3.
const HERO_BARS = [
  { v: 31, label: "אינטימיות", hot: true },
  { v: 39, label: "חיבור רגשי", hot: false },
  { v: 58, label: "תקשורת", hot: false },
  { v: 43, label: "חברות", hot: false },
  { v: 64, label: "משפחה", hot: false },
];

const CATEGORIES = [
  {
    score: 31,
    exp: "הכי הרבה מקום לצמיחה",
    name: "מיניות ואינטימיות",
    text: "הקרבה הפיזית והתשוקה לא תמיד נוכחות. שגרה, מתח וקושי לדבר על מין מרחיקים, ואפשר להחזיר את הניצוץ.",
    low: true,
  },
  {
    score: 39,
    exp: "מקום לחיזוק",
    name: "אהבה וחיבור רגשי",
    text: "החיבור הרגשי קצת דק, לפעמים חיים זה לצד זה ולא ביחד. רגעים קטנים, הערכה ופתיחות רגשית מקרבים מחדש.",
    low: false,
  },
  {
    score: 58,
    exp: "בסיס טוב",
    name: "תקשורת זוגית",
    text: "התקשורת ביניכם נתקעת לפעמים, שיחות שמסלימות, או כאלה שלא נאמרות. פתיחה רכה, הקשבה לרגש שמתחת למילים ותיקון אחרי ריב משנים הכל.",
    low: false,
  },
  {
    score: 43,
    exp: "מקום לחיזוק",
    name: "חברות ושותפות יומיומית",
    text: "החברות והכיף היומיומי נדחקים מעט. טקסים קטנים, צחוק משותף ורגעי 'אנחנו' מחזירים את השותפות.",
    low: false,
  },
  {
    score: 64,
    exp: "תחום חזק יחסית",
    name: "משפחה",
    text: "ההתמודדות עם ההורות והמשפחה לוקחת מקום. תיאום ציפיות וגב הדדי זה לזה עושים את ההבדל.",
    low: false,
  },
];

const PACKAGES = [
  { name: "חודשי", tag: "מבצע", note: "חודש ראשון, אחר כך ₪222", price: "₪57" },
  { name: "רבעוני", tag: null, note: "חיסכון 12%", price: "₪650" },
  { name: "שנתי", tag: null, note: "חיסכון 10%", price: "₪2,650" },
];

const INCLUDED = [
  "פרק חדש כל שבוע",
  "מומחה זוגיות פרטי בצ'אט",
  "משחקי זוגות אונליין",
  "הסקס של מיאושי",
  "ייעוץ זוגי עם מיאושי",
];

export function AnalysisSummary({ analysis, locale }: AnalysisSummaryProps) {
  const isHe = locale === "he";
  // Phase 1: which package is visually selected (skin only — no price/checkout
  // wiring yet). Phase 3 connects this to the cadence + JourneyCheckoutButton.
  const [selected, setSelected] = useState(0);

  if (!analysis) {
    return (
      <div className="ar-loading" dir={isHe ? "rtl" : "ltr"}>
        <span className="ar-spinner" aria-hidden />
        <p>מכינים את התמונה האישית שלכם…</p>
        <style jsx>{`
          .ar-loading {
            display: flex;
            min-height: 60vh;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 18px;
            padding: 40px 24px;
            background: #fcfaf7;
            color: #2e2622;
            font-family: var(--font-heebo), "Heebo", system-ui, sans-serif;
            font-size: 20px;
            text-align: center;
          }
          .ar-spinner {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid rgba(122, 31, 43, 0.18);
            border-top-color: #7a1f2b;
            animation: ar-spin 0.8s linear infinite;
          }
          @keyframes ar-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="ar-root" dir={isHe ? "rtl" : "ltr"}>
      {/* ── HERO ───────────────────────────────────────────────────── */}
      <div className="ar-hero">
        <div className="ar-hero-figure" aria-hidden />
        <div className="ar-hero-content">
          <div className="ar-eyebrow">תוצאות האבחון שלכם</div>
          <h1 className="ar-h1 font-heading">
            <span style={{ color: "#fff" }}>דנה,</span> אפשר להחזיר את הקרבה.
          </h1>
          <p className="ar-sub">
            השלמת את האבחון. ניתחנו את הנתונים שלך, ובנינו עבורך תמונת מצב אישית
            שמראה איפה הזוגיות חזקה, ואיפה נמצא הפוטנציאל הגדול ביותר לשיפור.
          </p>
          <div className="ar-bars">
            {HERO_BARS.map((b, i) => (
              <div className={`ar-bar${b.hot ? " hot" : ""}`} key={i}>
                <span className="ar-v">{b.v}</span>
                <div
                  className="ar-col"
                  style={
                    b.hot
                      ? { height: `${b.v}%`, background: "var(--ar-grad)", border: 0 }
                      : {
                          height: `${b.v}%`,
                          background:
                            "linear-gradient(rgba(255,255,255,.07),rgba(255,255,255,.07)) padding-box, var(--ar-grad) border-box",
                        }
                  }
                />
                <span className="ar-lbl">{b.label}</span>
              </div>
            ))}
          </div>
          <a className="ar-herolink" href="#ar-price">
            להצטרף לייעוץ הזוגי עם מיאושי
          </a>
        </div>
      </div>

      {/* ── SHEET ──────────────────────────────────────────────────── */}
      <div className="ar-sheet">
        {/* PERSONAL FEEDBACK */}
        <section className="ar-section">
          <div className="ar-fbcard">
            <div className="ar-photo" aria-hidden />
            <div className="ar-sublabel ar-center">המשוב האישי שלכם</div>
            <p className="ar-fbtext">
              האהבה ביניכם קיימת. כרגע נראה שהשגרה השפיעה בעיקר על הקרבה
              והאינטימיות. החדשות הטובות: הבסיס הזוגי שלכם חזק, ולכן הפוטנציאל
              לשינוי גבוה.
            </p>
          </div>
        </section>

        {/* CATEGORIES */}
        <section className="ar-section">
          <div className="ar-sublabel">מה התשובות שלכם מספרות</div>
          <div className="ar-cats">
            {CATEGORIES.map((c, i) => (
              <div className={`ar-catcard${c.low ? " low" : ""}`} key={i}>
                <div className="ar-scorerow">
                  <span className="ar-snum font-heading">{c.score}</span>
                  <span className="ar-sof">/ 100</span>
                  <span className="ar-sexp">{c.exp}</span>
                  {c.low ? <span className="ar-badge">נתחיל מכאן</span> : null}
                </div>
                <div className="ar-cname">{c.name}</div>
                <p className="ar-ctxt">{c.text}</p>
              </div>
            ))}
          </div>
          <div className="ar-howcard">
            <div className="ar-hl">מכאן ממשיכים יחד</div>
            <p>
              על כל אחד מהתחומים האלה נעבוד יחד, פרק חדש בכל שבוע, ואתם קובעים את
              הסדר.
            </p>
            <p>
              את האבחון המלא, לתמונה מדויקת ולתוצאות עמוקות יותר, נשלים יחד מיד
              אחרי ההצטרפות לתוכנית הייעוץ הזוגי של מיאושי.
            </p>
          </div>
        </section>

        {/* IMPROVEMENTS */}
        <section className="ar-section">
          <div className="ar-sublabel">מה תקבלו בליווי</div>
          <div className="ar-imp">
            <div className="ar-improw">
              <span className="ar-ic">
                <svg viewBox="0 0 24 24">
                  <path d="M12 20s-7-4.5-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.5-7 9-7 9z" />
                  <path d="M12 11v-3M10.5 9.5h3" strokeWidth="1.4" />
                </svg>
              </span>
              <span>האינטימיות תגדל</span>
            </div>
            <div className="ar-improw">
              <span className="ar-ic">
                <svg viewBox="0 0 24 24">
                  <path d="M12 7v11" />
                  <path d="M12 9C9 3 3 4.5 4 9.5c.8 3.8 6 4.5 8 1.5" />
                  <path d="M12 9c3-6 9-4.5 8 .5-.8 3.8-6 4.5-8 1.5" />
                </svg>
              </span>
              <span>הפרפרים יחזרו לבטן</span>
            </div>
            <div className="ar-improw">
              <span className="ar-ic">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3c1 3-1 4-1 6a3 3 0 006 0c0-1 0-2-1-3 2 1 4 4 4 7a8 8 0 01-16 0c0-4 3-6 4-8 1 1 2 1 4-2z" />
                </svg>
              </span>
              <span>הסקס יהיה עוצמתי מתמיד</span>
            </div>
            <div className="ar-improw">
              <span className="ar-ic">
                <svg viewBox="0 0 24 24">
                  <circle cx="8" cy="9" r="2.4" />
                  <circle cx="16" cy="9" r="2.4" />
                  <path d="M3.5 19a4.5 4.5 0 019 0M11.5 19a4.5 4.5 0 019 0" />
                </svg>
              </span>
              <span>החברות ביניכם תתחזק</span>
            </div>
            <div className="ar-improw">
              <span className="ar-ic">
                <svg viewBox="0 0 24 24">
                  <path d="M5 7h11l3 3-3 3H5z" />
                  <path d="M5 7v12" strokeWidth="1.4" />
                </svg>
              </span>
              <span>הריבים יפחתו והשקט יחזור</span>
            </div>
            <div className="ar-improw">
              <span className="ar-ic">
                <svg viewBox="0 0 24 24">
                  <path d="M12 20s-7-4.5-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.5-7 9-7 9z" />
                </svg>
              </span>
              <span>האהבה תחזור</span>
            </div>
          </div>
        </section>

        {/* PRICE */}
        <section className="ar-section" id="ar-price">
          <h2 className="ar-sh font-heading">איזו חבילה מתאימה לכם?</h2>
          <div className="ar-pricecard">
            {PACKAGES.map((p, i) => (
              <button
                type="button"
                className={`ar-opt${selected === i ? " sel" : ""}`}
                onClick={() => setSelected(i)}
                key={i}
              >
                <span className="ar-radio" />
                <span className="ar-opt-info">
                  <span className="ar-opt-name">
                    {p.name}
                    {p.tag ? <span className="ar-opt-tag">{p.tag}</span> : null}
                  </span>
                  <span className="ar-opt-note">{p.note}</span>
                </span>
                <span className="ar-opt-price font-heading">{p.price}</span>
              </button>
            ))}
            <div className="ar-incl">
              {INCLUDED.map((it, i) => (
                <div className="ar-it" key={i}>
                  {it}
                </div>
              ))}
            </div>
            <a className="ar-cta">להצטרפות עכשיו</a>
            <div className="ar-stop">אפשר לעצור בכל עת בלחיצת כפתור.</div>
          </div>
        </section>

        <p className="ar-anchor">
          פגישת ייעוץ מתחילה ב-₪500 מינימום ויכולה להגיע לאלפי שקלים.{" "}
          <b>איתנו תקבלו ליווי צמוד, כל החודש.</b>
        </p>
      </div>

      <style jsx>{`
        .ar-root {
          --ar-grad: linear-gradient(
            95deg,
            #6c5ce7 0%,
            #d6409f 52%,
            #f79154 100%
          );
          background: #fcfaf7;
          color: #2e2622;
          font-family: var(--font-heebo), "Assistant", "Heebo", system-ui,
            sans-serif;
          font-size: 20px;
          line-height: 1.55;
          -webkit-font-smoothing: antialiased;
          position: relative;
          overflow: hidden;
        }
        .font-heading {
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
        }
        .ar-eyebrow {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        /* HERO */
        .ar-hero {
          position: relative;
          overflow: hidden;
          color: #fff;
          padding: 30px 24px 34px;
          background-image: linear-gradient(
              180deg,
              rgba(36, 29, 26, 0.3) 0%,
              rgba(36, 29, 26, 0.72) 60%,
              #241d1a 100%
            ),
            url("/images/m-hero-assess.webp");
          background-size: cover;
          background-position: left center;
          background-repeat: no-repeat;
        }
        .ar-hero-figure {
          display: none;
        }
        .ar-hero-content {
          position: relative;
          z-index: 1;
        }
        .ar-hero .ar-eyebrow {
          color: #e7d8c6;
        }
        .ar-h1 {
          font-size: 42px;
          font-weight: 900;
          line-height: 1.12;
          color: #fff;
          margin: 12px 0 8px;
        }
        .ar-sub {
          font-size: 22px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.45;
          margin-bottom: 20px;
        }
        .ar-bars {
          display: flex;
          gap: 10px;
          align-items: flex-end;
          height: 120px;
        }
        .ar-bar {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          height: 100%;
        }
        .ar-col {
          width: 100%;
          border-radius: 8px 8px 4px 4px;
          border: 2px solid transparent;
        }
        .ar-v {
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 7px;
          color: rgba(255, 255, 255, 0.9);
        }
        .ar-lbl {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          margin-top: 9px;
          text-align: center;
          font-weight: 500;
          line-height: 1.3;
        }
        .ar-herolink {
          display: inline-block;
          margin-top: 24px;
          color: #fff;
          font-weight: 700;
          font-size: 20px;
          text-decoration: underline;
          text-underline-offset: 6px;
          text-decoration-thickness: 2px;
          text-decoration-color: rgba(255, 255, 255, 0.55);
          cursor: pointer;
        }

        /* SHEET */
        .ar-sheet {
          background: #fcfaf7;
          position: relative;
          padding: 34px 24px 30px;
        }
        .ar-section {
          margin-bottom: 40px;
        }
        .ar-sh {
          font-size: 25px;
          margin-bottom: 4px;
          line-height: 1.2;
        }
        .ar-sublabel {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #7a1f2b;
          margin-bottom: 10px;
        }
        .ar-center {
          text-align: center;
        }

        /* FEEDBACK */
        .ar-fbcard {
          text-align: center;
          max-width: 640px;
          margin: 0 auto;
        }
        .ar-photo {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          margin: 0 auto 20px;
          background: url("/images/assess.webp") center 25% / cover no-repeat;
          box-shadow: 0 14px 34px -14px rgba(80, 50, 35, 0.45);
          border: 4px solid #fff;
        }
        .ar-fbtext {
          font-size: 24px;
          font-weight: 500;
          line-height: 1.5;
          color: #2e2622;
        }

        /* CATEGORY cards */
        .ar-cats {
          display: flex;
          flex-direction: column;
          gap: 30px;
          margin-top: 18px;
          max-width: 700px;
          margin-inline: auto;
        }
        .ar-catcard {
          background: linear-gradient(155deg, #ffffff 0%, #fbf2e4 100%);
          border-radius: 18px;
          padding: 18px 20px;
          box-shadow: 0 8px 24px -16px rgba(80, 50, 35, 0.3);
          display: flex;
          flex-direction: column;
        }
        .ar-catcard.low {
          background: linear-gradient(155deg, #ffffff 0%, #fbf2e4 100%)
              padding-box,
            var(--ar-grad) border-box;
          border: 2px solid transparent;
        }
        .ar-scorerow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .ar-snum {
          font-size: 36px;
          font-weight: 900;
          line-height: 1;
          background: var(--ar-grad);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .ar-sof,
        .ar-sexp {
          font-size: 15px;
          color: #7b6b5e;
          font-weight: 600;
        }
        .ar-badge {
          margin-inline-start: auto;
          font-size: 12px;
          font-weight: 800;
          color: #fff;
          background: var(--ar-grad);
          padding: 4px 11px;
          border-radius: 99px;
          white-space: nowrap;
        }
        .ar-cname {
          font-weight: 800;
          font-size: 28px;
          margin-bottom: 6px;
          background: var(--ar-grad);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          display: inline-block;
        }
        .ar-ctxt {
          font-size: 22px;
          line-height: 1.4;
          color: #5a4f46;
        }

        /* HOW IT CONTINUES */
        .ar-howcard {
          text-align: center;
          max-width: 620px;
          margin: 20px auto 0;
          padding: 0 8px;
        }
        .ar-hl {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #7a1f2b;
          margin-bottom: 12px;
        }
        .ar-howcard p {
          font-size: 20px;
          line-height: 1.55;
          color: #2e2622;
          font-weight: 500;
        }
        .ar-howcard p + p {
          margin-top: 12px;
        }

        /* IMPROVEMENTS */
        .ar-imp {
          display: flex;
          flex-direction: column;
          gap: 13px;
          margin-top: 18px;
        }
        .ar-improw {
          display: flex;
          gap: 15px;
          align-items: center;
          background: #fffdf9;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 6px 18px -14px rgba(80, 50, 35, 0.3);
        }
        .ar-ic {
          flex: none;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(
            150deg,
            rgba(108, 92, 231, 0.16),
            rgba(214, 64, 159, 0.12)
          );
          display: grid;
          place-items: center;
          color: #b3318c;
        }
        .ar-ic :global(svg) {
          width: 25px;
          height: 25px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.7;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .ar-improw > span:last-child {
          font-size: 20px;
          font-weight: 700;
        }

        /* PRICE */
        .ar-pricecard {
          max-width: 520px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #ece2cf;
          border-radius: 24px;
          padding: 16px;
          box-shadow: 0 18px 44px -22px rgba(120, 70, 120, 0.28);
        }
        .ar-opt {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          background: #fcfaf7;
          border: 1.5px solid #ece2cf;
          border-radius: 16px;
          padding: 18px;
          cursor: pointer;
          text-align: right;
          margin-bottom: 12px;
          transition: 0.15s;
          font-family: inherit;
        }
        .ar-opt:last-of-type {
          margin-bottom: 0;
        }
        .ar-opt.sel {
          border: 2px solid transparent;
          background: linear-gradient(#fff, #fff) padding-box, var(--ar-grad) border-box;
          box-shadow: 0 8px 20px -12px rgba(150, 60, 150, 0.35);
        }
        .ar-radio {
          flex: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid #cbb89f;
          position: relative;
        }
        .ar-opt.sel .ar-radio {
          border: 0;
          background: var(--ar-grad);
        }
        .ar-opt.sel .ar-radio::after {
          content: "";
          position: absolute;
          inset: 6px;
          background: #fff;
          border-radius: 50%;
        }
        .ar-opt-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
          text-align: start;
        }
        .ar-opt-name {
          font-weight: 800;
          font-size: 21px;
          color: #2e2622;
        }
        .ar-opt-tag {
          font-size: 12px;
          font-weight: 800;
          color: #fff;
          background: var(--ar-grad);
          padding: 2px 9px;
          border-radius: 99px;
          margin-inline-start: 6px;
          vertical-align: middle;
        }
        .ar-opt-note {
          font-size: 16px;
          color: #2e2622;
        }
        .ar-opt-price {
          flex: none;
          font-weight: 900;
          font-size: 26px;
          color: #2e2622;
        }
        .ar-opt.sel .ar-opt-price {
          background: var(--ar-grad);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .ar-incl {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          margin-top: 16px;
          padding-top: 8px;
        }
        .ar-it {
          font-size: 18px;
          font-weight: 600;
          color: #2e2622;
          padding: 11px 0;
          position: relative;
          text-align: center;
        }
        .ar-it:not(:last-child)::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 66px;
          height: 1px;
          border-radius: 2px;
          background: var(--ar-grad);
        }
        .ar-cta {
          display: block;
          width: 100%;
          text-align: center;
          border: 0;
          cursor: pointer;
          font-weight: 800;
          font-size: 20px;
          color: #fff;
          padding: 18px;
          border-radius: 16px;
          background: var(--ar-grad);
          box-shadow: 0 16px 36px -12px rgba(150, 60, 150, 0.5);
          text-decoration: none;
          margin-top: 18px;
        }
        .ar-stop {
          text-align: center;
          font-size: 16px;
          color: #7b6b5e;
          margin-top: 12px;
        }

        .ar-anchor {
          text-align: center;
          font-size: 20px;
          line-height: 1.5;
          color: #2e2622;
          font-weight: 600;
          max-width: 620px;
          margin: 6px auto 0;
          border: 1px solid #ead9c8;
          border-radius: 18px;
          padding: 20px 24px;
        }
        .ar-anchor :global(b) {
          color: #7a1f2b;
          font-weight: 800;
        }
      `}</style>
    </div>
  );
}
