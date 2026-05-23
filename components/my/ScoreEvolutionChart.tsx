/**
 * ScoreEvolutionChart (v2 — 2026-05-22)
 * ─────────────────────────────────────────────────────────
 * Three score cards (חברות / התמודדות / תשוקה) instead of an SVG
 * line chart. The line chart was unreadable when the data was flat
 * or had only two points — almost always the case in the first
 * months of a journey. The card-based design surfaces the actual
 * numbers, the delta from the previous measurement, and a plain
 * Hebrew label so the couple immediately understands *what
 * changed* rather than having to read a graph.
 *
 * Visual model:
 *   - All three pillars are normalized to "higher = healthier" before
 *     display. friendship & conflictHealth come that way naturally;
 *     passionRisk is inverted (100 - raw) and labeled simply as
 *     "תשוקה" so the user doesn't need to mentally invert anything.
 *   - Arrow + color encode the *health direction*, not the raw delta
 *     direction. Going from passion_risk 40 → 30 means the displayed
 *     value goes from 60 → 70, shown as ↑ +10 (green) "התחזק".
 *
 * Single-measurement state: shows current values with no arrow and a
 * short caption ("ממתינים למדידה נוספת"). The old chart hid itself
 * entirely with <2 points — the new cards still inform the user
 * even on baseline.
 *
 * Component signature unchanged so the page-level import keeps
 * working. Pages that previously gated on length>=2 may want to
 * relax to length>=1 to take advantage of the baseline rendering.
 */

import type { ScorePoint } from "@/lib/journey/score-history";

interface Props {
  isHe:   boolean;
  points: ScorePoint[];
  /** Optional title override. Falls back to a friendly default. */
  title?: string;
}

interface Pillar {
  key:    "friendship" | "conflictHealth" | "passionRisk";
  he:     string;
  en:     string;
  invert: boolean; // when true, display 100 - raw so higher = healthier
  hintHe: string;  // tiny clarifier under the pillar name
  hintEn: string;
}

const PILLARS: Pillar[] = [
  {
    key:    "friendship",
    he:     "חברות",
    en:     "Friendship",
    invert: false,
    hintHe: "כמה אתם חברים",
    hintEn: "How close",
  },
  {
    key:    "conflictHealth",
    he:     "התמודדות",
    en:     "Coping",
    invert: false,
    hintHe: "ניהול חיכוכים",
    hintEn: "Handling conflict",
  },
  {
    key:    "passionRisk",
    he:     "תשוקה",
    en:     "Passion",
    invert: true,
    hintHe: "חיוניות הזוגיות",
    hintEn: "Spark vitality",
  },
];

/** Convert a raw score to its displayed value (handling inversion). */
function displayed(raw: number | null, invert: boolean): number | null {
  if (raw === null) return null;
  return invert ? 100 - raw : raw;
}

function arrowSymbol(delta: number): string {
  if (delta > 0) return "↑";
  if (delta < 0) return "↓";
  return "→";
}

/** Human-feel Hebrew/English label for a delta. Keep these short. */
function humanLabel(delta: number, isHe: boolean): string {
  if (delta >= 8)  return isHe ? "קפיצה ממש יפה" : "Strong gain";
  if (delta >= 3)  return isHe ? "התחזקתם"        : "Improved";
  if (delta >  0)  return isHe ? "עלייה קלה"      : "Up a bit";
  if (delta === 0) return isHe ? "יציבות"         : "Steady";
  if (delta > -3)  return isHe ? "ירידה קלה"      : "Down a bit";
  if (delta > -8)  return isHe ? "כדאי לשים לב"   : "Worth noting";
  return isHe ? "צריך תשומת לב"  : "Needs attention";
}

export function ScoreEvolutionChart({ isHe, points, title }: Props) {
  if (points.length === 0) return null;

  const latest   = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const isFirst  = previous === null;

  return (
    <section
      className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
      aria-label={title ?? (isHe ? "המדדים שלכם" : "Your scores")}
    >
      <header className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold tracking-wider text-white/85">
            {title ?? (isHe ? "המדדים שלכם" : "Your scores")}
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
            {isFirst
              ? (isHe
                  ? "המדידה הראשונה שלכם. המדידה הבאה תראה לאן הלכתם."
                  : "Your baseline. The next check-in will show where you've moved.")
              : (isHe
                  ? "ההשוואה היא מול המדידה הקודמת שלכם."
                  : "Compared to your previous measurement.")}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/55">
          {isHe ? `${points.length} ${points.length === 1 ? "מדידה" : "מדידות"}` : `${points.length} ${points.length === 1 ? "check" : "checks"}`}
        </span>
      </header>

      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {PILLARS.map((p) => {
          const current = displayed(latest[p.key], p.invert);
          const prev    = previous ? displayed(previous[p.key], p.invert) : null;
          const delta   = current !== null && prev !== null ? current - prev : null;

          const positive = delta !== null && delta > 0;
          const negative = delta !== null && delta < 0;

          // Color scheme — health-oriented, not raw-direction-oriented.
          const accentText =
            positive ? "text-emerald-300" :
            negative ? "text-rose-300"    :
                       "text-white/55";

          const cardGradient =
            positive ? "from-emerald-500/[0.10] to-emerald-500/[0.01]" :
            negative ? "from-rose-500/[0.10] to-rose-500/[0.01]"       :
                       "from-white/[0.04] to-white/[0.01]";

          const cardBorder =
            positive ? "border-emerald-400/20" :
            negative ? "border-rose-400/20"    :
                       "border-white/[0.07]";

          return (
            <li
              key={p.key}
              className={`relative overflow-hidden rounded-xl border ${cardBorder} bg-gradient-to-br ${cardGradient} p-3 sm:p-4`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[12px] font-bold tracking-wide text-white/85">
                    {isHe ? p.he : p.en}
                  </div>
                  <div className="mt-0.5 text-[10px] text-white/40">
                    {isHe ? p.hintHe : p.hintEn}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex items-baseline gap-1">
                <span className="tabular-nums text-[28px] font-bold leading-none text-white/95">
                  {current !== null ? current : "—"}
                </span>
                <span className="text-[11px] text-white/40">/ 100</span>
              </div>

              {delta !== null ? (
                <div className={`mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] ${accentText}`}>
                  <span aria-hidden className="text-[15px] font-bold leading-none">
                    {arrowSymbol(delta)}
                  </span>
                  <span className="tabular-nums font-bold">
                    {delta > 0 ? "+" : ""}{delta}
                  </span>
                  <span className="text-white/60">
                    {humanLabel(delta, isHe)}
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-[12px] text-white/40">
                  {isHe ? "ממתינים למדידה נוספת" : "Awaiting next measurement"}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
