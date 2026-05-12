"use client";

import { TrackedLink } from "./TrackedLink";
import { useCmsText } from "@/hooks/useCmsText";

/**
 * ForWhom - 6 personas grid. Each card is a clickable link to the
 * matching service section. CTA banner below points to the assessment
 * quiz.
 *
 * CMS-migrated (Sprint 1). Persona rows use a sub-component so each
 * has its own stable hook order (6 personas × 3 keys = 18 hook calls
 * confined to the leaf).
 */
export function ForWhom() {
  const eyebrow = useCmsText("homeV2.forWhom.eyebrow");
  const headlinePart1 = useCmsText("homeV2.forWhom.headlinePart1");
  const headlinePart2 = useCmsText("homeV2.forWhom.headlinePart2");
  const headlineEm = useCmsText("homeV2.forWhom.headlineEm");
  const description = useCmsText("homeV2.forWhom.description");
  const ctaSmall = useCmsText("homeV2.forWhom.ctaSmall");
  const ctaBig = useCmsText("homeV2.forWhom.ctaBig");
  const cta = useCmsText("homeV2.forWhom.cta");

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
          <div className="eyebrow" style={eyebrow.style}>
            {eyebrow.text}
          </div>
          <h2>
            {headlinePart1.text}
            <br />
            {headlinePart2.text}
            <em
              style={{
                fontFamily: "'Frank Ruhl Libre', serif",
                color: "var(--accent)",
                fontStyle: "italic",
              }}
            >
              {headlineEm.text}
            </em>
          </h2>
          <p style={description.style}>{description.text}</p>
        </div>

        <div className="personas-grid">
          {PERSONAS.map((p) => (
            <Persona key={p.n} n={p.n} icon={p.icon} href={p.href} />
          ))}
        </div>

        <div className="for-whom-cta">
          <div className="for-whom-cta-text">
            <span className="small" style={ctaSmall.style}>
              {ctaSmall.text}
            </span>
            <span className="big" style={ctaBig.style}>
              {ctaBig.text}
            </span>
          </div>
          <TrackedLink
            href="/journey/assessment"
            className="btn btn-primary"
            ctaId="for_whom_assessment"
            section="for-whom"
          >
            {cta.text} <span className="arrow">←</span>
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
  const title = useCmsText(`homeV2.forWhom.persona${n}Title`);
  const desc = useCmsText(`homeV2.forWhom.persona${n}Desc`);
  const link = useCmsText(`homeV2.forWhom.persona${n}Link`);
  return (
    <a href={href} className="persona">
      <div className="persona-icon">{icon}</div>
      <h3 style={title.style}>{title.text}</h3>
      <p style={desc.style}>{desc.text}</p>
      <span className="persona-link" style={link.style}>
        {link.text} <span>←</span>
      </span>
    </a>
  );
}
