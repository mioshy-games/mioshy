"use client";

import { motion } from "framer-motion";
import { Link } from "@/navigation";
import { ArrowLeft, ArrowRight, Lock, Sparkles } from "lucide-react";
import { AnimatedOrbsBg } from "./AnimatedOrbsBg";

/**
 * ServicePanel
 * ------------
 * The "locked" state for any of the three pillars on the /my hub.
 * Dark animated gradient + floating orb backdrop with a central gradient
 * CTA button that routes to the pillar's marketing page.
 *
 * Visual language matches the wheel-game page backdrop so the whole
 * experience feels like one product family.
 */

export type ServicePanelProps = {
  isHe: boolean;
  /** Used to pick the pillar-themed palette */
  pillar: "games" | "journey" | "adults";
  /** Inline Hebrew/English labels */
  titleHe: string;
  titleEn: string;
  /** Sub headline (already resolved for locale) */
  tagline: string;
  /** The emoji/character displayed in the soft badge on top */
  badge?: string;
  /** Bullet list of 2–4 quick wins — shown under the tagline */
  bullets?: string[];
  /** Marketing/purchase route. Link becomes the main CTA. */
  ctaHref: string;
  /** CTA label (already localized) */
  ctaLabel: string;
  /** Secondary link ("Learn more" or similar) */
  secondary?: { href: string; label: string };
  /** Fine print under the button (e.g. "₪39 / month") */
  priceLine?: string;
  /** Size variant — default looks great at ~520px height */
  compact?: boolean;
};

const PILLAR_GRADIENTS: Record<ServicePanelProps["pillar"], string> = {
  games: "from-violet-500 via-fuchsia-500 to-cyan-500",
  journey: "from-teal-400 via-indigo-500 to-purple-500",
  adults: "from-rose-500 via-red-500 to-amber-500",
};

const PILLAR_RINGS: Record<ServicePanelProps["pillar"], string> = {
  games: "ring-fuchsia-300/40 shadow-fuchsia-500/40",
  journey: "ring-indigo-300/40 shadow-indigo-500/40",
  adults: "ring-rose-300/40 shadow-rose-500/40",
};

export function ServicePanel({
  isHe,
  pillar,
  titleHe,
  titleEn,
  tagline,
  badge = "✨",
  bullets,
  ctaHref,
  ctaLabel,
  secondary,
  priceLine,
  compact = false,
}: ServicePanelProps) {
  const title = isHe ? titleHe : titleEn;
  const gradient = PILLAR_GRADIENTS[pillar];
  const glow = PILLAR_RINGS[pillar];
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <AnimatedOrbsBg
      pillar={pillar}
      intensity={compact ? "subtle" : "normal"}
      className={`relative isolate rounded-3xl border border-white/10 ${
        compact ? "min-h-[420px]" : "min-h-[520px]"
      }`}
    >
      <div
        className="relative z-10 flex h-full flex-col items-center justify-center gap-6 p-8 text-center sm:p-12"
        dir={isHe ? "rtl" : "ltr"}
      >
        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{badge}</span>
          <Lock className="h-3.5 w-3.5 opacity-70" />
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-xl text-balance font-heading text-3xl font-bold leading-tight text-white sm:text-5xl"
        >
          {title}
        </motion.h2>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="max-w-xl text-pretty text-base text-white/80 sm:text-lg"
        >
          {tagline}
        </motion.p>

        {/* Bullets — only render if supplied */}
        {bullets && bullets.length > 0 ? (
          <motion.ul
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex max-w-xl flex-wrap items-center justify-center gap-2 text-sm text-white/85"
          >
            {bullets.map((b, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-sm"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/60" />
                {b}
              </li>
            ))}
          </motion.ul>
        ) : null}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-3 flex flex-col items-center gap-3"
        >
          <Link
            href={ctaHref}
            className={`group relative inline-flex min-h-[56px] items-center gap-3 rounded-full bg-gradient-to-r ${gradient} px-10 text-base font-bold text-white shadow-2xl ring-1 transition hover:brightness-110 active:scale-[0.98] ${glow}`}
          >
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-r ${gradient} opacity-70 blur-xl`}
            />
            {ctaLabel}
            <Arrow className="h-5 w-5 transition group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
          </Link>

          {priceLine ? (
            <p className="text-xs text-white/60">{priceLine}</p>
          ) : null}

          {secondary ? (
            <Link
              href={secondary.href}
              className="text-sm font-medium text-white/75 underline-offset-4 transition hover:text-white hover:underline"
            >
              {secondary.label}
            </Link>
          ) : null}
        </motion.div>
      </div>
    </AnimatedOrbsBg>
  );
}
