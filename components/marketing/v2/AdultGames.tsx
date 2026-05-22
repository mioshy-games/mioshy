// PERF 2026-05-21 — manifesto-style section with no client features.
// Three <article> pillars + CTA. Removed "use client" → Server
// Component. The decorative <span className="ag-aura"> elements are
// pure CSS animations.
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
          {/* `.ag-pills` row (18+ · הסקס של מיאושי · פרטיות מוחלטת)
              moved 2026-05-19 per Itzik — was at the top, now sits
              just above the closing CTA so the trust signals frame
              the conversion action instead of the headline. */}

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

          {/* Signature row ("משחקי מין לאמיצים בלבד" with hairline
              flourishes) + closer headline ("אולי הגיע הזמן לדבר
              אחרת.") removed 2026-05-19 per Itzik. The CMS keys
              (homeV2.adultGames.signature, homeV2.adultGames.closer)
              and the `.ag-signature` / `.ag-closer-statement` CSS rules
              stay on disk for possible later reuse. The CTA below was
              kept as the section's terminal action. */}

          <div className="ag-closer">
            {/* Order swapped 2026-05-19 (round 2) per Itzik — the CTA
                now sits ABOVE the trust pill line so the eye lands on
                the action first, and the supporting pills read as
                reassurance below. */}
            <Link href="/mioshy-sex" className="ag-closer-cta">
              <CmsText cmsKey="homeV2.adultGames.cta" />
            </Link>
            <div className="ag-pills">
              <CmsText cmsKey="homeV2.adultGames.pill1" className="ag-pill" />
              <CmsText cmsKey="homeV2.adultGames.pill2" className="ag-pill" />
              <CmsText cmsKey="homeV2.adultGames.pill3" className="ag-pill" />
            </div>
            {/* Trust pill row ("כניסה לבני 18+ · מאומת על־ידי מומחים ·
                פרטיות מוחלטת") removed 2026-05-19 per Itzik. The three
                CMS keys (homeV2.adultGames.trust1/2/3) and the
                `.ag-closer-trust` CSS rules are intentionally retained
                on disk so the row can be reinstated cleanly. */}
          </div>
        </div>
      </div>
    </section>
  );
}
