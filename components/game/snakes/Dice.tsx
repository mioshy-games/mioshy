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

function DieFace({ value }: { value: DiceResult }) {
  const pips = PIP_POSITIONS[value];
  return (
    <div
      className="relative grid h-full w-full grid-cols-3 grid-rows-3 place-items-center rounded-[22%] p-[14%]"
      style={{
        // Deep velvet surface — radial highlight simulates light catching the fabric
        background:
          "radial-gradient(ellipse at 32% 28%, #1e3d28 0%, #0e2017 45%, #070f0b 100%)",
        // Layered border: outer gold rim + inner shadow for depth
        boxShadow:
          "inset 0 2px 4px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(160,120,60,0.55)",
      }}
      aria-hidden
    >
      {/* Subtle sheen line across the top-left — light catching velvet nap */}
      <span
        className="pointer-events-none absolute inset-0 rounded-[22%] opacity-60"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 45%)",
        }}
      />

      {Array.from({ length: 9 }).map((_, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const isPip = pips.some(([c, r]) => c === col && r === row);
        return (
          <span
            key={i}
            className={cn(
              "relative z-10 h-[62%] w-[62%] rounded-full transition-opacity",
              isPip ? "opacity-100" : "opacity-0",
            )}
            style={
              isPip
                ? {
                    // Ivory pip with depth: top highlight, bottom shadow
                    background:
                      "radial-gradient(circle at 38% 35%, #f5ede0 0%, #d4c4a8 60%, #b8a88a 100%)",
                    boxShadow:
                      "inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -1px 3px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.7)",
                  }
                : {}
            }
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
          canRoll ? "cursor-pointer" : "cursor-not-allowed opacity-60",
        )}
        whileTap={canRoll ? { scale: 0.91 } : undefined}
        animate={
          tumbling
            ? { rotate: [0, -20, 22, -12, 16, -8, 0], y: [0, -10, 2, -6, 2, 0] }
            : { rotate: 0, y: 0 }
        }
        transition={tumbling ? { duration: tumblingFor / 1000, ease: "easeOut" } : rollTransition}
        style={{
          // Multi-layer shadow: ambient lift + strong directional drop + gold glow edge
          filter: `
            drop-shadow(0 2px 2px rgba(0,0,0,0.55))
            drop-shadow(0 8px 18px rgba(0,0,0,0.65))
            drop-shadow(0 0 12px rgba(140,100,40,0.30))
          `,
        }}
      >
        <DieFace value={displayValue} />
      </motion.button>

      <div className="text-sm font-semibold tracking-wide text-amber-200/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        {tumbling ? "…" : canRoll ? label : disabled ? "ממתין לתור שלך" : label}
      </div>
    </div>
  );
}
