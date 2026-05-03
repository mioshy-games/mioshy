"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { GameConfig, Question } from "@/lib/snakes/types";
import { cn } from "@/lib/utils";

/**
 * QuestionModal - slides/scales IN from the exact cell on the board where
 * the current player's token is sitting. This makes it feel like the
 * question is erupting out of the tile they just landed on, not a detached
 * floating modal. When `originPct` is null we fall back to a gentle centered
 * pop-in.
 *
 * `originPct` is a `{ xPct, yPct }` coordinate expressed as percentages of
 * the parent board's bounding box (same coordinate space we use for
 * players/SVG). We render the modal inside the same positioned parent as
 * the board, so these percentages map directly to a transform origin.
 */
export function QuestionModal({
  open,
  question,
  playerName,
  avatar,
  onAnswer,
}: {
  open: boolean;
  question: Question | null;
  playerName: string;
  avatar: string;
  onAnswer: (didAnswer: boolean) => void;
  penalty: Pick<GameConfig, "penaltyType" | "penaltySteps">;
  /** Previously used to anchor the popup to a board cell. Removed —
   *  on small screens the board fills the viewport and any cell-based
   *  positioning pushed the modal off the edge. The modal is now
   *  always centered. Prop kept in the type so existing callers don't
   *  break; the value is intentionally ignored. */
  originPct?: { xPct: number; yPct: number } | null;
}) {
  // Skip/penalty text removed — the modal now has only one action (close)
  // so there is no "skip" path-and therefore no penalty to warn about.

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Dim the rest of the page while the modal is up */}
          <motion.div
            key="question-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
            onClick={() => onAnswer(true)}
          />

          {/* Always-centered modal — uses fixed inset 0 + flex center
              so on mobile (small viewports) the popup never gets cut
              by the board's edge. The scale-up animation still plays
              from center, which on small screens reads cleaner than
              anchoring to a far-corner cell. */}
          <motion.div
            key="question-anchor"
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              className={cn(
                "pointer-events-auto w-[min(92vw,38rem)] max-h-[88vh] overflow-y-auto rounded-3xl border border-amber-200/30",
                "bg-[rgba(2,6,23,0.94)] p-5 text-slate-100 shadow-2xl",
              )}
              style={{ transformOrigin: "center center" }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              dir="rtl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{avatar}</span>
                  <div>
                    <div className="text-sm text-slate-300">תור של</div>
                    <div className="text-lg font-bold">{playerName}</div>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    question?.type === "challenge"
                      ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                      : "border-cyan-300/30 bg-cyan-500/10 text-cyan-200",
                  )}
                >
                  {question?.type === "challenge" ? "אתגר" : "שאלה"}
                </span>
              </div>

              <div className="mt-5 text-xl font-bold leading-relaxed">
                {question?.text_he ?? "—"}
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => onAnswer(true)}
                  className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-base font-bold text-white shadow-lg hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  סגור ✓
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
