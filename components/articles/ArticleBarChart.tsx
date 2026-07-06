import type { ArticleGraph } from "@/lib/types/database";

/**
 * ArticleBarChart — a static, self-contained SVG column chart in the brand
 * gradient, rendered inline in an article body at the {{graph}} token.
 *
 * Server component (no interactivity). Responsive via viewBox: the SVG scales
 * to its container width while keeping the label geometry. Accessible: the
 * whole figure carries a text alternative built from the data.
 */
export function ArticleBarChart({ graph }: { graph: ArticleGraph }) {
  const bars = graph.bars ?? [];
  if (bars.length === 0) return null;

  // Geometry (viewBox units). Width grows with the bar count.
  const barW = 90;
  const gap = 44;
  const padX = 24;
  const chartH = 240;
  const topPad = 40; // room for the value label above each column
  const baseline = chartH - 44; // room for the x-axis labels below
  const width = padX * 2 + bars.length * barW + (bars.length - 1) * gap;
  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const usableH = baseline - topPad;

  const alt =
    (graph.title ? `${graph.title}. ` : "") +
    bars.map((b) => `${b.label}: ${b.display ?? b.value}`).join(", ") +
    (graph.source ? `. מקור: ${graph.source}` : "");

  return (
    <figure className="my-10" dir="rtl">
      {graph.title ? (
        <figcaption className="mb-4 text-center text-[1.0625rem] font-bold leading-snug text-gray-900">
          {graph.title}
        </figcaption>
      ) : null}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${chartH}`}
          role="img"
          aria-label={alt}
          className="mx-auto block h-auto w-full max-w-[560px]"
        >
          <defs>
            <linearGradient id="mioBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#db2777" />
            </linearGradient>
          </defs>
          {/* baseline */}
          <line
            x1={padX / 2}
            y1={baseline}
            x2={width - padX / 2}
            y2={baseline}
            stroke="#e5e7eb"
            strokeWidth={2}
          />
          {bars.map((b, i) => {
            const h = Math.max(2, (b.value / maxVal) * usableH);
            const x = padX + i * (barW + gap);
            const y = baseline - h;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={10}
                  fill="url(#mioBar)"
                />
                <text
                  x={x + barW / 2}
                  y={y - 12}
                  textAnchor="middle"
                  className="fill-gray-900"
                  style={{ fontSize: 22, fontWeight: 700 }}
                >
                  {b.display ?? String(b.value)}
                </text>
                <text
                  x={x + barW / 2}
                  y={baseline + 26}
                  textAnchor="middle"
                  className="fill-gray-500"
                  style={{ fontSize: 18 }}
                >
                  {b.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {graph.source ? (
        <figcaption className="mt-3 text-center text-xs text-gray-400">
          מקור: {graph.source}
        </figcaption>
      ) : null}
    </figure>
  );
}
