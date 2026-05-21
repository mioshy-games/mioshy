/**
 * Wrapper around <LiveDemoHero /> for the /games marketing page.
 *
 * 2026-05-20 — flipped from `next/dynamic({ ssr: false })` + skeleton
 * to direct SSR + hydrate import. The original lazy-load was designed
 * to shrink the initial bundle, but in practice it CAUSED the
 * Lighthouse-measured CLS of 0.875 because:
 *   • Server emits HeroSkeleton's HTML (~700px tall flex container)
 *   • Browser downloads the LiveDemoHero JS (~60KB framer-motion etc.)
 *   • React mounts the real LiveDemoHero in place of the skeleton
 *   • Real component's intrinsic height differs from skeleton by ~50-
 *     150px due to text length variance + wheel sizing
 *   • Every section below the hero shifts → CLS catastrophe.
 *
 * Why a direct import is fine cost-wise:
 *   • framer-motion is ALREADY bundled (RevealOnScroll, ParallaxImage,
 *     Hero, ForWhom, CouplesGames, AdultGames all import it).
 *   • The Wheel + GamePageBackground specific additions are ~5-10 KB
 *     gzipped — well below the threshold of measurable TTI impact on
 *     slow 4G (and the JS was going to load anyway, just slightly later).
 *
 * The component file is kept as `LazyLiveDemoHero` for callsite
 * stability — pages that imported it don't need to change.
 *
 * HeroSkeleton is preserved as an exported helper for any future
 * use (e.g. Suspense fallback elsewhere) but is no longer rendered
 * by this wrapper.
 */

import { LiveDemoHero } from "./LiveDemoHero";
import type { ComponentProps } from "react";

type LiveDemoHeroProps = ComponentProps<typeof LiveDemoHero>;

export function LazyLiveDemoHero(props: LiveDemoHeroProps) {
  return <LiveDemoHero {...props} />;
}

// HeroSkeleton component removed 2026-05-20 — no longer used since
// we switched from `next/dynamic({ ssr: false })` to direct SSR
// import (see top-of-file comment). Git history preserves the
// skeleton markup if we ever need it again as a Suspense fallback.
