"use client";

import { RevealOnScroll } from "./RevealOnScroll";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Education — narrative-only.
 *
 * 2026-05-18 — the 4 stats block (67%, 3 דק׳, ×4, 30 יום) was removed
 * per Itzik. Itzik's brief for the new Intimacy section was explicit:
 * "אסור להוסיף מספרים סטטיסטיים בלי מקור" (no unsourced statistics).
 * The Counter / useCmsText imports and stat keys in messages/*.json
 * are intentionally left untouched so the surface can be re-introduced
 * later if a sourced version is authored.
 *
 * Visually: the surviving narrative used to live in the start half of
 * a 2-column `.edu-grid`. With the stats gone, the grid degrades to
 * a single column that stretches the narrative to the container width.
 * `.edu-grid` style is unchanged because flex/grid collapse cleanly
 * when only one child is present.
 */
export function Education() {
  return (
    <section className="education">
      <div className="edu-orb"></div>
      <div className="edu-particles">
        <span className="edu-particle"></span>
        <span className="edu-particle"></span>
        <span className="edu-particle"></span>
        <span className="edu-particle"></span>
        <span className="edu-particle"></span>
      </div>
      <div className="container">
        <div className="edu-grid">
          <RevealOnScroll variant="fade-up">
            <div>
              <CmsText cmsKey="homeV2.education.eyebrow" as="div" className="eyebrow" />
              <CmsText cmsKey="homeV2.education.headline" as="h2" />
              <CmsText cmsKey="homeV2.education.body" as="p" />
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
