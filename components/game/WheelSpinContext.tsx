"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * WheelSpinContext — broadcasts the wheel's "is spinning right now"
 * state across the game page so the GamePageBackground (and any
 * future ambient-animation consumer) can pause its work when the
 * user isn't actively interacting.
 *
 * Why: GamePageBackground mounts 3 large `<motion.div>` blobs with
 * `repeat: Infinity` animations. Even with the radial-gradient
 * (no-blur) optimisation, they continuously update compositor
 * layers — Itzik measured the game page feeling heavier than
 * non-wheel surfaces. Freezing the blobs whenever the wheel isn't
 * spinning means the page sits at 0 GPU work between interactions.
 *
 * Flow:
 *   1. User lands on /games/<slug>     → isSpinning=false → frozen blobs
 *   2. User clicks Spin                 → onSpinStart fires → setIsSpinning(true) → blobs come alive
 *   3. Wheel settles                    → onSettled fires → setIsSpinning(false) → blobs freeze again
 *   4. User reads result, dismisses popup, clicks next Spin → loop from step 2.
 *
 * The default value (`isSpinning: false`) intentionally fails open:
 * any consumer outside a provider just sees the same "stable
 * idle" reading instead of crashing.
 */
type WheelSpinContextValue = {
  isSpinning: boolean;
  setIsSpinning: (value: boolean) => void;
};

const WheelSpinContext = createContext<WheelSpinContextValue>({
  isSpinning: false,
  setIsSpinning: () => undefined,
});

export function WheelSpinProvider({ children }: { children: ReactNode }) {
  const [isSpinning, setIsSpinning] = useState(false);
  const value = useMemo<WheelSpinContextValue>(
    () => ({ isSpinning, setIsSpinning }),
    [isSpinning],
  );
  return (
    <WheelSpinContext.Provider value={value}>
      {children}
    </WheelSpinContext.Provider>
  );
}

/**
 * Read + write access to the spin state. Components OUTSIDE a
 * WheelSpinProvider get the static default ({ isSpinning: false,
 * setIsSpinning: noop }) — useful for shared components like
 * GamePageBackground that also render on surfaces without a
 * wheel (e.g. /games marketing hero, where LiveDemoHero owns its
 * own `phase` state and passes `frozen` explicitly).
 */
export function useWheelSpin(): WheelSpinContextValue {
  return useContext(WheelSpinContext);
}
