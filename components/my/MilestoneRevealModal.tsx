"use client";

/**
 * MilestoneRevealModal
 * ─────────────────────────────────────────────────────────
 * Layer-4 reveal modal. Renders ONLY when there's a pending
 * milestone (revealed_at IS NULL). On dismiss, stamps
 * revealed_at so it never reappears.
 *
 * One-shot. No back button. The user reads it, presses
 * "continue", and they're back on the dashboard.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissMilestone } from "@/app/actions/milestones";
import type { MilestoneSlug, MilestoneDef } from "@/lib/journey/milestones";
import type { StoryNarrative } from "@/lib/journey/story-narrative";
import { StoryReveal } from "./StoryReveal";

interface Props {
  isHe:        boolean;
  milestoneId: string;
  slug:        MilestoneSlug;
  def:         MilestoneDef;
  /** FU6.S5 — when present, "Read our story" CTA appears for the
   *  ten/twenty milestones. Hidden on five_items + anniversary slugs
   *  (they don't get a retrospective at this scale). */
  storyNarrative?: StoryNarrative | null;
}

export function MilestoneRevealModal({
  isHe,
  milestoneId,
  slug,
  def,
  storyNarrative = null,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [showStory, setShowStory] = useState(false);
  const [pending, startTransition] = useTransition();
  const t = isHe ? def.he : def.en;

  // Lock body scroll while open.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    startTransition(async () => {
      await dismissMilestone(milestoneId);
      router.refresh();
    });
  };

  if (!open) return null;

  // FU6.S5 — when the user opens the story panel, render only the
  // panel and stamp the milestone as dismissed in parallel (so the
  // modal doesn't reappear after they close the story).
  if (showStory && storyNarrative) {
    return (
      <StoryReveal
        isHe={isHe}
        narrative={storyNarrative}
        onClose={close}
      />
    );
  }

  // Show the "Read our story" CTA only at meaningful retrospective
  // thresholds (10 / 20 items) and when the narrative actually has
  // content to show.
  const showStoryCta =
    !!storyNarrative &&
    (slug === "ten_items" || slug === "twenty_items");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      className="fixed inset-0 z-[60] flex items-center justify-center px-5"
      data-milestone={slug}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(8,4,12,0.78)" }}
      />
      <div
        className="relative w-full max-w-[440px] rounded-3xl border p-7 sm:p-8"
        dir={isHe ? "rtl" : "ltr"}
        style={{
          borderColor: "rgba(184,60,77,0.45)",
          background:
            "linear-gradient(160deg, #1a0f15 0%, #0E0810 60%, #0E0810 100%)",
          boxShadow:
            "0 30px 80px -20px rgba(184,60,77,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -end-12 -top-12 h-44 w-44 rounded-full opacity-35 blur-3xl"
          style={{ background: "#B83C4D" }}
        />

        <button
          type="button"
          onClick={close}
          aria-label={isHe ? "סגירה" : "Close"}
          className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/20 hover:text-white"
          disabled={pending}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FAF6F7]"
            style={{ background: "rgba(184,60,77,0.25)" }}
          >
            <Sparkles className="h-3 w-3" />
            {isHe ? "אבן דרך" : "Milestone"}
          </span>

          <h2 className="mt-4 font-heading text-[28px] font-extrabold leading-tight text-white sm:text-[32px]">
            {t.title}
          </h2>
          <p className="mt-3 text-[16px] leading-[1.65] text-white/85">
            {t.body}
          </p>

          <Button
            type="button"
            onClick={close}
            disabled={pending}
            className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-6 text-[16px] font-bold text-white transition hover:brightness-110"
            style={{
              background:
                "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
              boxShadow: "0 16px 36px -12px rgba(184,60,77,0.55)",
            }}
          >
            {t.cta}
          </Button>

          {showStoryCta ? (
            <button
              type="button"
              onClick={() => setShowStory(true)}
              disabled={pending}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-5 py-3 text-[14px] font-medium text-white/85 transition hover:bg-white/[0.07]"
            >
              <BookOpen className="h-4 w-4" />
              {isHe ? "קראו את הסיפור שלכם עד כה" : "Read your story so far"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
