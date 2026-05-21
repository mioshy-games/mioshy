"use client";

import type { ReactNode } from "react";
import type { BackgroundSettings, ParticlesSettings } from "@/lib/types/settings";
import { GamePageBackground } from "./GamePageBackground";
import { WheelSpinProvider } from "./WheelSpinContext";

/**
 * GameSurfaceShell — client wrapper for in-game pages.
 *
 * Combines `WheelSpinProvider` (state owner) with `GamePageBackground`
 * (visual atmosphere) so the in-game route at
 * `app/[locale]/games/[slug]/page.tsx` can:
 *
 *   1. Render the dark animated background with blobs / particles.
 *   2. Hand a setter to the Wheel via context, so blob animation
 *      only runs while the wheel is actively spinning.
 *
 * Outside this shell the wheel hero on /games marketing (LiveDemoHero)
 * still works — that branch passes `frozen` directly to GamePageBackground
 * and never relies on context. Symmetrical fallback: when consumed
 * outside a provider, the context defaults to isSpinning=false, so
 * blobs freeze, which is the desired idle behaviour.
 *
 * Props mirror GamePageBackground 1:1 except `frozen` is dropped —
 * the shell ALWAYS lets context drive freeze state. If you need
 * explicit control, use GamePageBackground directly.
 */
export function GameSurfaceShell({
  gameSlug,
  primaryColor,
  bgSettings,
  particlesSettings,
  containerClassName,
  children,
}: {
  gameSlug: string;
  primaryColor?: string;
  bgSettings?: BackgroundSettings | null;
  particlesSettings?: ParticlesSettings | null;
  containerClassName?: string;
  children: ReactNode;
}) {
  return (
    <WheelSpinProvider>
      <GamePageBackground
        gameSlug={gameSlug}
        primaryColor={primaryColor}
        bgSettings={bgSettings}
        particlesSettings={particlesSettings}
        containerClassName={containerClassName}
      >
        {children}
      </GamePageBackground>
    </WheelSpinProvider>
  );
}
