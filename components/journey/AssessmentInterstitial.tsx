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

const STORAGE_KEY = "mioshy:assessment-interstitial-seen";

export interface InterstitialDef {
  /** Index after which this interstitial appears. */
  atIndex: number;
  /** Section number shown on the card (1..4). */
  step: number;
  /** Section header (warm framing of what just happened). */
  he: { title: string; body: string };
  en: { title: string; body: string };
}

export const INTERSTITIALS: InterstitialDef[] = [
  {
    atIndex: 5,
    step: 1,
    he: {
      title: "סיימתם את הבלוק הראשון",
      body: "עוד רגע ונשאל איך אתם מתמודדים ברגעים הקשים יותר יחד. תיקחו נשימה.",
    },
    en: {
      title: "First block done",
      body: "In a moment we'll ask about the harder moments. Take a breath.",
    },
  },
  {
    atIndex: 12,
    step: 2,
    he: {
      title: "זה החלק האישי",
      body: "אינטימיות וחיבור רגשי. בלי שיפוט, בלי תשובות נכונות. עוד שניים-שלושה בלוקים.",
    },
    en: {
      title: "This is the personal part",
      body: "Intimacy and emotional connection. No judgment, no right answers. Two or three blocks left.",
    },
  },
  {
    atIndex: 19,
    step: 3,
    he: {
      title: "חברות זוגית — הבסיס של הכל",
      body: "סיימתם. עכשיו ניגע בחיים היומיומיים שלכם — ואז בעדיפויות שלכם.",
    },
    en: {
      title: "Friendship — the base of everything",
      body: "Done with that. Next we touch the everyday, then your priorities.",
    },
  },
  {
    atIndex: 26,
    step: 4,
    he: {
      title: "כמעט סיימתם",
      body: "השלב האחרון: לדרג את העדיפויות שלכם. זה מה שמכוון את כל המסלול הלאה.",
    },
    en: {
      title: "Almost there",
      body: "Last step: ranking your priorities. This is what shapes the path going forward.",
    },
  },
];

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
  isHe: boolean;
  def: InterstitialDef;
  onContinue: () => void;
}

export function AssessmentInterstitial({ isHe, def, onContinue }: Props) {
  const t = isHe ? def.he : def.en;
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#FAF6F7]/75">
            {isHe ? `שלב ${def.step} / 4` : `Step ${def.step} / 4`}
          </span>
        </div>

        <h2 className="mt-4 font-heading text-[26px] font-extrabold leading-tight text-white sm:text-[30px]">
          {t.title}
        </h2>
        <p className="mt-2 max-w-prose text-[16px] leading-[1.6] text-white/80">
          {t.body}
        </p>

        <div className="mt-6 flex items-center justify-end">
          <Button
            type="button"
            onClick={onContinue}
            className="min-h-[48px] rounded-full px-7 text-[15px] font-bold"
            style={{
              background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
            }}
          >
            {isHe ? "ממשיכים" : "Continue"}
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
