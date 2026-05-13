"use client";

// ============================================================
// NextUpHero - the visually dominant "what to do next" card at the top
// of the timeline. Picks one entry from the timeline and renders it
// large, so the user's eye lands on the single next action rather than
// scanning the full category list.
//
// Selection rule (applied by the server page):
//   1. first available entry (by unlock_at asc)  - "do this now"
//   2. else the nearest locked entry             - "coming next"
//   3. else null (all completed)                 - render a victory card
//
// Sprint 4 #3 Phase 2A migration — 20 keys under journeyTimeline.nextUp.*.
// ============================================================

import * as React from "react";
import Image from "next/image";
import { Link } from "@/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  PartyPopper,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { TimelineEntry } from "@/lib/journey-content/types";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

interface Props {
  /** The entry to feature - or null when everything is completed. */
  entry: TimelineEntry | null;
  locale: string;
  /** Total entries + how many are completed (for the victory state). */
  total: number;
  completed: number;
}

export function NextUpHero({ entry, locale, total, completed }: Props) {
  const isHe = locale === "he";

  if (!entry) {
    if (total > 0 && completed === total) {
      return <VictoryHero isHe={isHe} total={total} />;
    }
    return null;
  }

  return <ActiveNextUpHero entry={entry} isHe={isHe} />;
}

// ------------------------------------------------------------
// Active state - either "available now" or "coming next (locked)"
// ------------------------------------------------------------

function ActiveNextUpHero({
  entry,
  isHe,
}: {
  entry: TimelineEntry;
  isHe: boolean;
}) {
  const Arrow = isHe ? ArrowLeft : ArrowRight;
  const title = isHe
    ? entry.item.title_he
    : entry.item.title_en ?? entry.item.title_he;
  const body = isHe
    ? entry.item.body_he
    : entry.item.body_en ?? entry.item.body_he;
  const categoryName =
    (isHe ? entry.category.name_he : entry.category.name_en) ??
    entry.category.name_he;
  const hasImage = !!entry.item.image_url;
  const isAvailable = entry.status === "available";
  const isLocked = entry.status === "locked";

  // Resolve every potentially-rendered string up front — useCmsText is
  // a hook, can't sit inside conditional branches further down.
  const ariaActive = useCmsText("journeyTimeline.nextUp.ariaActive").text;
  const availableBadge = useCmsText("journeyTimeline.nextUp.availableBadge").text;
  const availableKicker = useCmsText("journeyTimeline.nextUp.availableKicker").text;
  const availableCta = useCmsText("journeyTimeline.nextUp.availableCta").text;
  const lockedBadge = useCmsText("journeyTimeline.nextUp.lockedBadge").text;
  const lockedCta = useCmsText("journeyTimeline.nextUp.lockedCta").text;
  const countdownNow = useCmsText("journeyTimeline.nextUp.countdownNow").text;
  const countdownToday = useCmsText("journeyTimeline.nextUp.countdownToday").text;
  const countdownTomorrow = useCmsText("journeyTimeline.nextUp.countdownTomorrow").text;
  const countdownDaysTpl = useCmsText("journeyTimeline.nextUp.countdownDays").text;
  const countdownWeeksTpl = useCmsText("journeyTimeline.nextUp.countdownWeeks").text;
  const countdownDateTpl = useCmsText("journeyTimeline.nextUp.countdownDate").text;

  // Palette + copy swap between "act now" and "coming soon".
  const theme = isAvailable
    ? {
        badge: availableBadge,
        badgeIcon: <Sparkles className="h-3.5 w-3.5" />,
        kicker: availableKicker,
        whyLineKey: "journeyTimeline.nextUp.availableWhyLine",
        cta: availableCta,
        border: "border-amber-300/55",
        glowA: "from-amber-400/35",
        glowB: "to-rose-400/25",
        ring: "shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_30px_80px_-20px_rgba(251,191,36,0.35)]",
        pillBg: "bg-amber-400/20",
        pillBorder: "border-amber-300/50",
        pillText: "text-amber-100",
        ctaBg:
          "bg-gradient-to-r from-amber-400 via-rose-400 to-indigo-400 text-[#0a1326] hover:brightness-110",
        dotPulse: true,
      }
    : {
        badge: lockedBadge,
        badgeIcon: <Clock className="h-3.5 w-3.5" />,
        kicker: formatUnlockCountdown(entry.scheduled.unlock_at, isHe, {
          countdownNow,
          countdownToday,
          countdownTomorrow,
          countdownDaysTpl,
          countdownWeeksTpl,
          countdownDateTpl,
        }),
        whyLineKey: "journeyTimeline.nextUp.lockedWhyLine",
        cta: lockedCta,
        border: "border-indigo-300/40",
        glowA: "from-indigo-400/25",
        glowB: "to-emerald-400/15",
        ring: "shadow-[0_0_0_1px_rgba(129,140,248,0.25),0_24px_70px_-20px_rgba(99,102,241,0.4)]",
        pillBg: "bg-indigo-400/15",
        pillBorder: "border-indigo-300/40",
        pillText: "text-indigo-100",
        ctaBg:
          "bg-white/10 text-white hover:bg-white/15 border border-white/20",
        dotPulse: false,
      };

  return (
    <section aria-label={ariaActive}>
      <div
        className={`group relative overflow-hidden rounded-3xl border ${theme.border} bg-white/[0.04] backdrop-blur-md ${theme.ring}`}
      >
        {/* Ambient color wash */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.glowA} via-transparent ${theme.glowB} opacity-80`}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-20 -z-0 bg-[radial-gradient(600px_circle_at_20%_10%,rgba(251,191,36,0.18),transparent_60%),radial-gradient(500px_circle_at_85%_80%,rgba(99,102,241,0.2),transparent_55%)]"
        />

        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
          {/* Media - hero image with fallback glyph. Square ratio on
              mobile so vertical portraits don't dominate the viewport. */}
          <div className="relative mx-auto h-36 w-36 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-2xl shadow-black/40 sm:mx-0 sm:h-44 sm:w-44">
            {hasImage ? (
              <Image
                src={entry.item.image_url!}
                alt=""
                fill
                sizes="(min-width: 640px) 176px, 144px"
                className="object-cover transition duration-700 group-hover:scale-[1.04]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/30 via-violet-500/20 to-emerald-500/25">
                {isAvailable ? (
                  <Sparkles className="h-14 w-14 text-white/90" />
                ) : (
                  <Lock className="h-14 w-14 text-white/85" />
                )}
              </div>
            )}
          </div>

          {/* Text block */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border ${theme.pillBorder} ${theme.pillBg} px-3 py-1 text-xs font-semibold uppercase tracking-wider ${theme.pillText} backdrop-blur`}
              >
                {theme.dotPulse ? (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300/80" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_8px_rgba(252,211,77,0.9)]" />
                  </span>
                ) : (
                  theme.badgeIcon
                )}
                {theme.badge}
              </span>
              <span className="truncate text-xs font-medium text-white/60">
                {categoryName}
              </span>
            </div>

            <p
              className={`mt-3 text-xs font-semibold uppercase tracking-[0.15em] ${theme.pillText}`}
            >
              {theme.kicker}
            </p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
              {title}
            </h2>

            <CmsText
              cmsKey={theme.whyLineKey}
              as="p"
              className="mt-3 text-sm italic leading-relaxed text-white/85 sm:text-base"
            />

            {body ? (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/65 sm:text-base">
                {body}
              </p>
            ) : null}

            {/* Subtle credibility anchor - reminds the user this isn't
                content generated in a vacuum; it's part of a method that's
                been used with real couples. One line, low visual weight. */}
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-white/55">
              <ShieldCheck className="h-3 w-3 text-emerald-300/80" />
              <CmsText cmsKey="journeyTimeline.nextUp.credibility" />
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/journey/timeline/${entry.scheduled.id}`}
                className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition ${theme.ctaBg}`}
                prefetch={false}
              >
                {theme.cta}
                <Arrow className="h-4 w-4 rotate-180" />
              </Link>

              {isLocked ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
                  <Lock className="h-3.5 w-3.5" />
                  <CmsText cmsKey="journeyTimeline.nextUp.lockedUnlockHint" />
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// Victory state - everything is done
// ------------------------------------------------------------

function VictoryHero({ isHe: _isHe, total }: { isHe: boolean; total: number }) {
  const ariaVictory = useCmsText("journeyTimeline.nextUp.ariaVictory").text;
  const bodyTpl = useCmsText("journeyTimeline.nextUp.victoryBody").text;
  const body = bodyTpl.replace("{total}", String(total));
  return (
    <section aria-label={ariaVictory}>
      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-indigo-500/15 p-6 shadow-[0_0_0_1px_rgba(52,211,153,0.3)] sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 bg-[radial-gradient(500px_circle_at_30%_20%,rgba(52,211,153,0.25),transparent_60%),radial-gradient(500px_circle_at_80%_80%,rgba(99,102,241,0.2),transparent_60%)]"
        />
        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-600/40 ring-1 ring-white/25">
            <PartyPopper className="h-8 w-8 text-[#052e21]" />
          </div>
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <CmsText cmsKey="journeyTimeline.nextUp.victoryLabel" />
            </p>
            <CmsText
              cmsKey="journeyTimeline.nextUp.victoryTitle"
              as="h2"
              className="mt-1 text-2xl font-bold text-white sm:text-3xl"
            />
            <p className="mt-1 text-sm text-white/75 sm:text-base">{body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function formatUnlockCountdown(
  unlockAt: string,
  isHe: boolean,
  copy: {
    countdownNow: string;
    countdownToday: string;
    countdownTomorrow: string;
    countdownDaysTpl: string;
    countdownWeeksTpl: string;
    countdownDateTpl: string;
  },
): string {
  const ms = new Date(unlockAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return copy.countdownNow;
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 0) return copy.countdownToday;
  if (days === 1) return copy.countdownTomorrow;
  if (days < 14) return copy.countdownDaysTpl.replace("{n}", String(days));
  const weeks = Math.ceil(days / 7);
  if (weeks < 6) return copy.countdownWeeksTpl.replace("{n}", String(weeks));
  const dt = new Date(unlockAt).toLocaleDateString(
    isHe ? "he-IL" : "en-US",
    { month: "short", day: "numeric" },
  );
  return copy.countdownDateTpl.replace("{date}", dt);
}
