"use client";

import { useEffect, useRef } from "react";
import { useCmsText } from "@/hooks/useCmsText";
import "./styles.css";

/**
 * AssessmentHeroChart — the living 5-domain bar chart from the
 * /couples-assessment hero (oscillating bars with a start line + goal line),
 * extracted so it can be REUSED verbatim: on the assessment hero
 * (`standalone={false}`, it sits inside the page's existing `.cassess .hero`)
 * and embedded inside articles (`standalone`, it brings its own `.cassess` +
 * dark hero backdrop so the white bars/labels stay legible on a light page).
 *
 * The oscillation + labels are identical to the original inline markup; the
 * animation is scoped to this component's own `.bars .bcol` and honours
 * prefers-reduced-motion.
 */

const RK = "couplesAssessment";

export function AssessmentHeroChart({
  locale,
  standalone = false,
}: {
  locale: "he" | "en";
  standalone?: boolean;
}) {
  const isHe = locale === "he";
  const ref = useRef<HTMLDivElement | null>(null);

  const startLabel = useCmsText(`${RK}.hero.startLabel`).text;
  const goalLabel = useCmsText(`${RK}.hero.goalLabel`).text;
  const bar1 = useCmsText(`${RK}.hero.bar1`).text;
  const bar2 = useCmsText(`${RK}.hero.bar2`).text;
  const bar3 = useCmsText(`${RK}.hero.bar3`).text;
  const bar4 = useCmsText(`${RK}.hero.bar4`).text;
  const bar5 = useCmsText(`${RK}.hero.bar5`).text;
  const rc = (raw: string, he: string, en: string) =>
    raw && raw.trim().length > 0 && !raw.startsWith(`${RK}.`) ? raw : isHe ? he : en;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const cols = Array.from(root.querySelectorAll<HTMLElement>(".bars .bcol"));
    const cfg = [
      { lo: 24, hi: 72, sp: 0.55, ph: 0.0 },
      { lo: 28, hi: 80, sp: 0.44, ph: 1.3 },
      { lo: 42, hi: 86, sp: 0.5, ph: 0.6 },
      { lo: 34, hi: 82, sp: 0.47, ph: 2.1 },
      { lo: 46, hi: 90, sp: 0.49, ph: 1.0 },
    ];
    let raf = 0;
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
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const chart = (
    <div className="herobars" ref={ref}>
      <div className="chart">
        <div className="bars">
          <div className="bcol" style={{ height: "30%" }}><span className="v">30</span></div>
          <div className="bcol" style={{ height: "44%" }}><span className="v">44</span></div>
          <div className="bcol" style={{ height: "60%" }}><span className="v">60</span></div>
          <div className="bcol" style={{ height: "40%" }}><span className="v">40</span></div>
          <div className="bcol" style={{ height: "64%" }}><span className="v">64</span></div>
        </div>
        <span className="startline"><i>{rc(startLabel, "נקודת ההתחלה שלכם", "Your starting point")}</i></span>
        <span className="goalline"><i>{rc(goalLabel, "היעד", "The goal")}</i></span>
      </div>
      <div className="blabels">
        <span>{rc(bar1, "אינטימיות", "Intimacy")}</span>
        <span>{rc(bar2, "חיבור רגשי", "Emotional")}</span>
        <span>{rc(bar3, "תקשורת", "Communication")}</span>
        <span>{rc(bar4, "חברות", "Friendship")}</span>
        <span>{rc(bar5, "משפחה", "Family")}</span>
      </div>
    </div>
  );

  // On the assessment page the chart is already inside `.cassess .hero`, so
  // render the bars bare. Standalone (articles) wraps in `.cassess` + the same
  // dark hero backdrop the bars were designed for.
  if (!standalone) return chart;
  return (
    <div className="cassess my-10" dir={isHe ? "rtl" : "ltr"}>
      <div className="hero" style={{ borderRadius: 18, padding: "34px 22px 30px" }}>
        {chart}
      </div>
    </div>
  );
}
