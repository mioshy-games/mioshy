"use client";

import { Link } from "@/navigation";
import { useCmsText } from "@/hooks/useCmsText";

/**
 * CouplesGames - energetic two-column section with text content on the
 * right (RTL) and a fanned stack of 3 game cards on the left.
 *
 * CMS-migrated (Sprint 1). Plain text throughout — the headline is
 * split into 3 parts so the styled `.text-mark` span on the middle
 * word keeps its emphasis without HTML markup in the JSON.
 */
export function CouplesGames() {
  const eyebrow = useCmsText("homeV2.couplesGames.eyebrow");
  const headlinePart1 = useCmsText("homeV2.couplesGames.headlinePart1");
  const headlineMark = useCmsText("homeV2.couplesGames.headlineMark");
  const headlinePart2 = useCmsText("homeV2.couplesGames.headlinePart2");
  const lead = useCmsText("homeV2.couplesGames.lead");
  const callout = useCmsText("homeV2.couplesGames.callout");
  const statTasks = useCmsText("homeV2.couplesGames.statTasks");
  const statTasksLabel = useCmsText("homeV2.couplesGames.statTasksLabel");
  const statRecs = useCmsText("homeV2.couplesGames.statRecs");
  const statRecsLabel = useCmsText("homeV2.couplesGames.statRecsLabel");
  const statLevels = useCmsText("homeV2.couplesGames.statLevels");
  const statLevelsLabel = useCmsText("homeV2.couplesGames.statLevelsLabel");
  const ctaPrimary = useCmsText("homeV2.couplesGames.ctaPrimary");

  const card1Tag = useCmsText("homeV2.couplesGames.card1Tag");
  const card1TitleLine1 = useCmsText("homeV2.couplesGames.card1TitleLine1");
  const card1TitleLine2 = useCmsText("homeV2.couplesGames.card1TitleLine2");
  const card2Tag = useCmsText("homeV2.couplesGames.card2Tag");
  const card2TitleLine1 = useCmsText("homeV2.couplesGames.card2TitleLine1");
  const card2TitleLine2 = useCmsText("homeV2.couplesGames.card2TitleLine2");
  const card3Tag = useCmsText("homeV2.couplesGames.card3Tag");
  const card3TitleLine1 = useCmsText("homeV2.couplesGames.card3TitleLine1");
  const card3TitleLine2 = useCmsText("homeV2.couplesGames.card3TitleLine2");

  return (
    <section className="couples-games" id="couples-games">
      <div className="container">
        <div className="cg-grid">
          <div className="cg-text">
            <div className="eyebrow" style={eyebrow.style}>
              {eyebrow.text}
            </div>
            <h2>
              {headlinePart1.text}
              <br />
              <span className="text-mark">{headlineMark.text}</span>
              {headlinePart2.text}
            </h2>
            <p className="lead" style={lead.style}>
              {lead.text}
            </p>

            <div className="cg-callout">
              <p style={callout.style}>{callout.text}</p>
            </div>

            <div className="cg-stats">
              <div className="cg-stat">
                <div className="num" style={statTasks.style}>
                  {statTasks.text}
                </div>
                <div className="label" style={statTasksLabel.style}>
                  {statTasksLabel.text}
                </div>
              </div>
              <div className="cg-stat">
                <div className="num" style={statRecs.style}>
                  {statRecs.text}
                </div>
                <div className="label" style={statRecsLabel.style}>
                  {statRecsLabel.text}
                </div>
              </div>
              <div className="cg-stat">
                <div className="num" style={statLevels.style}>
                  {statLevels.text}
                </div>
                <div className="label" style={statLevelsLabel.style}>
                  {statLevelsLabel.text}
                </div>
              </div>
            </div>

            <div className="cg-actions">
              <Link href="/games" className="btn btn-primary">
                {ctaPrimary.text} <span className="arrow">←</span>
              </Link>
            </div>
          </div>

          <div className="cg-visual">
            <div className="cg-card cg-card-3">
              <div className="cg-card-noise"></div>
              <div className="cg-card-content">
                <div className="cg-card-tag" style={card3Tag.style}>
                  {card3Tag.text}
                </div>
                <div className="cg-card-title">
                  {card3TitleLine1.text}
                  <br />
                  {card3TitleLine2.text}
                </div>
              </div>
            </div>
            <div className="cg-card cg-card-2">
              <div className="cg-card-noise"></div>
              <div className="cg-card-content">
                <div className="cg-card-tag" style={card2Tag.style}>
                  {card2Tag.text}
                </div>
                <div className="cg-card-title">
                  {card2TitleLine1.text}
                  <br />
                  {card2TitleLine2.text}
                </div>
              </div>
            </div>
            <div className="cg-card cg-card-1">
              <div className="cg-card-noise"></div>
              <div className="cg-card-content">
                <div className="cg-card-tag" style={card1Tag.style}>
                  {card1Tag.text}
                </div>
                <div className="cg-card-title">
                  {card1TitleLine1.text}
                  <br />
                  {card1TitleLine2.text}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
