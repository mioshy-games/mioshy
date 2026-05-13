"use client";

// Side-effect import: ensures the v2 scoped styles are loaded whenever
// AdultGames is rendered, even on pages that don't import HomepageV2.
// Safe because CSS imports are de-duplicated by Next.js.
import "./styles.css";
import { Link } from "@/navigation";
import { CmsText } from "@/components/cms/CmsText";

/**
 * AdultGames — "Mioshy's Sex Rules" manifesto section.
 * Sprint 4 #1 closeout: every DOM text via <CmsText>. headline +
 * closer + lead are pre-marked is_rich, so dangerouslySetInnerHTML
 * kicks in automatically; the pillars and trust strip stay plain.
 */
export function AdultGames() {
  return (
    <section className="adult-games" id="adult-games">
      <span className="ag-aura ag-aura-1" aria-hidden="true"></span>
      <span className="ag-aura ag-aura-2" aria-hidden="true"></span>

      <div className="ag-frame">
        <div className="ag-stage">
          <div className="ag-pills">
            <CmsText cmsKey="homeV2.adultGames.pill1" className="ag-pill" />
            <CmsText cmsKey="homeV2.adultGames.pill2" className="ag-pill" />
            <CmsText cmsKey="homeV2.adultGames.pill3" className="ag-pill" />
          </div>

          <CmsText cmsKey="homeV2.adultGames.eyebrow" className="ag-eyebrow" />

          <CmsText cmsKey="homeV2.adultGames.headline" as="h2" />
          <CmsText cmsKey="homeV2.adultGames.lead" as="p" className="ag-lead" />

          <div className="ag-pillars">
            <article className="ag-pillar">
              <span className="ag-pillar-num">I</span>
              <CmsText cmsKey="homeV2.adultGames.pillar1Title" as="h3" />
              <CmsText cmsKey="homeV2.adultGames.pillar1Body" as="p" />
            </article>
            <article className="ag-pillar">
              <span className="ag-pillar-num">II</span>
              <CmsText cmsKey="homeV2.adultGames.pillar2Title" as="h3" />
              <CmsText cmsKey="homeV2.adultGames.pillar2Body" as="p" />
            </article>
            <article className="ag-pillar">
              <span className="ag-pillar-num">III</span>
              <CmsText cmsKey="homeV2.adultGames.pillar3Title" as="h3" />
              <CmsText cmsKey="homeV2.adultGames.pillar3Body" as="p" />
            </article>
          </div>

          <div className="ag-signature">
            <span className="ag-signature-line" aria-hidden="true"></span>
            <CmsText cmsKey="homeV2.adultGames.signature" as="em" />
            <span className="ag-signature-line" aria-hidden="true"></span>
          </div>

          <div className="ag-closer">
            <CmsText
              cmsKey="homeV2.adultGames.closer"
              as="h3"
              className="ag-closer-statement"
            />
            <Link href="/mioshy-sex" className="ag-closer-cta">
              <CmsText cmsKey="homeV2.adultGames.cta" />
            </Link>
            <div className="ag-closer-trust">
              <CmsText cmsKey="homeV2.adultGames.trust1" />
              <CmsText cmsKey="homeV2.adultGames.trust2" />
              <CmsText cmsKey="homeV2.adultGames.trust3" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
