"use client";

import { useEffect, useRef } from "react";
import { Link } from "@/navigation";
import { useCmsText } from "@/hooks/useCmsText";
import type { Locale } from "@/lib/journey/types";
import "./styles.css";

/**
 * Couples-assessment marketing landing — sections ported from
 * docs/assessment-intro-mockup-v12.html. Copy is CMS-editable
 * (couplesAssessment.* / migration 154) with a bilingual inline fallback;
 * `rc` renders the literal when a CMS value is unset. The FAQ is the shared
 * homepage component, passed in via `faqSlot` (server-rendered) so it stays
 * byte-identical to the homepage.
 *
 * Animations (living hero graph, staggered domain reveal) run in the effect
 * below, honouring prefers-reduced-motion; the start-line bob + step floaty
 * are pure CSS (styles.css), also gated on reduced-motion.
 */

const RK = "couplesAssessment";
// CTA → the assessment funnel (first question).
const ASSESS_HREF = "/journey/assessment";

export function CassessContent({
  locale,
  faqSlot,
  shortCount,
}: {
  locale: Locale;
  faqSlot: React.ReactNode;
  /** Task 12 — live short-assessment question count, substituted into "{N}". */
  shortCount?: number;
}) {
  const isHe = locale === "he";
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Substitute the live {N} into any CMS string that carries it (hero.trust).
  const subN = (s: string) =>
    shortCount != null ? s.replace(/\{N\}/g, String(shortCount)) : s;

  // ── CMS copy (inline bilingual fallback) ──────────────────────────────
  const c = {
    heroEyebrow: useCmsText(`${RK}.hero.eyebrow`).text,
    heroH1: useCmsText(`${RK}.hero.h1`).text,
    heroSub: useCmsText(`${RK}.hero.sub`).text,
    heroCta: useCmsText(`${RK}.hero.cta`).text,
    heroTrust: subN(useCmsText(`${RK}.hero.trust`).text),
    startLabel: useCmsText(`${RK}.hero.startLabel`).text,
    goalLabel: useCmsText(`${RK}.hero.goalLabel`).text,
    bar1: useCmsText(`${RK}.hero.bar1`).text,
    bar2: useCmsText(`${RK}.hero.bar2`).text,
    bar3: useCmsText(`${RK}.hero.bar3`).text,
    bar4: useCmsText(`${RK}.hero.bar4`).text,
    bar5: useCmsText(`${RK}.hero.bar5`).text,
    whatLead: useCmsText(`${RK}.what.lead`).text,
    whatH2: useCmsText(`${RK}.what.h2`).text,
    whatBody: useCmsText(`${RK}.what.body`).text,
    domLead: useCmsText(`${RK}.domains.lead`).text,
    domH2: useCmsText(`${RK}.domains.h2`).text,
    d1n: useCmsText(`${RK}.domains.d1Name`).text,
    d1d: useCmsText(`${RK}.domains.d1Desc`).text,
    d2n: useCmsText(`${RK}.domains.d2Name`).text,
    d2d: useCmsText(`${RK}.domains.d2Desc`).text,
    d3n: useCmsText(`${RK}.domains.d3Name`).text,
    d3d: useCmsText(`${RK}.domains.d3Desc`).text,
    d4n: useCmsText(`${RK}.domains.d4Name`).text,
    d4d: useCmsText(`${RK}.domains.d4Desc`).text,
    d5n: useCmsText(`${RK}.domains.d5Name`).text,
    d5d: useCmsText(`${RK}.domains.d5Desc`).text,
    gapLead: useCmsText(`${RK}.gap.lead`).text,
    gapH2: useCmsText(`${RK}.gap.h2`).text,
    gapCta: useCmsText(`${RK}.gap.cta`).text,
    s1t: useCmsText(`${RK}.gap.step1Title`).text,
    s1b: useCmsText(`${RK}.gap.step1Body`).text,
    s2t: useCmsText(`${RK}.gap.step2Title`).text,
    s2b: useCmsText(`${RK}.gap.step2Body`).text,
    s3t: useCmsText(`${RK}.gap.step3Title`).text,
    s3b: useCmsText(`${RK}.gap.step3Body`).text,
    clEyebrow: useCmsText(`${RK}.closing.eyebrow`).text,
    clH2: useCmsText(`${RK}.closing.h2`).text,
    clTrust: useCmsText(`${RK}.closing.trust`).text,
    clCta: useCmsText(`${RK}.closing.cta`).text,
  };
  const rc = (raw: string, he: string, en: string) =>
    raw && raw.trim().length > 0 && !raw.startsWith(`${RK}.`)
      ? raw
      : isHe ? he : en;

  // ── Animations (mirrors the mockup <script>) ──────────────────────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    // Living hero graph: each bar oscillates on its own sine wave.
    if (!reduce) {
      const cols = Array.from(
        root.querySelectorAll<HTMLElement>(".bars .bcol"),
      );
      const cfg = [
        { lo: 24, hi: 72, sp: 0.55, ph: 0.0 },
        { lo: 28, hi: 80, sp: 0.44, ph: 1.3 },
        { lo: 42, hi: 86, sp: 0.5, ph: 0.6 },
        { lo: 34, hi: 82, sp: 0.47, ph: 2.1 },
        { lo: 46, hi: 90, sp: 0.49, ph: 1.0 },
      ];
      const frame = (t: number) => {
        const s = t / 1000;
        for (let i = 0; i < cols.length; i++) {
          const cf = cfg[i];
          if (!cf) continue;
          const v = cf.lo + (cf.hi - cf.lo) * (0.5 + 0.5 * Math.sin(s * cf.sp + cf.ph));
          cols[i].style.height = v.toFixed(1) + "%";
          const num = cols[i].querySelector<HTMLElement>(".v");
          if (num) num.textContent = String(Math.round(v));
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    // Domains: staggered reveal once the block scrolls into view.
    let io: IntersectionObserver | null = null;
    const proc = root.querySelector<HTMLElement>(".proc");
    if (proc) {
      if (reduce || !("IntersectionObserver" in window)) {
        proc.classList.add("in");
      } else {
        io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                proc.classList.add("in");
                io?.disconnect();
              }
            });
          },
          { threshold: 0.25 },
        );
        io.observe(proc);
      }
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, []);

  return (
    <div className="cassess" dir={isHe ? "rtl" : "ltr"} ref={rootRef}>
      {/* HERO */}
      <div className="hero">
        <div className="eyebrow">{rc(c.heroEyebrow, "אבחון זוגי · חינם", "Couples assessment · free")}</div>
        <h1>{rc(c.heroH1, "איפה אתם היום, ולאן אפשר להגיע?", "Where are you today, and how far can you go?")}</h1>
        <p className="sub">{rc(c.heroSub, "אבחון קצר ותקבלו תמונה רחבה על הזוגיות שלכם!", "A short assessment, and you get a broad picture of your relationship.")}</p>

        <div className="herobars">
          <div className="chart">
            <div className="bars">
              <div className="bcol" style={{ height: "30%" }}><span className="v">30</span></div>
              <div className="bcol" style={{ height: "44%" }}><span className="v">44</span></div>
              <div className="bcol" style={{ height: "60%" }}><span className="v">60</span></div>
              <div className="bcol" style={{ height: "40%" }}><span className="v">40</span></div>
              <div className="bcol" style={{ height: "64%" }}><span className="v">64</span></div>
            </div>
            <span className="startline"><i>{rc(c.startLabel, "נקודת ההתחלה שלכם", "Your starting point")}</i></span>
            <span className="goalline"><i>{rc(c.goalLabel, "היעד", "The goal")}</i></span>
          </div>
          <div className="blabels">
            <span>{rc(c.bar1, "אינטימיות", "Intimacy")}</span>
            <span>{rc(c.bar2, "חיבור רגשי", "Emotional")}</span>
            <span>{rc(c.bar3, "תקשורת", "Communication")}</span>
            <span>{rc(c.bar4, "חברות", "Friendship")}</span>
            <span>{rc(c.bar5, "משפחה", "Family")}</span>
          </div>
        </div>

        <Link href={ASSESS_HREF} className="cta" style={{ marginTop: 24 }}>
          {rc(c.heroCta, "להתחיל את האבחון", "Start the assessment")}
        </Link>
        <div className="trust">{rc(c.heroTrust, "3 דקות · בלי כרטיס אשראי", "3 minutes · no credit card")}</div>
      </div>

      {/* WHAT YOU GET */}
      <section className="csec">
        <div className="wrap">
          <div className="circ" aria-hidden />
          <div className="lead">{rc(c.whatLead, "איפה הזוגיות שלכם חזקה ואיפה כדאי לשפר?", "Where is your relationship strong, and where to improve?")}</div>
          <h2 className="sh">{rc(c.whatH2, "תמונת מצב אישית של הזוגיות שלכם", "A personal picture of your relationship")}</h2>
          <p className="body-p">{rc(c.whatBody, "תוך 3 דקות תקבלו ניתוח אישי המראה היכן הקשר חזק, איפה נוצר פער, ואיפה נמצא הפוטנציאל הגדול ביותר לשינוי. בלי ניחושים - תמונת מצב אמיתית של הזוגיות שלכם.", "In 3 minutes you get a personal analysis showing where the bond is strong, where a gap formed, and where the biggest potential for change is. No guessing, a real picture of your relationship.")}</p>
        </div>
      </section>

      {/* DOMAINS */}
      <section className="csec" style={{ background: "var(--cream)" }}>
        <div className="wrap">
          <div className="lead">{rc(c.domLead, "מה בודקים?", "What we check")}</div>
          <h2 className="sh">{rc(c.domH2, "חמשת התחומים שאנחנו בוחנים", "The five areas we examine")}</h2>
          <div className="proc">
            <div className="procitem"><div className="num">1</div><div className="pc"><div className="dn">{rc(c.d1n, "אינטימיות", "Intimacy")}</div><div className="dd">{rc(c.d1d, "הקרבה הפיזית, התשוקה והנוכחות שלכם זה עבור זה.", "Physical closeness, desire, and being present for each other.")}</div></div></div>
            <div className="procitem"><div className="num">2</div><div className="pc"><div className="dn">{rc(c.d2n, "חיבור רגשי", "Emotional connection")}</div><div className="dd">{rc(c.d2d, "עד כמה אתם מרגישים מובנים, קרובים ושותפים אמיתיים.", "How understood, close, and truly partnered you feel.")}</div></div></div>
            <div className="procitem"><div className="num">3</div><div className="pc"><div className="dn">{rc(c.d3n, "תקשורת", "Communication")}</div><div className="dd">{rc(c.d3d, "איך אתם מדברים, מקשיבים ומתקנים את הקשר אחרי ריב.", "How you talk, listen, and repair after a fight.")}</div></div></div>
            <div className="procitem"><div className="num">4</div><div className="pc"><div className="dn">{rc(c.d4n, "חברות", "Friendship")}</div><div className="dd">{rc(c.d4d, "הכיף, הצחוק והרגעים הקטנים של היומיום יחד.", "The fun, laughter, and small everyday moments together.")}</div></div></div>
            <div className="procitem"><div className="num">5</div><div className="pc"><div className="dn">{rc(c.d5n, "משפחה", "Family")}</div><div className="dd">{rc(c.d5d, "ההתמודדות עם ההורות והמשפחה, והתיאום ההדדי ביניכם.", "Handling parenting and family, and how you coordinate.")}</div></div></div>
          </div>
        </div>
      </section>

      {/* GAP TO GOAL */}
      <section className="csec" style={{ background: "var(--cream)" }}>
        <div className="wrap">
          <div className="lead">{rc(c.gapLead, "מפער ליעד", "From gap to goal")}</div>
          <h2 className="sh">{rc(c.gapH2, "לראות את הפער זה הצעד הראשון לסגור אותו", "Seeing the gap is the first step to closing it")}</h2>
          <div style={{ textAlign: "center" }}>
            <Link href={ASSESS_HREF} className="cta">{rc(c.gapCta, "להתחיל את האבחון", "Start the assessment")}</Link>
          </div>
          <div className="steps">
            <div className="step">
              <div className="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /></svg></div>
              <strong>{rc(c.s1t, "רואים את הפער", "See the gap")}</strong><span>{rc(c.s1b, "איפה הזוגיות שלכם היום, מול איפה אתם רוצים שתהיה.", "Where your relationship is today vs. where you want it.")}</span>
            </div>
            <div className="step">
              <div className="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3" /></svg></div>
              <strong>{rc(c.s2t, "יודעים מאיפה מתחילים", "Know where to start")}</strong><span>{rc(c.s2b, "התחום עם הפוטנציאל הכי גדול לשיפור, מסומן בבירור.", "The area with the most room to grow, clearly marked.")}</span>
            </div>
            <div className="step">
              <div className="ic"><svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 7-7" /><path d="M17 8h4v4" /></svg></div>
              <strong>{rc(c.s3t, "מתקדמים ליעד", "Move toward the goal")}</strong><span>{rc(c.s3b, "צעד אחרי צעד, ממקום מדויק - וסוגרים את הפער.", "Step by step, from a precise place, and close the gap.")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — shared homepage component (server-rendered, slotted in) */}
      {faqSlot}

      {/* CLOSING */}
      <div className="closing">
        <div className="ce">{rc(c.clEyebrow, "מוכנים להתחיל?", "Ready to begin?")}</div>
        <h2>{rc(c.clH2, "קליק אחד זה כל מה שמפריד ביניכם לבין הזוגיות שמגיעה לכם.", "One click is all that stands between you and the relationship you deserve.")}</h2>
        <div className="ct-trust">{rc(c.clTrust, "בלי כרטיס אשראי", "No credit card")}</div>
        <Link href={ASSESS_HREF} className="cta">{rc(c.clCta, "קדימה לאבחון", "Start the assessment")}</Link>
      </div>
    </div>
  );
}
