// ============================================================
// components/my/JourneyAnalysisCard.tsx
//
// Compact post-purchase read of the user's assessment analysis.
//
// Sits on /my/journey above the desk (after JourneyKickoffCards),
// so a paying user lands on their dashboard and can see — at a
// glance — the actual numeric output of the assessment they took:
//   • the 3 headline scores (friendship / conflict / passion-risk)
//   • a short narrative excerpt
//   • the resolved focus area (#1 priority label)
//
// This is intentionally NOT the full /journey/assessment
// AnalysisSummary screen. That one is the marketing/CTA closer
// for the funnel; here the user has already paid, so the leaner
// readout matches the dashboard's calm slate-glass tone (no
// gradients, no upsell, no "what you'll gain" panel).
//
// Server component — receives an already-loaded Analysis row.
// Returns null when there's no analysis to render, so the
// containing /my/journey page can drop it in unconditionally.
// ============================================================

import { CheckCircle2, Sparkles } from "lucide-react";
import type { Analysis } from "@/lib/journey/types";
import { CmsText } from "@/components/cms/CmsText";

interface Props {
  analysis: Analysis | null;
  isHe: boolean;
  /** Resolved label for the user's #1 priority, already localized.
   *  Comes from `priorityLabels` upstream so we don't duplicate the
   *  lookup. May be null when the user skipped ranking. */
  focusLabel: string | null;
}

export function JourneyAnalysisCard({ analysis, isHe, focusLabel }: Props) {
  if (!analysis) return null;

  const narrative = isHe
    ? analysis.summary.narrative_he
    : analysis.summary.narrative_en;

  // Top 3 recommendations only — the dashboard surfaces a digest, not
  // the whole list. The full set still lives on /journey/assessment
  // via the AnalysisSummary component, and the admin sees all of them
  // in /dashboard/users/[id].
  const recs = (analysis.summary.recommendations ?? []).slice(0, 3);

  return (
    <section
      className="mt-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-950/55 p-5 backdrop-blur-md sm:p-7"
      dir={isHe ? "rtl" : "ltr"}
      aria-label="Assessment analysis"
    >
      {/* Eyebrow + title */}
      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs">
        <Sparkles className="h-3.5 w-3.5 text-white/70" />
        <span className="font-semibold text-white/85">
          <CmsText cmsKey="myJourney.analysisCard.eyebrow" />
        </span>
      </div>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        <CmsText cmsKey="myJourney.analysisCard.title" />
      </h2>
      {focusLabel ? (
        <p className="mt-1 text-[15px] text-white/65">
          <CmsText cmsKey="myJourney.analysisCard.focusPrefix" />
          <span className="ms-1 font-semibold text-white">{focusLabel}</span>
        </p>
      ) : null}

      {/* Score row — 3 cards, same visual language as AnalysisSummary's
          ScoreCard but lifted into this file so the card stays self-
          contained (no client component import, no useState). */}
      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        <ScorePill
          labelKey="myJourney.analysisCard.friendship"
          value={analysis.friendship_score}
        />
        <ScorePill
          labelKey="myJourney.analysisCard.conflict"
          value={analysis.conflict_health}
        />
        <ScorePill
          labelKey="myJourney.analysisCard.passion"
          value={analysis.passion_risk}
          invert
        />
      </div>

      {/* Narrative */}
      {narrative ? (
        <p className="mt-5 text-[17px] leading-[1.65] text-white/90">
          {narrative}
        </p>
      ) : null}

      {/* Top 3 recommendations */}
      {recs.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2">
          {recs.map((rec) => (
            <li
              key={rec.id}
              className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3"
            >
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-[#B83C4D]"
                aria-hidden
              />
              <span className="text-[15px] leading-[1.55] text-white/85">
                {isHe ? rec.he : rec.en}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Local ScorePill — compact variant of AnalysisSummary's ScoreCard.
// Same color logic (invert flips emerald↔rose for risk axes) but
// dashboard-sized so the 3 cards fit on a mobile row without wrap.
// ─────────────────────────────────────────────────────────────────────

function ScorePill({
  labelKey,
  value,
  invert = false,
}: {
  labelKey: string;
  value: number;
  invert?: boolean;
}) {
  const tone = invert
    ? value >= 60
      ? "text-rose-300"
      : "text-emerald-300"
    : value >= 60
      ? "text-emerald-300"
      : "text-amber-300";
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-center">
      <CmsText
        cmsKey={labelKey}
        as="div"
        className="text-[12px] font-medium text-white/65 sm:text-[13px]"
      />
      <div className={`mt-0.5 text-[22px] font-extrabold leading-none sm:text-[26px] ${tone}`}>
        {value}
        <span className="ms-0.5 text-[11px] font-semibold text-white/50">
          /100
        </span>
      </div>
    </div>
  );
}
