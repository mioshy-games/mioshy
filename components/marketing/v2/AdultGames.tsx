"use client";

// Side-effect import: ensures the v2 scoped styles are loaded whenever
// AdultGames is rendered, even on pages that don't import HomepageV2.
// Safe because CSS imports are de-duplicated by Next.js.
import "./styles.css";
import { Link } from "@/navigation";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

/**
 * AdultGames — "Mioshy's Sex Rules" (renamed from "The private chamber"
 * per Itzik 2026-05-06). Premium manifesto section with midnight wine +
 * bronze palette, 3 manifesto pillars (I/II/III), signature whisper,
 * and dramatic closer CTA → /mioshy-sex.
 *
 * CMS-migrated (Sprint 1). headline/lead/closer carry inline markup
 * (em/strong/br) and render via CmsText. Everything else is plain.
 */
export function AdultGames() {
  const pill1 = useCmsText("homeV2.adultGames.pill1");
  const pill2 = useCmsText("homeV2.adultGames.pill2");
  const pill3 = useCmsText("homeV2.adultGames.pill3");
  const eyebrow = useCmsText("homeV2.adultGames.eyebrow");
  const pillar1Title = useCmsText("homeV2.adultGames.pillar1Title");
  const pillar1Body = useCmsText("homeV2.adultGames.pillar1Body");
  const pillar2Title = useCmsText("homeV2.adultGames.pillar2Title");
  const pillar2Body = useCmsText("homeV2.adultGames.pillar2Body");
  const pillar3Title = useCmsText("homeV2.adultGames.pillar3Title");
  const pillar3Body = useCmsText("homeV2.adultGames.pillar3Body");
  const signature = useCmsText("homeV2.adultGames.signature");
  const cta = useCmsText("homeV2.adultGames.cta");
  const trust1 = useCmsText("homeV2.adultGames.trust1");
  const trust2 = useCmsText("homeV2.adultGames.trust2");
  const trust3 = useCmsText("homeV2.adultGames.trust3");

  return (
    <section className="adult-games" id="adult-games">
      <span className="ag-aura ag-aura-1" aria-hidden="true"></span>
      <span className="ag-aura ag-aura-2" aria-hidden="true"></span>

      <div className="ag-frame">
        <div className="ag-stage">
          <div className="ag-pills">
            <span className="ag-pill" style={pill1.style}>
              {pill1.text}
            </span>
            <span className="ag-pill" style={pill2.style}>
              {pill2.text}
            </span>
            <span className="ag-pill" style={pill3.style}>
              {pill3.text}
            </span>
          </div>

          <span className="ag-eyebrow" style={eyebrow.style}>
            {eyebrow.text}
          </span>

          {/* headline carries <em> + <br> */}
          <CmsText cmsKey="homeV2.adultGames.headline" as="h2" />

          {/* lead carries <strong> */}
          <CmsText cmsKey="homeV2.adultGames.lead" as="p" className="ag-lead" />

          <div className="ag-pillars">
            <article className="ag-pillar">
              <span className="ag-pillar-num">I</span>
              <h3 style={pillar1Title.style}>{pillar1Title.text}</h3>
              <p style={pillar1Body.style}>{pillar1Body.text}</p>
            </article>
            <article className="ag-pillar">
              <span className="ag-pillar-num">II</span>
              <h3 style={pillar2Title.style}>{pillar2Title.text}</h3>
              <p style={pillar2Body.style}>{pillar2Body.text}</p>
            </article>
            <article className="ag-pillar">
              <span className="ag-pillar-num">III</span>
              <h3 style={pillar3Title.style}>{pillar3Title.text}</h3>
              <p style={pillar3Body.style}>{pillar3Body.text}</p>
            </article>
          </div>

          <div className="ag-signature">
            <span className="ag-signature-line" aria-hidden="true"></span>
            <em style={signature.style}>{signature.text}</em>
            <span className="ag-signature-line" aria-hidden="true"></span>
          </div>

          <div className="ag-closer">
            {/* closer carries <em> + <br> */}
            <CmsText
              cmsKey="homeV2.adultGames.closer"
              as="h3"
              className="ag-closer-statement"
            />
            <Link href="/mioshy-sex" className="ag-closer-cta">
              {cta.text}
            </Link>
            <div className="ag-closer-trust">
              <span style={trust1.style}>{trust1.text}</span>
              <span style={trust2.style}>{trust2.text}</span>
              <span style={trust3.style}>{trust3.text}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
