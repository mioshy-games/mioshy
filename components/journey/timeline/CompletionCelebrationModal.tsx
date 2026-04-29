"use client";

// ============================================================
// CompletionCelebrationModal — opens for a brief moment when the user
// marks a journey chapter as done. Its job is *emotional*, not
// functional: reinforce the value of what they just did, anchor the
// bigger vision, and add a credibility signal so the moment feels
// meaningful rather than transactional.
//
// Keeping it as a controlled Dialog (open + onOpenChange) means the
// parent chooses when to show it — typically right after a successful
// complete call — and the user can dismiss at their own pace.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Heart, Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  /** Link target for the "continue your journey" CTA. */
  timelineHref: string;
}

export function CompletionCelebrationModal({
  open,
  onOpenChange,
  locale,
  timelineHref,
}: Props) {
  const isHe = locale === "he";
  const router = useRouter();

  const t = isHe
    ? {
        kicker: "עוד צעד קטן · שינוי אמיתי",
        title: "עשיתם משהו חשוב ביחד.",
        body: "רגעים קטנים כאלה הם מה שבונה קרבה שנשארת. המסע שלכם מתקדם — צעד אחר צעד, בקצב שלכם.",
        impactLabel: "מה השגתם כרגע",
        impactLine:
          "בניתם שריר חדש לזוגיות — הקשבה, נוכחות וכנות בין שניכם. זה לא נבנה מאליו.",
        credibilityTitle: "איציק ברלב",
        credibilitySub: "מלווה זוגות משנת 2001",
        credibilityProof: "שיטה שנבחנה עם מאות זוגות · למעלה מ-25 שנות ליווי",
        continue: "המשך למסע",
        stay: "השארו כאן",
      }
    : {
        kicker: "One more step · real change",
        title: "You just did something that matters.",
        body: "Small moments like this are what build a closeness that lasts. Your journey is moving forward — step by step, at your own pace.",
        impactLabel: "What you just built",
        impactLine:
          "You grew a new relationship muscle — listening, presence, honesty between the two of you. That doesn't happen by accident.",
        credibilityTitle: "Itzik Berlav",
        credibilitySub: "Coaching couples since 2001",
        credibilityProof:
          "A method tested with hundreds of couples · Over 25 years of practice",
        continue: "Continue your journey",
        stay: "Stay here",
      };

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={isHe ? "rtl" : "ltr"}
        className="max-w-[calc(100%-2rem)] sm:max-w-lg border-emerald-300/30 bg-gradient-to-br from-[#061220] via-[#0b1a30] to-[#06111e] p-0 text-white shadow-[0_40px_120px_-30px_rgba(52,211,153,0.35)]"
      >
        {/* Ambient glow — two layered auroras that drift gently so the
            moment has a sense of aliveness, not a flat "modal". */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        >
          <div className="absolute -top-20 left-1/2 h-56 w-[140%] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-400/20 via-teal-400/25 to-indigo-400/20 blur-3xl animate-aurora-breathe" />
          <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-amber-400/18 blur-3xl animate-aurora-drift" />
        </div>

        {/* Sparkle row */}
        <div className="relative pt-8 pb-2 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-400 to-indigo-400 shadow-lg shadow-emerald-500/40 ring-1 ring-white/30">
            <Sparkles className="h-8 w-8 text-[#062318]" />
          </div>
        </div>

        <div className="relative px-7 pb-7 text-center sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/90">
            {t.kicker}
          </p>
          <DialogTitle className="mt-3 text-2xl font-bold leading-tight text-white sm:text-3xl">
            {t.title}
          </DialogTitle>

          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/80">
            {t.body}
          </p>

          {/* Impact pill — names the relationship-level change, so the
              completion feels meaningful, not transactional. */}
          <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-emerald-300/25 bg-emerald-400/8 px-4 py-3 text-start backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200/90">
              {t.impactLabel}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/85">
              {t.impactLine}
            </p>
          </div>

          {/* Credibility anchor — Itzik's 25-year credential gives the
              moment weight beyond "a notification from an app". */}
          <div className="mx-auto mt-5 inline-flex max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-start backdrop-blur">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400/80 to-fuchsia-500/80 text-white shadow-inner">
              <Heart className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-white">
                {t.credibilityTitle}
              </span>
              <span className="text-xs text-white/65">
                {t.credibilitySub}
              </span>
              <span className="mt-1 text-xs text-white/50">
                {t.credibilityProof}
              </span>
            </div>
          </div>

          {/* CTAs — thumb-friendly (≥48px) with the primary taking full
              width on mobile so it's impossible to miss. */}
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Button
              type="button"
              size="lg"
              onClick={() => {
                onOpenChange(false);
                router.push(timelineHref);
              }}
              className="min-h-[48px] w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 text-white shadow-lg shadow-emerald-500/30 hover:brightness-110 sm:w-auto sm:px-7"
            >
              {t.continue}
              <Arrow className="ms-2 h-4 w-4 rotate-180" />
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-[48px] w-full border-white/25 bg-white/5 text-white hover:bg-white/10 sm:w-auto sm:px-7"
            >
              {t.stay}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
