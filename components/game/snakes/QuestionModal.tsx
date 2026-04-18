"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { GameConfig, Question } from "@/lib/snakes/types";
import { cn } from "@/lib/utils";

/**
 * QuestionModal — slides/scales IN from the exact cell on the board where
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
  penalty,
  originPct,
}: {
  open: boolean;
  question: Question | null;
  playerName: string;
  avatar: string;
  onAnswer: (didAnswer: boolean) => void;
  penalty: Pick<GameConfig, "penaltyType" | "penaltySteps">;
  originPct?: { xPct: number; yPct: number } | null;
}) {
  const penaltyText =
    penalty.penaltyType === "start"
      ? "דילוג = חזרה להתחלה"
      : `דילוג = חזרה ${penalty.penaltySteps} צעדים`;

  // If we have a board-cell origin, we animate the modal's transform origin
  // to match. We place the modal absolutely inside the board wrapper, grow
  // it outward, and when the board is smaller than the modal it just looks
  // like the modal is anchored to the tile — which is what we want.
  const hasOrigin = !!originPct;

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
            onClick={() => {
              /* clicking scrim does nothing — user must answer or skip */
            }}
          />

          <motion.div
            key="question-anchor"
            className={cn(
              hasOrigin
                ? "pointer-events-none absolute inset-0 z-50"
                : "pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4",
            )}
          >
            <motion.div
              className={cn(
                "pointer-events-auto w-[min(92vw,38rem)] rounded-3xl border border-amber-200/30",
                "bg-[rgba(2,6,23,0.94)] p-5 text-slate-100 shadow-2xl",
                hasOrigin ? "absolute" : "",
              )}
              // Center the modal on the viewport but launch the scale/opacity
              // transform from the board cell's position so the reveal feels
              // anchored to the player's tile.
              style={
                hasOrigin
                  ? {
                      left: `${originPct!.xPct}%`,
                      top: `${originPct!.yPct}%`,
                      translateX: "-50%",
                      translateY: "-50%",
                      transformOrigin: "center center",
                    }
                  : undefined
              }
              initial={{ opacity: 0, scale: 0.15 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.2 }}
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

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => onAnswer(true)}
                  className="min-h-[48px] rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-bold text-white hover:brightness-110"
                >
                  ✅ ענה / עשה
                </button>
                <button
                  type="button"
                  onClick={() => onAnswer(false)}
                  className="min-h-[48px] rounded-2xl border border-slate-600/60 bg-white/5 px-4 py-3 text-sm font-bold text-slate-100 hover:bg-white/10"
                >
                  ❌ דלג
                </button>
              </div>

              <p className="mt-4 text-xs text-slate-300/80">{penaltyText}</p>
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
