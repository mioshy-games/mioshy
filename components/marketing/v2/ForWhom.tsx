"use client";

import { TrackedLink } from "./TrackedLink";
import { CmsText } from "@/components/cms/CmsText";

/**
 * ForWhom — 6 personas grid + CTA banner.
 * Sprint 4 #1 closeout: every DOM text via <CmsText>. Headline keeps
 * its inline-styled <em> wrapper for the `headlineEm` portion so
 * the wine-red italic-serif treatment stays regardless of mode.
 */
export function ForWhom() {
  // Display order set 2026-05-18 by Itzik. The `n` field still maps
  // to its original CMS keys (`persona${n}Title|Desc|Link`).
  //
  // 2026-05-18 (later) — bottom row trimmed per Itzik. Personas 4
  // ("רוצים להתחבר מחדש"), 2 ("רוצים זמן זוגי באמת"), and 3
  // ("מחפשים מומחה שיעזור") were removed from the render. Their CMS
  // keys (homeV2.forWhom.persona2/3/4 Title/Desc/Link) stay in
  // messages/*.json + cms_texts so they can be reinstated cleanly.
  //
  // Visual order in the RTL grid — single row of 3:
  //   1. persona1  — "רוצים להחזיר את הניצוץ"
  //   2. persona5  — "מחפשים בילוי אינטימי מהנה"
  //   3. persona6  — "רוצים לפלפל את חיי המין"
  const PERSONAS = [
    { icon: "✦", n: 1, href: "#journey" },
    { icon: "★", n: 5, href: "#couples-games" },
    { icon: "♨", n: 6, href: "#adult-games" },
  ] as const;

  return (
    <section className="for-whom" id="for-whom">
      <div className="container">
        <div className="section-head">
          <CmsText cmsKey="homeV2.forWhom.eyebrow" as="div" className="eyebrow" />
          {/* Wine-accent `<em>` ("בשבילכם.") removed 2026-05-18 per Itzik.
              The `homeV2.forWhom.headlineEm` JSON key + cms_texts seed
              stay on disk so the emphasis can be reinstated cleanly. */}
          <h2>
            <CmsText cmsKey="homeV2.forWhom.headlinePart1" />
            <br />
            <CmsText cmsKey="homeV2.forWhom.headlinePart2" />
          </h2>
          <CmsText cmsKey="homeV2.forWhom.description" as="p" />
        </div>

        <div className="personas-grid">
          {PERSONAS.map((p) => (
            <Persona key={p.n} n={p.n} icon={p.icon} href={p.href} />
          ))}
        </div>

        <div className="for-whom-cta">
          <div className="for-whom-cta-text">
            <CmsText cmsKey="homeV2.forWhom.ctaSmall" className="small" />
            <CmsText cmsKey="homeV2.forWhom.ctaBig" className="big" />
          </div>
          <TrackedLink
            href="/journey/assessment"
            className="btn btn-primary"
            ctaId="for_whom_assessment"
            section="for-whom"
          >
            <CmsText cmsKey="homeV2.forWhom.cta" />
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}

function Persona({
  n,
  icon,
  href,
}: {
  n: 1 | 2 | 3 | 4 | 5 | 6;
  icon: string;
  href: string;
}) {
  return (
    <a href={href} className="persona">
      <div className="persona-icon">{icon}</div>
      <CmsText cmsKey={`homeV2.forWhom.persona${n}Title`} as="h3" />
      <CmsText cmsKey={`homeV2.forWhom.persona${n}Desc`} as="p" />
      <span className="persona-link">
        <CmsText cmsKey={`homeV2.forWhom.persona${n}Link`} /> <span>←</span>
      </span>
    </a>
  );
}
