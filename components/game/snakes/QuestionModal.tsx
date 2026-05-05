"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "next-intl";
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
  const locale = useLocale();
  const isHe = locale === "he";
  // Skip/penalty text removed — the modal now has only one action (close)
  // so there is no "skip" path-and therefore no penalty to warn about.

  // Round 7 (2026-05-05) redesign per Itzik:
  //   1. The player's name is now part of the QUESTION TEXT itself
  //      ("Sarah, your task is …") instead of a separate "תור של" header.
  //      The vocative reads warmer and personalises the prompt.
  //   2. Cyan/blue accents replaced with the intimate-dark palette
  //      (wine red + gold) that matches the rest of the snakes board.
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
            className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm"
            onClick={() => onAnswer(true)}
          />

          <motion.div
            key="question-anchor"
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              className={cn(
                "pointer-events-auto w-[min(92vw,42rem)] max-h-[88vh] overflow-y-auto rounded-3xl border border-[#C9A961]/35",
                // Round 8 (2026-05-05) per Itzik: simple black with mild
                // transparency, replacing the wine radial that was hard
                // to read text on.
                "bg-black/85 backdrop-blur-md",
                "p-7 sm:p-9 text-white shadow-[0_28px_70px_-18px_rgba(0,0,0,0.95)]",
              )}
              style={{ transformOrigin: "center center" }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              dir={isHe ? "rtl" : "ltr"}
            >
              {/* Top row: avatar circle + question-type tag */}
              <div className="flex items-center justify-between gap-4">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full border-2 text-3xl"
                  style={{
                    borderColor: "#C9A961",
                    background: "rgba(201,169,97,0.12)",
                  }}
                  aria-hidden
                >
                  {avatar}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-semibold tracking-wide",
                    question?.type === "challenge"
                      ? "border-[#9b2235]/55 bg-[#9b2235]/15 text-[#f0c4cc]"
                      : "border-[#C9A961]/45 bg-[#C9A961]/10 text-[#E6CB85]",
                  )}
                >
                  {question?.type === "challenge"
                    ? isHe ? "אתגר" : "Challenge"
                    : isHe ? "שאלה" : "Question"}
                </span>
              </div>

              {/* Question body — bumped from 22px → 28-32px per Itzik
                  round 8. Black bg makes white text easy to read at the
                  larger size. Player's name in a warm gold (their color
                  was overriding to a hex string anyway). */}
              <div
                className={cn(
                  "mt-6 text-[28px] sm:text-[32px] font-semibold leading-snug",
                  "font-['Playfair_Display',Georgia,serif]",
                )}
              >
                <span className="text-[#E6CB85]">{playerName}</span>
                <span className="text-white">
                  {", "}
                  {/* Pick the user's language version of the prompt
                      (text_he vs text_en). DB content is NOT modified —
                      this is purely the locale-aware selection. Itzik
                      2026-05-05: keep task wording untouched, only
                      route to the right language column. */}
                  {(isHe ? question?.text_he : question?.text_en) ??
                    question?.text_he ??
                    "—"}
                </span>
              </div>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => onAnswer(true)}
                  className={cn(
                    "w-full min-h-[56px] rounded-2xl px-6 py-4 text-lg font-bold text-white shadow-lg",
                    // Round 8: pure black button with white text and a
                    // gold hairline border so it pops on the black
                    // popup but stays in the dark palette. The previous
                    // wine→gold gradient was illegible against the
                    // popup body.
                    "bg-black border border-[#C9A961]/55",
                    "hover:bg-stone-900 active:scale-[0.98] transition-all",
                  )}
                >
                  {isHe ? "סגור ✓" : "Done ✓"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
