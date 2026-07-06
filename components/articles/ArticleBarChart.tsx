import type { ReactNode } from "react";
import type { ArticleGraph } from "@/lib/types/database";

/**
 * ArticleBarChart — a static, self-contained SVG chart in the brand palette,
 * rendered inline in an article body at the {{graph}} token. Server component,
 * responsive via viewBox, accessible via a text alternative.
 *
 * Supports two shapes:
 *   • type "bars"          — a single series of columns.
 *   • type "grouped-bars"  — N category clusters × M series (e.g. with vs
 *                            without), with a legend.
 */

const SERIES_FILLS = ["url(#mioBar)", "#cbd5e1"]; // brand gradient, then muted
const SERIES_SOLID = ["#a21caf", "#94a3b8"]; // legend swatches (approx)

export function ArticleBarChart({ graph }: { graph: ArticleGraph }) {
  if (graph.type === "grouped-bars") return <GroupedChart graph={graph} />;
  return <SingleChart graph={graph} />;
}

function Frame({
  title,
  source,
  alt,
  width,
  height,
  legend,
  children,
}: {
  title?: string;
  source?: string;
  alt: string;
  width: number;
  height: number;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="my-10" dir="rtl">
      {title ? (
        <figcaption className="mb-3 text-center text-[1.0625rem] font-bold leading-snug text-gray-900">
          {title}
        </figcaption>
      ) : null}
      {legend}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={alt}
          className="mx-auto block h-auto w-full max-w-[620px]"
        >
          <defs>
            <linearGradient id="mioBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#db2777" />
            </linearGradient>
          </defs>
          {children}
        </svg>
      </div>
      {source ? (
        <figcaption className="mt-3 text-center text-xs text-gray-400">
          מקור: {source}
        </figcaption>
      ) : null}
    </figure>
  );
}

function SingleChart({
  graph,
}: {
  graph: Extract<ArticleGraph, { type: "bars" }>;
}) {
  const bars = graph.bars ?? [];
  if (bars.length === 0) return null;
  const barW = 90;
  const gap = 44;
  const padX = 24;
  const chartH = 240;
  const topPad = 40;
  const baseline = chartH - 44;
  const width = padX * 2 + bars.length * barW + (bars.length - 1) * gap;
  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const usableH = baseline - topPad;
  const alt =
    (graph.title ? `${graph.title}. ` : "") +
    bars.map((b) => `${b.label}: ${b.display ?? b.value}`).join(", ") +
    (graph.source ? `. מקור: ${graph.source}` : "");

  return (
    <Frame title={graph.title} source={graph.source} alt={alt} width={width} height={chartH}>
      <line x1={padX / 2} y1={baseline} x2={width - padX / 2} y2={baseline} stroke="#e5e7eb" strokeWidth={2} />
      {bars.map((b, i) => {
        const h = Math.max(2, (b.value / maxVal) * usableH);
        const x = padX + i * (barW + gap);
        const y = baseline - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={10} fill="url(#mioBar)" />
            <text x={x + barW / 2} y={y - 12} textAnchor="middle" className="fill-gray-900" style={{ fontSize: 22, fontWeight: 700 }}>
              {b.display ?? String(b.value)}
            </text>
            <text x={x + barW / 2} y={baseline + 26} textAnchor="middle" className="fill-gray-500" style={{ fontSize: 18 }}>
              {b.label}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

function GroupedChart({
  graph,
}: {
  graph: Extract<ArticleGraph, { type: "grouped-bars" }>;
}) {
  const groups = graph.groups ?? [];
  const seriesLabels = graph.seriesLabels ?? [];
  const seriesCount = Math.max(1, ...groups.map((g) => g.values.length));
  if (groups.length === 0) return null;

  const barW = 40;
  const inGroupGap = 10;
  const groupGap = 44;
  const padX = 20;
  const chartH = 260;
  const topPad = 42;
  const baseline = chartH - 52;
  const groupW = seriesCount * barW + (seriesCount - 1) * inGroupGap;
  const width = padX * 2 + groups.length * groupW + (groups.length - 1) * groupGap;
  const maxVal = Math.max(...groups.flatMap((g) => g.values), 1);
  const usableH = baseline - topPad;

  const alt =
    (graph.title ? `${graph.title}. ` : "") +
    groups
      .map(
        (g) =>
          `${g.label}: ` +
          g.values
            .map((v, s) => `${seriesLabels[s] ?? `סדרה ${s + 1}`} ${g.displays?.[s] ?? v}`)
            .join(", "),
      )
      .join("; ") +
    (graph.source ? `. מקור: ${graph.source}` : "");

  const legend = (
    <div className="mb-4 flex flex-wrap justify-center gap-4">
      {seriesLabels.map((lbl, s) => (
        <span key={s} className="inline-flex items-center gap-2 text-sm text-gray-600">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: SERIES_SOLID[s] ?? "#94a3b8" }}
          />
          {lbl}
        </span>
      ))}
    </div>
  );

  return (
    <Frame title={graph.title} source={graph.source} alt={alt} width={width} height={chartH} legend={legend}>
      <line x1={padX / 2} y1={baseline} x2={width - padX / 2} y2={baseline} stroke="#e5e7eb" strokeWidth={2} />
      {groups.map((g, gi) => {
        const gx = padX + gi * (groupW + groupGap);
        return (
          <g key={gi}>
            {g.values.map((v, s) => {
              const h = Math.max(2, (v / maxVal) * usableH);
              const x = gx + s * (barW + inGroupGap);
              const y = baseline - h;
              return (
                <g key={s}>
                  <rect x={x} y={y} width={barW} height={h} rx={8} fill={SERIES_FILLS[s] ?? "#cbd5e1"} />
                  <text x={x + barW / 2} y={y - 10} textAnchor="middle" className="fill-gray-900" style={{ fontSize: 17, fontWeight: 700 }}>
                    {g.displays?.[s] ?? String(v)}
                  </text>
                </g>
              );
            })}
            <text x={gx + groupW / 2} y={baseline + 24} textAnchor="middle" className="fill-gray-600" style={{ fontSize: 15 }}>
              {g.label}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}
