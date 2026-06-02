/**
 * WhyThisItem
 * ───────────────────────────────────────────────────────────
 * Layer-1 disclosure that tells the user WHY this specific item
 * is in their timeline at this moment.
 *
 * Sourced from journey_match_rules.rationale_he / rationale_en
 * via the matched_by_rule_id FK on journey_scheduled_items.
 *
 * Visual: subtle wine-accent disclosure with a small ⓘ glyph.
 * Should never feel like a marketing line — it's an attribution
 * the user can trust.
 */

"use client";

import { Sparkles } from "lucide-react";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

interface Props {
  /** Retained for backwards-compat; CMS lookup is locale-aware via the
   *  context, so this isn't read inside the component anymore. */
  isHe?: boolean;
  rationale: string | null;
}

export function WhyThisItem({ rationale }: Props) {
  const ariaLabel = useCmsText("journeyTimeline.whyThisItem.ariaLabel").text;
  const fallback = useCmsText("journeyTimeline.whyThisItem.fallbackRationale").text;
  // No attribution → render a quiet generic line so the user still
  // sees a "why" entry. Better than blank space, better than fake
  // certainty about content we can't attribute.
  const text = rationale ?? fallback;

  return (
    <aside
      className="mt-5 flex items-start gap-3 rounded-2xl border border-[#FCCA65]/25 bg-gradient-to-br from-[#FCCA65]/[0.10] via-[#FCCA65]/[0.04] to-transparent px-4 py-3"
      aria-label={ariaLabel}
    >
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FCCA65]/20 text-[#FAF6F7]"
      >
        <Sparkles className="h-3 w-3" />
      </span>
      <div className="min-w-0">
        <CmsText
          cmsKey="journeyTimeline.whyThisItem.heading"
          as="div"
          className="text-[11px] font-bold uppercase tracking-wider text-[#FAF6F7]/75"
        />
        <p className="mt-0.5 text-[14px] leading-[1.55] text-white/85">
          {text}
        </p>
      </div>
    </aside>
  );
}
