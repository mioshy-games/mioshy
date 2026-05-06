/**
 * WelcomeProcessingBanner - calm "your experts are working on your
 * details" banner shown to users who recently finished the assessment
 * and don't yet have any active assignments.
 *
 * Tone: clinical, present-tense, no marketing voice. Reassures the
 * user that the silence between "I finished the assessment" and "I
 * see content" is intentional, not broken.
 *
 * Render condition (caller decides):
 *   - User has Journey entitlement
 *   - assessmentStage === "completed"
 *   - hasActiveAssignments === false
 */

import { Clock, Sparkles, ShieldCheck } from "lucide-react";

export function WelcomeProcessingBanner({
  isHe,
}: {
  isHe: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-300/[0.08] bg-slate-950/40 p-5 backdrop-blur-md">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]">
          <Sparkles className="size-5 text-white/80" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-white">
            {isHe
              ? "המומחים שלנו עוברים על הפרטים שלכם"
              : "Our experts are reviewing your details"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white/70">
            {isHe
              ? "בשעות הקרובות נבנה לכם תוכנית עבודה אישית. המטרה היא להכיר אתכם הכי טוב - ולכן כל פריט תוכן נבחר בקפידה לפי התשובות שלכם, לא מתוך תבנית כללית."
              : "In the next hours we'll build your personal work program. The goal is to get to know you as well as possible - every item is selected based on your answers, not from a generic template."}
          </p>

          <ul className="mt-3 grid gap-1.5 text-[12px] text-white/60 sm:grid-cols-2">
            <li className="inline-flex items-center gap-1.5">
              <Clock className="size-3 text-white/45" aria-hidden="true" />
              {isHe ? "תוצאות אבחון נסקרות" : "Assessment is being reviewed"}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3 text-white/45" aria-hidden="true" />
              {isHe ? "התכנים נבנים אישית" : "Content built specifically for you"}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3 text-emerald-300/70" aria-hidden="true" />
              {isHe ? "פרטיות מלאה" : "Fully private"}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Clock className="size-3 text-white/45" aria-hidden="true" />
              {isHe
                ? "תוכלו להתחיל ברגע שהתוכן ייפתח"
                : "You'll start once content opens"}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
