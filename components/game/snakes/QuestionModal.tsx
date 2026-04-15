"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { GameConfig, Question } from "@/lib/snakes/types";
import { cn } from "@/lib/utils";

export function QuestionModal({
  open,
  question,
  playerName,
  avatar,
  onAnswer,
  penalty,
}: {
  open: boolean;
  question: Question | null;
  playerName: string;
  avatar: string;
  onAnswer: (didAnswer: boolean) => void;
  penalty: Pick<GameConfig, "penaltyType" | "penaltySteps">;
}) {
  const penaltyText =
    penalty.penaltyType === "start"
      ? "דילוג = חזרה להתחלה"
      : `דילוג = חזרה ${penalty.penaltySteps} צעדים`;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cn(
              "w-full max-w-xl rounded-3xl border border-slate-700/60",
              "bg-[rgba(2,6,23,0.92)] p-6 text-slate-100 shadow-2xl",
            )}
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
      ) : null}
    </AnimatePresence>
  );
}

