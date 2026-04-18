"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DiceResult } from "@/lib/snakes/types";

/**
 * Dice — primary turn mechanic. Replaces CoinFlip.
 *
 * Behavior:
 *   • Large, thumb-friendly target (min 120px) — works on phones without
 *     zooming the board.
 *   • When the parent reports a new `result`, the die tumbles for ~900ms
 *     showing rapidly changing faces, then snaps to the final face.
 *   • While tumbling, the button is disabled so the user can't double-roll.
 *   • Fully RTL-safe; the visual is language-agnostic (pips only).
 */

const PIP_POSITIONS: Record<DiceResult, Array<[number, number]>> = {
  // Each coordinate is a (col, row) from a 3×3 grid, 0..2
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

function DieFace({ value, color }: { value: DiceResult; color: string }) {
  const pips = PIP_POSITIONS[value];
  return (
    <div
      className="relative grid h-full w-full grid-cols-3 grid-rows-3 place-items-center rounded-[22%] border border-white/25 p-[14%] shadow-inner"
      style={{
        background: `linear-gradient(140deg, #fff7ed 0%, #fde68a 55%, #fcd34d 100%)`,
      }}
      aria-hidden
    >
      {Array.from({ length: 9 }).map((_, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const isPip = pips.some(([c, r]) => c === col && r === row);
        return (
          <span
            key={i}
            className={cn(
              "h-[65%] w-[65%] rounded-full transition-opacity",
              isPip ? "opacity-100 shadow-[inset_0_2px_2px_rgba(0,0,0,0.35)]" : "opacity-0",
            )}
            style={{ background: isPip ? color : "transparent" }}
          />
        );
      })}
    </div>
  );
}

export function Dice({
  onRoll,
  disabled,
  result,
  playerColor = "#7c3aed",
  label = "הטל/י קובייה",
  tumblingFor = 900,
}: {
  /** Called when the user taps the die. Should eventually cause `result` to change. */
  onRoll: () => void | Promise<void>;
  /** When true, the die is inert (not current player's turn, or mid-tumble). */
  disabled?: boolean;
  /** The canonical dice value from game state. Changing this triggers a tumble. */
  result: DiceResult | null;
  /** Pip color — used to personalize the die to the current player. */
  playerColor?: string;
  /** Localized button label shown below the die. */
  label?: string;
  /** How long to show random faces before snapping to `result`. */
  tumblingFor?: number;
}) {
  const [tumbling, setTumbling] = useState(false);
  const [displayValue, setDisplayValue] = useState<DiceResult>(result ?? 1);

  // When result changes, tumble for a moment then snap to the new result.
  useEffect(() => {
    if (result == null) {
      setDisplayValue(1);
      return;
    }
    setTumbling(true);
    const startedAt = Date.now();
    const interval = setInterval(() => {
      // Show a random face, but never the final one during tumble
      let next = (Math.floor(Math.random() * 6) + 1) as DiceResult;
      if (next === result && Math.random() > 0.3) {
        next = (((next % 6) + 1) as DiceResult);
      }
      setDisplayValue(next);
      if (Date.now() - startedAt >= tumblingFor) {
        clearInterval(interval);
        setDisplayValue(result);
        setTumbling(false);
      }
    }, 80);
    return () => clearInterval(interval);
  }, [result, tumblingFor]);

  const canRoll = !disabled && !tumbling;

  const rollTransition = useMemo<Transition>(
    () => ({ type: "spring", stiffness: 220, damping: 18 }),
    [],
  );

  return (
    <div className="flex flex-col items-center gap-3" dir="rtl">
      <motion.button
        type="button"
        onClick={() => {
          if (!canRoll) return;
          void onRoll();
        }}
        disabled={!canRoll}
        aria-label={label}
        className={cn(
          "relative h-28 w-28 select-none rounded-[22%] outline-none sm:h-32 sm:w-32",
          "focus-visible:ring-4 focus-visible:ring-amber-300/60",
          canRoll ? "cursor-pointer" : "cursor-not-allowed opacity-70",
        )}
        whileTap={canRoll ? { scale: 0.93 } : undefined}
        animate={
          tumbling
            ? { rotate: [0, -18, 20, -10, 14, 0], y: [0, -8, 0, -4, 0] }
            : { rotate: 0, y: 0 }
        }
        transition={tumbling ? { duration: tumblingFor / 1000, ease: "easeOut" } : rollTransition}
        style={{
          filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.35))",
        }}
      >
        <DieFace value={displayValue} color={playerColor} />
      </motion.button>

      <div className="text-sm font-semibold text-amber-50/90">
        {tumbling ? "…" : canRoll ? label : disabled ? "ממתין לתור שלך" : label}
      </div>
    </div>
  );
}
