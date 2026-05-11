/**
 * ScoreEvolutionChart
 * ─────────────────────────────────────────────────────────
 * Layer-4 inline SVG line chart for score evolution. No chart
 * library — pure SVG so the whole module is ~5KB rendered and
 * has zero hydration overhead.
 *
 * Three lines:
 *   - friendship    (higher = better)
 *   - conflictHealth (higher = better)
 *   - passionRisk   (rendered INVERTED so visual up always = good)
 *
 * Renders nothing when fewer than 2 points are supplied (single
 * baseline isn't a story).
 */

import type { ScorePoint } from "@/lib/journey/score-history";

interface Props {
  isHe:   boolean;
  points: ScorePoint[];
  /** Title shown above the chart. Optional — page can render its own. */
  title?: string;
}

const W = 360;
const H = 160;
const PAD_X = 12;
const PAD_Y = 12;

const SERIES = [
  {
    key:    "friendship" as const,
    he:     "חברות",
    en:     "Friendship",
    color:  "#34d399", // emerald
    invert: false,
  },
  {
    key:    "conflictHealth" as const,
    he:     "התמודדות",
    en:     "Conflict",
    color:  "#fbbf24", // amber
    invert: false,
  },
  {
    key:    "passionRisk" as const,
    he:     "תשוקה",
    en:     "Passion",
    color:  "#f43f5e", // rose
    invert: true,
  },
];

export function ScoreEvolutionChart({ isHe, points, title }: Props) {
  if (points.length < 2) return null;

  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const lastIdx = points.length - 1;
  const xFor = (i: number) =>
    PAD_X + (i / Math.max(1, lastIdx)) * innerW;
  const yFor = (val: number) =>
    PAD_Y + innerH - (val / 100) * innerH;

  return (
    <section
      className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
      aria-label={title ?? (isHe ? "התקדמות הציונים" : "Score evolution")}
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-white/85">
          {title ?? (isHe ? "התקדמות הציונים" : "Score evolution")}
        </h3>
        <span className="text-[11px] text-white/50">
          {isHe
            ? `${points.length} נקודות מדידה`
            : `${points.length} measurements`}
        </span>
      </header>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
      >
        {/* Soft horizontal guides at 25/50/75 */}
        {[25, 50, 75].map((g) => (
          <line
            key={g}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={yFor(g)}
            y2={yFor(g)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}

        {/* Series */}
        {SERIES.map((s) => {
          const dPts = points.map((p, i) => {
            const raw = p[s.key] ?? null;
            if (raw === null) return null;
            const v = s.invert ? 100 - raw : raw;
            return { x: xFor(i), y: yFor(v) };
          });
          // Skip series with fewer than 2 valid points.
          const valid = dPts.filter((p): p is { x: number; y: number } => !!p);
          if (valid.length < 2) return null;
          const path = valid
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(" ");
          return (
            <g key={s.key}>
              <path
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Endpoint dot */}
              <circle
                cx={valid[valid.length - 1].x}
                cy={valid[valid.length - 1].y}
                r={3}
                fill={s.color}
              />
            </g>
          );
        })}
      </svg>

      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/65">
        {SERIES.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            {isHe ? s.he : s.en}
            {s.invert ? (
              <span className="text-white/35">
                {isHe ? " (הפוך)" : " (inverted)"}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
