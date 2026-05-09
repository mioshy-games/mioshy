/**
 * LessonView
 *
 * Phase 1 — turns a journey_item from "post" into "lesson". Renders
 * the 9 structured lesson blocks (when populated) as their own
 * micro-sections, each with its own visual identity:
 *
 *   1. Header (existing — title + category)
 *   2. תובנת מומחים — opening insight (calm, full-width)
 *   3. טעות שכיחה — warning card (rose-amber)
 *   4. מטאפורה — quotation block (italic, accent-bordered)
 *   5. המאמר המלא — main body (existing renderer)
 *   6. תרגיל / משימה — call-to-action card (wine accent, prominent)
 *   7. למדוד השבוע — observation prompt (slate)
 *   8. לעשות / לא לעשות — paired action cards (green / rose)
 *   9. סימן להתקדמות — progress marker (gold accent)
 *  10. מקור — attribution footer (small print)
 *
 * Each block is conditionally rendered: if the item only has a body,
 * the user sees just the body (legacy behaviour). As content backfills,
 * the lesson grows in structure without breaking anything.
 *
 * Server component — pure render, no interactivity. Feedback bar +
 * thread are wired separately on the page.
 */

import { Sparkles, AlertTriangle, Quote, Activity, Check, X, BookOpen, Target } from "lucide-react";
import type { JourneyItem } from "@/lib/journey-content/types";

interface LessonViewProps {
  item:  JourneyItem;
  isHe:  boolean;
}

export function LessonView({ item, isHe }: LessonViewProps) {
  // Pick the right locale for each lesson block, falling back to the
  // other when one is empty.
  const pick = (he: string | null | undefined, en: string | null | undefined) => {
    if (isHe) return (he?.trim() || en?.trim() || "");
    return (en?.trim() || he?.trim() || "");
  };

  const insight     = pick(item.expert_insight_he,    item.expert_insight_en);
  const mistakes    = pick(item.common_mistakes_he,   item.common_mistakes_en);
  const metaphor    = pick(item.metaphor_he,          item.metaphor_en);
  const measurement = pick(item.measurement_he,       item.measurement_en);
  const doThis      = pick(item.do_this_week_he,      item.do_this_week_en);
  const dontThis    = pick(item.dont_this_week_he,    item.dont_this_week_en);
  const progress    = pick(item.progress_marker_he,   item.progress_marker_en);
  const source      = pick(item.source_attribution_he, item.source_attribution_en);
  // The exercise comes from the existing task_he/task_en — task is
  // the call-to-action across legacy + new items.
  const exercise    = pick(item.task_he, item.task_en);
  // Main body comes from body_he/en (the ~500 word deep-dive).
  const body        = pick(item.body_he, item.body_en);

  // Detect "all blocks empty" — render nothing extra (the page's own
  // legacy renderer handles the body). This is a safety net so the
  // component is harmless on pre-077 items.
  const hasAnyLessonBlock =
    !!insight || !!mistakes || !!metaphor || !!measurement ||
    !!doThis || !!dontThis || !!progress;

  return (
    <article
      className="mt-6 space-y-6"
      dir={isHe ? "rtl" : "ltr"}
    >
      {/* 1. Insight — opening framing */}
      {insight ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-white/55">
            <Sparkles className="size-3.5 text-amber-300/70" />
            {isHe ? "התובנה" : "The insight"}
          </div>
          <p className="whitespace-pre-line text-[16px] leading-[1.7] text-white/90">
            {insight}
          </p>
        </section>
      ) : null}

      {/* 2. Common mistake — warning */}
      {mistakes ? (
        <section className="rounded-2xl border border-amber-300/20 bg-amber-500/[0.06] p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-amber-100/85">
            <AlertTriangle className="size-3.5" />
            {isHe ? "טעות שכיחה" : "Common mistake"}
          </div>
          <p className="whitespace-pre-line text-[15px] leading-[1.65] text-amber-50/95">
            {mistakes}
          </p>
        </section>
      ) : null}

      {/* 3. Metaphor — visual anchor */}
      {metaphor ? (
        <section
          className="border-s-[3px] ps-5 sm:ps-6 italic"
          style={{ borderColor: "rgba(184,60,77,0.55)" }}
        >
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/55 not-italic">
            <Quote className="size-3" />
            {isHe ? "כמו..." : "Like..."}
          </div>
          <p className="whitespace-pre-line text-[16px] leading-[1.65] text-white/85">
            {metaphor}
          </p>
        </section>
      ) : null}

      {/* 4. Main body — the deep-dive */}
      {body ? (
        <section className="prose prose-invert max-w-none">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-white/55">
            <BookOpen className="size-3.5" />
            {isHe ? "המאמר המלא" : "The full article"}
          </div>
          <div className="whitespace-pre-line text-[16px] leading-[1.75] text-white/85">
            {body}
          </div>
        </section>
      ) : null}

      {/* 5. Exercise — the call to action, climax of the lesson */}
      {exercise ? (
        <section
          className="rounded-2xl border p-5 sm:p-6"
          style={{
            borderColor: "rgba(184,60,77,0.4)",
            background: "linear-gradient(160deg, rgba(184,60,77,0.10) 0%, rgba(108,46,64,0.05) 100%)",
          }}
        >
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[#FAF6F7]">
            <Target className="size-3.5" />
            {isHe ? "התרגיל השבוע" : "This week's exercise"}
          </div>
          <p className="whitespace-pre-line text-[16px] leading-[1.7] font-medium text-white/95">
            {exercise}
          </p>
        </section>
      ) : null}

      {/* 6. Measurement — observation prompt */}
      {measurement ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-white/55">
            <Activity className="size-3.5 text-blue-200/70" />
            {isHe ? "מה למדוד השבוע" : "What to measure this week"}
          </div>
          <p className="whitespace-pre-line text-[14px] leading-[1.6] text-white/80">
            {measurement}
          </p>
        </section>
      ) : null}

      {/* 7. Do / Don't — paired action cards */}
      {(doThis || dontThis) ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {doThis ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.07] p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-100/85">
                <Check className="size-3.5" />
                {isHe ? "לעשות השבוע" : "Do this week"}
              </div>
              <p className="whitespace-pre-line text-[14px] leading-[1.55] text-emerald-50/95">
                {doThis}
              </p>
            </div>
          ) : null}
          {dontThis ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.07] p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-100/85">
                <X className="size-3.5" />
                {isHe ? "לא השבוע" : "Not this week"}
              </div>
              <p className="whitespace-pre-line text-[14px] leading-[1.55] text-rose-50/95">
                {dontThis}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 8. Progress marker — what success looks like */}
      {progress ? (
        <section
          className="rounded-2xl border p-4"
          style={{
            borderColor: "rgba(251,191,36,0.30)",
            background: "rgba(251,191,36,0.05)",
          }}
        >
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-100/85">
            <Sparkles className="size-3.5" />
            {isHe ? "סימן שזה עובד" : "Sign it's working"}
          </div>
          <p className="whitespace-pre-line text-[14px] leading-[1.55] italic text-amber-50/90">
            {progress}
          </p>
        </section>
      ) : null}

      {/* 9. Source attribution — credit footer */}
      {source ? (
        <footer className="mt-2 border-t border-white/[0.06] pt-3">
          <p className="text-[11px] leading-relaxed text-white/45">
            {isHe ? (
              <>מבוסס על המחקר של <span className="text-white/65">{source}</span> — ניתוח של מיאושי</>
            ) : (
              <>Based on the work of <span className="text-white/65">{source}</span> — Mioshy interpretation</>
            )}
          </p>
        </footer>
      ) : null}

      {/* Marker comment — debug aid for admins inspecting items that
          still need lesson blocks filled in. Not visible to users. */}
      {!hasAnyLessonBlock ? (
        <div
          className="hidden"
          data-lesson-blocks="empty"
          aria-hidden
        />
      ) : null}
    </article>
  );
}
