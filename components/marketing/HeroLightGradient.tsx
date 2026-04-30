"use client";

import { useEffect } from "react";
import { ArrowRight, Heart, Shield, Sparkles, Star } from "lucide-react";
import { Link } from "@/navigation";
import { Reveal } from "@/components/marketing/Reveal";
import { GentleAnimatedBg } from "@/components/marketing/GentleAnimatedBg";

export type HeroLightGradientProps = {
  isHe: boolean;
  /** Headline sits after "Mioshy -" (handled inside this component for the branded look). */
  headline: string;
  sub: string;
  trustBadge?: string | null;
  ctaPrimary: { text: string; href: string };
  ctaSecondary: { text: string; href: string };
  rating?: { value: number; count: number } | null;
  coupleCount?: number | null;
  socialProofLine?: string | null;
  privacyLabel?: string;
};

/**
 * "Light gradient" hero - the current published design:
 * - Animated pastel background via <GentleAnimatedBg />
 * - Centered copy, full-bleed CTAs, inline rating + couple count row
 */
export function HeroLightGradient({
  isHe,
  headline,
  sub,
  trustBadge,
  ctaPrimary,
  ctaSecondary,
  rating,
  coupleCount,
  socialProofLine,
  privacyLabel,
}: HeroLightGradientProps) {
  useEffect(() => {
    console.log("[HeroLightGradient] mounted v2 — purple↔red converge + particles");
  }, []);

  return (
    <section
      className="relative isolate overflow-hidden bg-white text-slate-900"
      dir={isHe ? "rtl" : "ltr"}
    >
      <GentleAnimatedBg />
      <div className="relative z-10 mx-auto flex min-h-[86dvh] max-w-6xl flex-col items-center justify-center px-4 py-20 text-center">
        {trustBadge ? (
          <Reveal>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/60 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-rose-700 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              {trustBadge}
            </div>
          </Reveal>
        ) : null}
        <Reveal delay={0.05}>
          <h1 className="mt-6 font-heading text-balance text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-l from-rose-600 via-fuchsia-600 to-violet-600 bg-clip-text text-transparent">
              Mioshy
            </span>
            <span className="mx-3 text-slate-400">-</span>
            {headline}
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-slate-700 sm:text-xl">
            {sub}
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={ctaPrimary.href}
              className="group inline-flex min-h-[48px] items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500 px-7 text-sm font-semibold text-white shadow-xl shadow-fuchsia-500/30 transition hover:brightness-110"
            >
              {ctaPrimary.text}
              <ArrowRight
                className={`h-4 w-4 transition group-hover:translate-x-1 ${
                  isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                }`}
              />
            </Link>
            <Link
              href={ctaSecondary.href}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-6 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white"
            >
              {ctaSecondary.text}
            </Link>
          </div>
        </Reveal>

        {rating || coupleCount ? (
          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
              {rating && rating.count > 0 ? (
                <div className="flex items-center gap-1.5">
                  <InlineStars value={rating.value} />
                  <span className="font-semibold text-slate-800">
                    {rating.value.toFixed(1)}
                  </span>
                  <span className="text-slate-500">
                    ({rating.count.toLocaleString()})
                  </span>
                </div>
              ) : null}
              {coupleCount && coupleCount > 0 && socialProofLine ? (
                <div className="flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-rose-500" />
                  <span>{socialProofLine}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-emerald-500" />
                <span>{privacyLabel ?? (isHe ? "פרטי • מאובטח" : "Private · secure")}</span>
              </div>
            </div>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

function InlineStars({ value }: { value: number }) {
  return (
    <div className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "text-slate-300"
          }`}
        />
      ))}
    </div>
  );
}
