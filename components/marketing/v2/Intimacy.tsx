"use client";

import { TrackedLink } from "./TrackedLink";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Intimacy — "how Mioshy solves it" section, slotted after Hero.
 *
 * History (2026-05-18, same day):
 *   • Initially built with two halves: a "loneliness" framing (eyebrow
 *     + headline + lead + 4 quote cards) on top, then "how Mioshy
 *     solves it" (bridge + 3 pillars + CTA) on bottom.
 *   • Itzik trimmed the top half — the loneliness framing wasn't on
 *     brand for Mioshy and was occupying expensive above-the-fold
 *     real estate. Bottom half (this file's current shape) was the
 *     part that earned the slot.
 *
 * The TOP-half JSX, the FeelsCard helper, and the corresponding CSS
 * (`.intimacy-head`, `.intimacy-feels`, `.feels-card`, `.feels-num`,
 * `.feels-quote`, `.feels-body`) are intentionally retained in the
 * codebase — the messages/he.json + en.json blocks
 * `homeV2.intimacy.eyebrow`, `headlinePart1`, `headlineEm`, `lead`,
 * `feels1..4Quote`, `feels1..4Body` also stay seeded — so the upper
 * half can be re-introduced without rewriting it.
 *
 * Current structure:
 *   1. Bridge   — small hairline rule + sub-eyebrow + h3 + body line
 *                  ("ואיך מיאושי פותרת את זה" / how Mioshy works)
 *   2. Pillars  — 3 differentiators (personal / fast & practical / playful)
 *   3. CTA pair — primary "I want to stop feeling alone" + secondary
 *                 ghost "how Mioshy works"
 *
 * All visible strings flow through <CmsText> (CMS DB → next-intl JSON →
 * key). Mobile-first: pillars collapse to one column at ≤1100px, full
 * stack at ≤640px with CTA buttons stretched to full width (44px+ tap).
 */
export function Intimacy() {
  return (
    <section className="intimacy" id="intimacy">
      <div className="container">
        {/* ─── Bridge — how Mioshy solves it ───
            Note: when the top-half (head + feels) was removed, the
            bridge became the section opener. CSS sets
            `.intimacy-bridge:first-child` margin-top to 0 so the
            section padding handles the breathing room — the original
            80px top margin assumed there was something above. */}
        <div className="intimacy-bridge">
          <CmsText
            cmsKey="homeV2.intimacy.bridgeEyebrow"
            as="div"
            className="eyebrow intimacy-bridge-eyebrow"
          />
          {/* 2026-05-20 — `bridgeHeadlineEm` removed per Itzik. The
              CMS key + JSON fallback are left intact so an admin can
              paste the inner `<em><CmsText/></em>` back later without
              a deploy. Only `bridgeHeadlinePart1` renders now. */}
          <h2 className="intimacy-bridge-head">
            <CmsText cmsKey="homeV2.intimacy.bridgeHeadlinePart1" />
          </h2>
          <CmsText
            cmsKey="homeV2.intimacy.bridgeBody"
            as="p"
            className="intimacy-bridge-body"
          />
          {/* ─── CTA — primary action.
              Moved 2026-05-19 per Itzik from after the pillars to
              right under the bridge body, so the CTA sits inside the
              bridge "moment" before the pillars elaborate the offer.
              Secondary ghost button ("איך מיאושי עובדת") was removed
              2026-05-18; key + cms_texts seed retained on disk. */}
          <div className="intimacy-cta">
            <TrackedLink
              href="/journey/assessment"
              className="btn btn-primary"
              ctaId="intimacy_assessment"
              section="intimacy"
            >
              <CmsText cmsKey="homeV2.intimacy.ctaPrimary" />
            </TrackedLink>
          </div>
          {/* Secondary, lower-commitment path to the marketing assessment page
              (SEO: internal link to /couples-assessment from the homepage). The
              primary CTA above still goes straight into /journey/assessment. */}
          <p
            style={{ marginTop: 14, textAlign: "center", fontSize: 15 }}
            className="intimacy-bridge-secondary"
          >
            <TrackedLink
              href="/couples-assessment"
              ctaId="intimacy_couples_assessment"
              section="intimacy"
              style={{
                color: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                opacity: 0.8,
              }}
            >
              <CmsText cmsKey="homeV2.intimacy.assessmentLink" />
            </TrackedLink>
            {" · "}
            {/* Same job, same row, for the survey's landing page: it had zero
                inbound internal links site-wide, so the homepage never passed
                it any authority. TrackedLink (not SurveyLink) — this goes to
                /relationship-survey, and SurveyLinkClick belongs to the
                /survey funnel from PR #46/#47. */}
            <TrackedLink
              href="/relationship-survey"
              ctaId="intimacy_relationship_survey"
              section="intimacy"
              style={{
                color: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                opacity: 0.8,
              }}
            >
              <CmsText cmsKey="homeV2.intimacy.surveyLink" />
            </TrackedLink>
          </p>
        </div>

        {/* ─── 3 pillars ─── */}
        <div className="intimacy-pillars">
          {([1, 2, 3] as const).map((n) => (
            <Pillar key={n} n={n} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Pillar — one of the three differentiators.
 * Mirrors the persona pattern in ForWhom but lighter — no card chrome,
 * just an icon glyph in a wine bubble, a serif heading, and a body
 * line. The whole pillars row reads as one composition, not 3 boxes.
 */
function Pillar({ n }: { n: 1 | 2 | 3 }) {
  return (
    <div className="intimacy-pillar">
      <CmsText
        cmsKey={`homeV2.intimacy.pillar${n}Title`}
        as="h3"
        className="pillar-title"
      />
      <CmsText
        cmsKey={`homeV2.intimacy.pillar${n}Body`}
        as="p"
        className="pillar-body"
      />
    </div>
  );
}
