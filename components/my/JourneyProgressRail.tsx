/**
 * JourneyProgressRail — horizontal progress strip above the pillar
 * grid that tells the user "I am inside a process" at a glance.
 *
 * MVP day 2 + Phase 2A:
 *   - Receives a list of entries (RailEntry[]) from the page.
 *   - Two sources for that list: a STATIC fallback (six baseline
 *     topics) for users with no assigned content, and a DYNAMIC
 *     version that aggregates the user's real journey timeline.
 *   - This component only renders. It doesn't fetch or compute the
 *     statuses — that lives in lib/dashboard/journey-rail.ts.
 *   - Static, no animation. The only visual cues are the per-pill
 *     icon, color, and the small hint line.
 */

import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import type { RailEntry } from "@/lib/dashboard/journey-rail";

export function JourneyProgressRail({
  isHe,
  entries,
  hasJourneyEntitlement,
  isDynamic,
}: {
  isHe: boolean;
  entries: RailEntry[];
  hasJourneyEntitlement: boolean;
  /** True when the entries came from the user's real timeline,
   *  false when they're the static fallback. Drives the small
   *  caption above the rail. */
  isDynamic: boolean;
}) {
  // Logged-in users without a Journey purchase still see the rail —
  // it's the clearest "what you'd get" preview. We dim it slightly
  // and label it as a preview.
  const previewMode = !hasJourneyEntitlement;

  // Don't render anything if there's nothing to show — protects the
  // page when an unexpected empty array slips through.
  if (entries.length === 0) return null;

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
            ? isHe ? "תצוגה מקדימה" : "Preview"
            : isDynamic
              ? isHe ? "מבוסס על התוכנית האישית שלכם" : "Based on your personal program"
              : isHe ? "השלב הנוכחי מסומן" : "Current step highlighted"}
        </p>
      </div>

      <ol
        className={[
          "mt-3 flex gap-2 overflow-x-auto pb-1",
          "snap-x snap-mandatory",
          "[scrollbar-width:none] [-ms-overflow-style:none]",
          "[&::-webkit-scrollbar]:hidden",
        ].join(" ")}
      >
        {entries.map((entry) => (
          <li
            key={entry.key}
            className="snap-start"
            aria-current={entry.status === "current" ? "step" : undefined}
          >
            <RailPill entry={entry} />
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[12px] leading-relaxed text-white/55">
        {previewMode
          ? isHe
            ? "תוכנית עבודה שמותאמת אישית לכם — מתחילה באבחון ונבנית סביב הנושאים שעולים מהתשובות שלכם."
            : "A personalized work program — starts with the assessment and is built around topics emerging from your answers."
          : isHe
            ? "אנחנו עובדים על התשובות שלכם. כל פעם שיש תוכן חדש, הוא ייפתח כאן. אין הפתעות."
            : "We're working on your answers. New content opens here when it's ready. No surprises."}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function RailPill({ entry }: { entry: RailEntry }) {
  const surfaceClass =
    entry.status === "completed"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : entry.status === "current"
        ? "border-white/40 bg-white/[0.08] text-white shadow-sm shadow-white/10"
        : "border-white/[0.06] bg-white/[0.02] text-white/45";

  const Icon =
    entry.status === "completed"
      ? CheckCircle2
      : entry.status === "current"
        ? Sparkles
        : Lock;

  return (
    <div
      className={[
        "group flex min-w-[150px] flex-col items-start gap-1 rounded-xl border px-3.5 py-2.5",
        "transition-colors duration-200",
        surfaceClass,
      ].join(" ")}
      title={entry.hint}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="text-[10px] uppercase tracking-wider text-current/70">
          {entry.hint}
        </span>
      </div>
      <span className="text-sm font-semibold leading-snug">{entry.label}</span>
    </div>
  );
}
