/**
 * JourneyProgressRail — six pills above the pillar grid that give the
 * user a sense of "I am inside a process" (per docs/my-page-redesign-spec.md
 * §0 day 2 + §4).
 *
 * MVP version (locked):
 *   - Static order. The six topics are baked into this component.
 *   - No DB queries beyond what the parent already fetched.
 *   - Computed current step from `assessmentStage` only:
 *       not_started   → "אבחון" is current, rest is pending
 *       in_progress   → same — current step is still "אבחון"
 *       completed     → "אבחון" is completed, "תובנות" becomes current
 *                        (everything beyond stays pending)
 *   - When the user has an active journey assignment we treat them as
 *     "advancing through topics" but we still don't promise dates;
 *     the rail visually indicates "you're moving".
 *
 * What this is NOT (for now):
 *   - Not connected to journey_assignments / journey_scheduled_items.
 *     The "real rail" version that maps to the admin's content
 *     calendar lives in §13 of the spec — Phase 2.
 *   - Not interactive. Pills are read-only on day 1; later phases
 *     will make completed/active pills clickable to open the item.
 */

import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import type { AssessmentStage } from "@/lib/dashboard/pillar-state";

type StepStatus = "completed" | "current" | "pending";

interface RailStep {
  key: string;
  label_he: string;
  label_en: string;
}

// Six topics, in order. The first one ("אבחון") is the questionnaire
// the user already takes today; the next five are the work topics
// the clinical team builds the program around. Order matters — it
// telegraphs the journey shape.
const STEPS: RailStep[] = [
  { key: "assessment",   label_he: "אבחון",            label_en: "Assessment" },
  { key: "insights",     label_he: "תובנות",           label_en: "Insights" },
  { key: "communication",label_he: "תקשורת זוגית",     label_en: "Communication" },
  { key: "intimacy",     label_he: "מיניות ואינטימיות", label_en: "Intimacy" },
  { key: "love",         label_he: "אהבה וחיבור",      label_en: "Love & connection" },
  { key: "family",       label_he: "משפחה ולחצים",     label_en: "Family & stress" },
];

function deriveStepStatuses(args: {
  assessmentStage: AssessmentStage;
  hasActiveAssignments: boolean;
}): StepStatus[] {
  const { assessmentStage, hasActiveAssignments } = args;

  // Default: all pending
  const out: StepStatus[] = STEPS.map(() => "pending");

  if (assessmentStage === "completed") {
    out[0] = "completed";
    // Once the assessment is done we mark "תובנות" as current — it's
    // the bridge step where the clinician reads answers and prepares
    // the next content. If there's actually content already assigned,
    // keep "תובנות" current (visible "you're being processed") and
    // signal that more is coming.
    out[1] = hasActiveAssignments ? "completed" : "current";
    if (hasActiveAssignments) {
      // Light up the third pill — they're already in the work part.
      out[2] = "current";
    }
  } else {
    // not_started OR in_progress — assessment is the current step
    out[0] = "current";
  }

  return out;
}

export function JourneyProgressRail({
  isHe,
  assessmentStage,
  hasJourneyEntitlement,
  hasActiveAssignments,
}: {
  isHe: boolean;
  assessmentStage: AssessmentStage;
  hasJourneyEntitlement: boolean;
  hasActiveAssignments: boolean;
}) {
  const statuses = deriveStepStatuses({ assessmentStage, hasActiveAssignments });

  // For users without Journey access, we still show the rail — but we
  // ground it as a *preview* with a subtler caption. They see the same
  // shape they'd get if they bought.
  const previewMode = !hasJourneyEntitlement;

  return (
    <div
      className={[
        "rounded-2xl border p-4 sm:p-5",
        previewMode
          ? "border-white/[0.06] bg-slate-950/25"
          : "border-slate-300/[0.08] bg-slate-950/40",
        "backdrop-blur-md",
      ].join(" ")}
      aria-label={isHe ? "מסלול הליווי" : "Coaching path"}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-white/85">
          {isHe ? "מסלול הליווי שלכם" : "Your coaching path"}
        </h2>
        <p className="text-[11px] text-white/45">
          {previewMode
            ? isHe
              ? "תצוגה מקדימה"
              : "Preview"
            : isHe
              ? "השלב הנוכחי מסומן"
              : "Current step highlighted"}
        </p>
      </div>

      {/* Horizontal scroll on small screens, full row on lg+ */}
      <ol
        className={[
          "mt-3 flex gap-2 overflow-x-auto pb-1",
          "snap-x snap-mandatory",
          // Soft inner gradient at the edges to hint at scrollability
          "[scrollbar-width:none] [-ms-overflow-style:none]",
          "[&::-webkit-scrollbar]:hidden",
        ].join(" ")}
      >
        {STEPS.map((step, idx) => (
          <li
            key={step.key}
            className="snap-start"
            // Only the current step ARIA-current
            aria-current={statuses[idx] === "current" ? "step" : undefined}
          >
            <RailPill
              label={isHe ? step.label_he : step.label_en}
              status={statuses[idx]}
              isHe={isHe}
            />
          </li>
        ))}
      </ol>

      {/* Calm reassurance line — calibrated per the §1.5 tone rules.
          Single sentence, formal, no marketing voice. */}
      <p className="mt-3 text-[12px] leading-relaxed text-white/55">
        {previewMode
          ? isHe
            ? "תוכנית עבודה שמותאמת אישית לכם — מתחילה באבחון ונבנית סביב הנושאים שעולים מהתשובות שלכם."
            : "A personalized work program — starts with the assessment and is built around the topics emerging from your answers."
          : isHe
            ? "אנחנו עובדים על התשובות שלכם. כל פעם שיש תוכן חדש, הוא ייפתח כאן. אין הפתעות."
            : "We're working on your answers. New content opens here when it's ready. No surprises."}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// RailPill — one step. Three visual variants per status.
// ─────────────────────────────────────────────────────────────────────

function RailPill({
  label,
  status,
  isHe,
}: {
  label: string;
  status: StepStatus;
  isHe: boolean;
}) {
  const hint =
    status === "completed"
      ? isHe ? "הושלם" : "Completed"
      : status === "current"
        ? isHe ? "השלב הנוכחי" : "Current step"
        : isHe ? "ייפתח בהמשך" : "Coming up";

  // Three visual treatments — kept calm, no animation.
  const surfaceClass =
    status === "completed"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : status === "current"
        ? "border-white/40 bg-white/[0.08] text-white shadow-sm shadow-white/10"
        : "border-white/[0.06] bg-white/[0.02] text-white/45";

  const Icon = status === "completed" ? CheckCircle2 : status === "current" ? Sparkles : Lock;

  return (
    <div
      className={[
        "group flex min-w-[150px] flex-col items-start gap-1 rounded-xl border px-3.5 py-2.5",
        "transition-colors duration-200",
        surfaceClass,
      ].join(" ")}
      title={hint}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="text-[10px] uppercase tracking-wider text-current/70">
          {hint}
        </span>
      </div>
      <span className="text-sm font-semibold leading-snug">{label}</span>
    </div>
  );
}
