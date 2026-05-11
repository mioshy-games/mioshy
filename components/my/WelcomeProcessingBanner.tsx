/**
 * WelcomeProcessingBanner — calm "your experts are working on your
 * details" banner shown to users who recently finished the assessment
 * and don't yet have any active assignments.
 *
 * Tone: clinical, present-tense, no marketing voice. Reassures the
 * user that the silence between "I finished the assessment" and "I
 * see content" is intentional, not broken.
 *
 * v2 (Itzik 2026-05-07):
 *   • Now accepts `topPriority` + `focusLabel` so the banner shows the
 *     user's actual ranking result, not just a generic "we'll look at
 *     it" message. Concretely, the user sees: "Your top focus is X"
 *     and a short reason — that's the proof we read their answers.
 *
 *   • Optional `firstItemHref` shows a "start with the opening exercise"
 *     link when the day-1 override has materialized one item that's
 *     already unlocked.
 *
 * Render condition (caller decides):
 *   - User has Journey entitlement
 *   - assessmentStage === "completed"
 *   - hasActiveAssignments === false  (or has them but the day-1 hint
 *     is appropriate)
 */

import { Clock, Sparkles, ShieldCheck, Target } from "lucide-react";
import { Link } from "@/navigation";

export function WelcomeProcessingBanner({
  isHe,
  focusLabel = null,
  firstItemHref = null,
}: {
  isHe: boolean;
  /** Localised priority label, e.g. "תקשורת" / "Communication". When
   *  set, the banner surfaces it as a "your top focus" badge so the
   *  user sees concrete proof their assessment was processed. */
  focusLabel?: string | null;
  /** When the day-1 override has materialised an item that is already
   *  unlocked, pass its href (e.g. /he/my/journey?step=...) so the
   *  banner can offer "open the opening exercise". */
  firstItemHref?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-emerald-300/[0.18] bg-gradient-to-br from-emerald-500/[0.08] via-slate-950/40 to-slate-950/60 p-5 backdrop-blur-md">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-500/[0.12]">
          <Sparkles className="size-5 text-emerald-200" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-semibold text-white">
            {isHe
              ? "המומחים שלנו עוברים על האבחון שלכם"
              : "Our experts are reviewing your assessment"}
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-white/75">
            {isHe
              ? "בשעות הקרובות נבנה לכם תוכנית עבודה אישית לפי התשובות שלכם. כל פריט תוכן נבחר ידנית — לא מתבנית."
              : "In the next hours we'll build your personal program around your answers. Every item is hand-picked — not from a template."}
          </p>

          {/* Top focus badge — only when we know it. This is the proof
              that the assessment was processed. */}
          {focusLabel ? (
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-500/[0.14] px-3.5 py-1.5"
              role="status"
            >
              <Target
                className="size-4 text-emerald-200"
                aria-hidden="true"
              />
              <span className="text-[14px] text-emerald-100/95">
                {isHe
                  ? "המוקד הראשון שלך:"
                  : "Your top focus:"}
              </span>
              <span className="text-[14px] font-semibold text-white">
                {focusLabel}
              </span>
            </div>
          ) : null}

          {/* Day-1 override: when an opening exercise is unlocked, give
              the user a single direct link to open it. */}
          {firstItemHref ? (
            <div className="mt-4">
              <Link
                href={firstItemHref}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-emerald-700 shadow-md hover:bg-emerald-50 hover:shadow-lg transition"
              >
                {isHe
                  ? "להתחיל מתרגיל הפתיחה"
                  : "Start with the opening exercise"}
                <span aria-hidden className="text-base">
                  {isHe ? "←" : "→"}
                </span>
              </Link>
            </div>
          ) : null}

          <ul className="mt-4 grid gap-1.5 text-[13px] text-white/65 sm:grid-cols-2">
            <li className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 text-white/45" aria-hidden="true" />
              {isHe ? "תוצאות אבחון נסקרות" : "Assessment is being reviewed"}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-white/45" aria-hidden="true" />
              {isHe ? "התכנים נבנים אישית" : "Content built specifically for you"}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck
                className="size-3.5 text-emerald-300/70"
                aria-hidden="true"
              />
              {isHe ? "פרטיות מלאה" : "Fully private"}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 text-white/45" aria-hidden="true" />
              {isHe
                ? "מומחה ייצור איתכם קשר בקרוב"
                : "An expert will reach out soon"}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
