"use client";

import { Link } from "@/navigation";
import { CmsText } from "@/components/cms/CmsText";

/**
 * CouplesGames — text on the right, fanned card stack on the left.
 * Sprint 4 #1 closeout — every DOM text via <CmsText>. The headline
 * stays composed inline because `headlineMark` is rendered inside a
 * styled `<span className="text-mark">` that highlights it visually.
 */
export function CouplesGames() {
  return (
    <section className="couples-games" id="couples-games">
      <div className="container">
        <div className="cg-grid">
          <div className="cg-text">
            <CmsText cmsKey="homeV2.couplesGames.eyebrow" as="div" className="eyebrow" />
            <h2>
              <CmsText cmsKey="homeV2.couplesGames.headlinePart1" />
              <br />
              <CmsText
                cmsKey="homeV2.couplesGames.headlineMark"
                className="text-mark"
              />
              <CmsText cmsKey="homeV2.couplesGames.headlinePart2" />
            </h2>
            <CmsText cmsKey="homeV2.couplesGames.lead" as="p" className="lead" />

            <div className="cg-callout">
              <CmsText cmsKey="homeV2.couplesGames.callout" as="p" />
              {/* Attribution name below the quote — added 2026-05-19
                  per Itzik. Hebrew "ענת", English a non-Israeli name
                  ("Sarah"). Styling lives in `.cg-callout-name` —
                  bold, not italic, slightly muted color. */}
              <CmsText
                cmsKey="homeV2.couplesGames.calloutName"
                as="p"
                className="cg-callout-name"
              />
            </div>

            {/* Stats block (+500 משימות, +100 המלצות, 3 רמות) removed
                2026-05-19 per Itzik — the numbers were marketing claims
                without a verifiable source, same rule that took out the
                Education section's 67%/4x/30 stats earlier in the day.
                The 6 CMS keys (statTasks / statTasksLabel + statRecs /
                statRecsLabel + statLevels / statLevelsLabel) and the
                `.cg-stats` / `.cg-stat` CSS rules stay on disk for
                possible re-use once a sourced replacement is authored. */}

            <div className="cg-actions">
              <Link href="/games" className="btn btn-primary">
                <CmsText cmsKey="homeV2.couplesGames.ctaPrimary" />
              </Link>
            </div>
          </div>

          <div className="cg-visual">
            <CgCard n={3} />
            <CgCard n={2} />
            <CgCard n={1} />
          </div>
        </div>
      </div>
    </section>
  );
}

function CgCard({ n }: { n: 1 | 2 | 3 }) {
  return (
    <div className={`cg-card cg-card-${n}`}>
      <div className="cg-card-noise"></div>
      <div className="cg-card-content">
        <CmsText
          cmsKey={`homeV2.couplesGames.card${n}Tag`}
          as="div"
          className="cg-card-tag"
        />
        {/* Card title overlay ("אמת או / אמת" etc.) removed 2026-05-19
            per Itzik — the user wanted clean game card images without
            text on top. CMS keys card${n}TitleLine1 / card${n}TitleLine2
            stay on disk in messages/*.json and cms_texts. */}
      </div>
    </div>
  );
}
