"use client";

/**
 * StoryReveal
 *
 * FU6.S5 — "Your story so far" inline panel. Triggered from the
 * milestone modal at 10 / 20 completions. The user clicks "Read
 * our story" inside MilestoneRevealModal; this panel slides into
 * place with a templated retrospective.
 *
 * Pure client component — receives the narrative payload (built
 * server-side by lib/journey/story-narrative.ts) and renders it.
 * No fetches, no LLM calls, no surprises.
 */

import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoryNarrative } from "@/lib/journey/story-narrative";

interface Props {
  isHe:       boolean;
  narrative:  StoryNarrative;
  onClose:    () => void;
}

export function StoryReveal({ isHe, narrative, onClose }: Props) {
  // Lock body scroll while open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isHe ? "הסיפור שלכם עד כה" : "Your story so far"}
      className="fixed inset-0 z-[70] flex items-center justify-center px-5"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(8,4,12,0.84)" }}
      />
      <div
        className="relative w-full max-w-[520px] rounded-3xl border p-7 sm:p-8"
        dir={isHe ? "rtl" : "ltr"}
        style={{
          borderColor: "rgba(184,60,77,0.45)",
          background:
            "linear-gradient(160deg, #1a0f15 0%, #0E0810 60%, #0E0810 100%)",
          boxShadow:
            "0 30px 80px -20px rgba(184,60,77,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={isHe ? "סגירה" : "Close"}
          className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/20 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FAF6F7]"
            style={{ background: "rgba(184,60,77,0.25)" }}
          >
            <Sparkles className="h-3 w-3" />
            {isHe ? "הסיפור עד כה" : "The story so far"}
          </span>

          <p className="mt-4 text-[16px] leading-[1.65] text-white/90">
            {narrative.lead}
          </p>

          {narrative.itemTitles.length > 0 ? (
            <ol className="mt-4 space-y-1.5">
              {narrative.itemTitles.map((title, i) => (
                <li
                  key={`${i}-${title}`}
                  className="flex items-baseline gap-2 text-[14px] leading-snug text-white/80"
                >
                  <span className="tabular-nums text-white/45">
                    {(i + 1).toString().padStart(2, "0")}.
                  </span>
                  <span>{title}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {narrative.excerpt ? (
            <blockquote
              className="mt-5 border-s-2 border-[#B83C4D]/55 ps-4 text-[14px] italic leading-relaxed text-white/70"
              dir={isHe ? "rtl" : "ltr"}
            >
              {narrative.excerpt}
            </blockquote>
          ) : null}

          <p className="mt-5 text-[15px] leading-[1.6] text-white/85">
            {narrative.outro}
          </p>

          <Button
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-6 text-[16px] font-bold text-white transition hover:brightness-110"
            style={{
              background:
                "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
              boxShadow: "0 16px 36px -12px rgba(184,60,77,0.55)",
            }}
          >
            {isHe ? "מצויין, ממשיכים" : "Onwards"}
          </Button>
        </div>
      </div>
    </div>
  );
}
