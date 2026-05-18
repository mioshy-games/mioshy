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
            </div>

            <div className="cg-stats">
              <div className="cg-stat">
                <CmsText
                  cmsKey="homeV2.couplesGames.statTasks"
                  as="div"
                  className="num"
                />
                <CmsText
                  cmsKey="homeV2.couplesGames.statTasksLabel"
                  as="div"
                  className="label"
                />
              </div>
              <div className="cg-stat">
                <CmsText
                  cmsKey="homeV2.couplesGames.statRecs"
                  as="div"
                  className="num"
                />
                <CmsText
                  cmsKey="homeV2.couplesGames.statRecsLabel"
                  as="div"
                  className="label"
                />
              </div>
              <div className="cg-stat">
                <CmsText
                  cmsKey="homeV2.couplesGames.statLevels"
                  as="div"
                  className="num"
                />
                <CmsText
                  cmsKey="homeV2.couplesGames.statLevelsLabel"
                  as="div"
                  className="label"
                />
              </div>
            </div>

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
        <div className="cg-card-title">
          <CmsText cmsKey={`homeV2.couplesGames.card${n}TitleLine1`} />
          <br />
          <CmsText cmsKey={`homeV2.couplesGames.card${n}TitleLine2`} />
        </div>
      </div>
    </div>
  );
}
