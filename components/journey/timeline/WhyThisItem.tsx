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

import { Sparkles } from "lucide-react";

interface Props {
  isHe: boolean;
  rationale: string | null;
}

export function WhyThisItem({ isHe, rationale }: Props) {
  // No attribution → render a quiet generic line so the user still
  // sees a "why" entry. Better than blank space, better than fake
  // certainty about content we can't attribute.
  const text =
    rationale ??
    (isHe
      ? "חלק מהמסלול שנבנה לכם."
      : "Part of the path built for you.");

  return (
    <aside
      className="mt-5 flex items-start gap-3 rounded-2xl border border-[#B83C4D]/25 bg-gradient-to-br from-[#B83C4D]/[0.10] via-[#B83C4D]/[0.04] to-transparent px-4 py-3"
      aria-label={isHe ? "למה הפריט הזה אצלכם" : "Why this item is here"}
    >
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#B83C4D]/20 text-[#FAF6F7]"
      >
        <Sparkles className="h-3 w-3" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#FAF6F7]/75">
          {isHe ? "למה זה אצלכם" : "Why this is here"}
        </div>
        <p className="mt-0.5 text-[14px] leading-[1.55] text-white/85">
          {text}
        </p>
      </div>
    </aside>
  );
}
