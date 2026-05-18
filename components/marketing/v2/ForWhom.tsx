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
  const PERSONAS = [
    { icon: "✦", n: 1, href: "#journey" },
    { icon: "⌛", n: 2, href: "#journey" },
    { icon: "◆", n: 3, href: "#journey" },
    { icon: "↻", n: 4, href: "#couples-games" },
    { icon: "★", n: 5, href: "#couples-games" },
    { icon: "♨", n: 6, href: "#adult-games" },
  ] as const;

  return (
    <section className="for-whom" id="for-whom">
      <div className="container">
        <div className="section-head">
          <CmsText cmsKey="homeV2.forWhom.eyebrow" as="div" className="eyebrow" />
          <h2>
            <CmsText cmsKey="homeV2.forWhom.headlinePart1" />
            <br />
            <CmsText cmsKey="homeV2.forWhom.headlinePart2" />
            <em
              style={{
                fontFamily: "'Frank Ruhl Libre', serif",
                color: "var(--accent)",
                fontStyle: "italic",
              }}
            >
              <CmsText cmsKey="homeV2.forWhom.headlineEm" />
            </em>
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
