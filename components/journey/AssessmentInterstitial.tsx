"use client";

/**
 * AssessmentInterstitial
 * ─────────────────────────────────────────────────────────
 * Layer-1 mid-flow reflection screens.
 *
 * Inserted at 4 break points across the 29-question assessment:
 *   index 5  → after the communication block
 *   index 12 → after the intimacy + emotional connection block
 *   index 19 → after the friendship block
 *   index 26 → after the family domain block
 *
 * Each interstitial reflects back what was heard so far in
 * one warm sentence, then offers a single "continue" button.
 * Auto-renders fade-in; never auto-advances (the user controls
 * when they're ready). Session-scoped: dismissed interstitials
 * don't reappear on back-and-forth in the same session.
 *
 * Pure copy intervention — no schema, no analytics-driven
 * branching. The reflections are intentionally deterministic
 * (no LLM, no per-answer customisation) so they're predictable
 * and trustworthy.
 */

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

const STORAGE_KEY = "mioshy:assessment-interstitial-seen";

export interface InterstitialDef {
  /** Index after which this interstitial appears. */
  atIndex: number;
  /** Section number shown on the card (1..4). Drives the CMS key lookup
   *  for title/body — journeyAssessment.interstitial.step{step}.{title,body}. */
  step: number;
}

// Mid-flow reflection screens removed at Itzik's request (2026-05-21).
// Keeping the component + helpers in place; emptying this array disables
// every interstitial without touching the JourneyClient rendering logic.
export const INTERSTITIALS: InterstitialDef[] = [];

export const INTERSTITIAL_INDICES = INTERSTITIALS.map((i) => i.atIndex);

/**
 * Was this interstitial already shown in the current session?
 * Session-scoped (sessionStorage) so a refresh during the same flow
 * keeps it dismissed but a fresh visit (next day) shows it again.
 */
export function wasInterstitialShown(atIndex: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const seen = new Set(raw.split(",").map((s) => Number(s.trim())));
    return seen.has(atIndex);
  } catch {
    return false;
  }
}

export function markInterstitialShown(atIndex: number): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY) ?? "";
    const seen = new Set(
      raw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n)),
    );
    seen.add(atIndex);
    window.sessionStorage.setItem(STORAGE_KEY, Array.from(seen).join(","));
  } catch {
    /* private mode — fall through, dismiss is just session-local then */
  }
}

interface Props {
  /** Retained on the props interface for backwards compatibility — the
   *  isHe flag was used pre-CMS to pick the title/body language. CMS
   *  lookup is locale-aware via useCmsText, so this is unused inside
   *  the component now. Callers still pass it. */
  isHe?: boolean;
  def: InterstitialDef;
  onContinue: () => void;
}

export function AssessmentInterstitial({ def, onContinue }: Props) {
  const stepCounterTpl = useCmsText("journeyAssessment.interstitial.stepCounter").text;
  const stepCounter = stepCounterTpl.replace("{n}", String(def.step));
  return (
    <motion.section
      key={`interstitial-${def.atIndex}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8"
      style={{
        background:
          "linear-gradient(160deg, rgba(184,60,77,0.18) 0%, rgba(8,4,12,0.6) 60%, rgba(8,4,12,0.6) 100%)",
        boxShadow: "0 30px 80px -30px rgba(184,60,77,0.4)",
      }}
      aria-live="polite"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -end-24 -top-24 h-56 w-56 rounded-full opacity-30 blur-3xl"
        style={{ background: "#B83C4D" }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#FAF6F7]"
            style={{
              background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
              boxShadow: "0 6px 16px -6px rgba(184,60,77,0.7)",
            }}
            aria-hidden
          >
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="text-[13px] font-bold uppercase tracking-wider text-[#FAF6F7]/75">
            {stepCounter}
          </span>
        </div>

        {/* W2.5 (Itzik #9) — title + body bumped on mobile so the
            stage-completion modal feels like a moment, not a footnote.
            Title now starts at 28px (was 26), body at 19px (was 16). */}
        <CmsText
          cmsKey={`journeyAssessment.interstitial.step${def.step}.title`}
          as="h2"
          className="mt-4 font-heading text-[28px] font-extrabold leading-tight text-white sm:text-[32px]"
        />
        <CmsText
          cmsKey={`journeyAssessment.interstitial.step${def.step}.body`}
          as="p"
          className="mt-3 max-w-prose text-[19px] leading-[1.55] text-white/85 sm:text-[20px]"
        />

        <div className="mt-6 flex items-center justify-end">
          <Button
            type="button"
            onClick={onContinue}
            className="min-h-[50px] rounded-full px-7 text-[18px] font-bold"
            style={{
              background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
            }}
          >
            <CmsText cmsKey="journeyAssessment.interstitial.continue" />
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
