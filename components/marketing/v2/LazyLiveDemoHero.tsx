"use client";

/**
 * Lazy wrapper around <LiveDemoHero /> for the /games marketing page.
 *
 * Why this exists
 * ───────────────
 * The real <LiveDemoHero /> is a heavy client component:
 *   - imports framer-motion (~60kb gzipped)
 *   - embeds the full <Wheel /> component (canvas/SVG render path,
 *     spin physics, sound effects)
 *   - drags GamePageBackground + several lucide icons
 *   - state for spin phase, landed slice, modal card
 *
 * Shipping all of this in the initial /games bundle taxes Time-to-Interactive
 * for every visitor, including users who never spin the demo wheel. We
 * code-split it behind `next/dynamic({ ssr: false })` and render a sized
 * skeleton in its place during initial render so:
 *   1. The HTML stays light and fast.
 *   2. There is no layout shift when the real hero hydrates (skeleton matches
 *      the hero's vertical footprint).
 *   3. Server-side `getTranslations()` work in the parent page is unaffected
 *      — props are still resolved in the server component and passed in.
 *
 * The wrapper itself must be a client component because `ssr: false` is
 * only honored when `next/dynamic` is called from the client side.
 */

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { LiveDemoHero as LiveDemoHeroType } from "./LiveDemoHero";

// `next/dynamic` returns the underlying component lazily. We extract the
// prop type from the source component so the wrapper's API stays in sync
// without manual duplication.
type LiveDemoHeroProps = ComponentProps<typeof LiveDemoHeroType>;

const LiveDemoHero = dynamic(
  () => import("./LiveDemoHero").then((m) => m.LiveDemoHero),
  {
    ssr: false,
    loading: () => <HeroSkeleton />,
  },
);

export function LazyLiveDemoHero(props: LiveDemoHeroProps) {
  return <LiveDemoHero {...props} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton — sized to match the real hero so we never trigger CLS on swap.
// Uses only static markup so it costs almost nothing to render.
// ─────────────────────────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div
      aria-hidden
      className="relative mx-auto max-w-6xl px-4 pb-16 pt-8 sm:pt-12"
    >
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        {/* Copy column placeholder */}
        <div className="space-y-6 text-center lg:text-start">
          {/* badge row */}
          <div className="mx-auto h-6 w-44 rounded-full bg-white/5 lg:mx-0" />
          {/* h1 */}
          <div className="mx-auto h-14 w-full max-w-xl rounded-md bg-white/[0.06] lg:mx-0" />
          <div className="mx-auto h-14 w-full max-w-md rounded-md bg-white/[0.06] lg:mx-0" />
          {/* lede */}
          <div className="mx-auto h-4 w-full max-w-lg rounded-md bg-white/[0.04] lg:mx-0" />
          <div className="mx-auto h-4 w-3/4 max-w-md rounded-md bg-white/[0.04] lg:mx-0" />
          {/* CTAs */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <div className="h-14 w-56 rounded-full bg-white/[0.06]" />
            <div className="h-14 w-40 rounded-full bg-white/[0.04]" />
          </div>
        </div>

        {/* Wheel column placeholder — square footprint, dark glass */}
        <div className="relative mx-auto aspect-square w-full max-w-[440px] rounded-[36px] border border-white/10 bg-white/[0.025] backdrop-blur-sm">
          <div className="absolute inset-1/4 rounded-full border border-white/10 bg-white/[0.03]" />
        </div>
      </div>
    </div>
  );
}
