"use client";

import { motion } from "framer-motion";
import type { Locale } from "@/lib/journey/types";

interface ProgressBarProps {
  current: number;
  total: number;
  lockedAt?: number; // optional: marker showing where paywall/auth locks are
  /** Journey light-theme redesign (2026-07-01). "dark" (default) keeps the
   *  legacy dark styling used by the intimacy/friendship assessments flow
   *  (components/assessments/AssessmentClient) UNCHANGED. "light" renders the
   *  clean light theme per docs/journey-assessment-redesign-workorder.md:
   *  a single centered "שאלה X מתוך Y" count ABOVE a warm hairline track with
   *  a brand-gradient fill. */
  variant?: "light" | "dark";
  /** Only used by the light variant to phrase the centered count naturally
   *  ("שאלה X מתוך Y" / "Question X of Y"). */
  locale?: Locale;
}

// Brand accent gradient — accents only (matches the v6 mockup / spec §5).
const BRAND_GRADIENT =
  "linear-gradient(95deg,#6C5CE7 0%,#D6409F 52%,#F79154 100%)";

export function ProgressBar({
  current,
  total,
  lockedAt,
  variant = "dark",
  locale = "he",
}: ProgressBarProps) {
  const pct = Math.min(100, Math.round((current / total) * 100));
  const lockPct = lockedAt !== undefined ? Math.round((lockedAt / total) * 100) : null;

  // ── Light variant (journey redesign) ────────────────────────────────────
  if (variant === "light") {
    // Displayed question number is 1-based and matches the mockup, which
    // fills to (i+1)/total on the first question. `current` is the 0-based
    // count of questions completed before the active one.
    const shown = Math.min(total, current + 1);
    const shownPct = Math.min(100, Math.round((shown / total) * 100));
    const countLabel =
      locale === "he"
        ? `שאלה ${shown} מתוך ${total}`
        : `Question ${shown} of ${total}`;
    return (
      <div className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-[10px] md:max-w-[560px]">
        <div className="text-center text-[14px] font-bold text-[#4a4441]">
          {countLabel}
        </div>
        <div
          className="relative h-[5px] w-full overflow-hidden rounded-full bg-[#f0e8db]"
          role="progressbar"
          aria-valuenow={shown}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuetext={countLabel}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: BRAND_GRADIENT }}
            initial={{ width: 0 }}
            animate={{ width: `${shownPct}%` }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      </div>
    );
  }

  // ── Dark variant (unchanged — assessments flow) ─────────────────────────
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm text-white/80">
        <span>{current} / {total}</span>
        <span>{pct}%</span>
      </div>
      {/* a11y (M10): expose progress to assistive tech. */}
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuetext={`${current} / ${total}`}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-fuchsia-400 to-pink-300"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
        />
        {lockPct !== null ? (
          <div
            className="absolute inset-y-0 w-px bg-white/40"
            style={{ left: `${lockPct}%` }}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
