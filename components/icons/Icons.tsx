/**
 * Icons — inline SVG drop-in replacements for the lucide-react icons
 * used on hot-path public marketing surfaces (catalog cards, hero,
 * pricing). Each component matches Lucide's default chrome:
 *
 *   viewBox: 0 0 24 24
 *   fill:    none
 *   stroke:  currentColor
 *   stroke-width:  2
 *   stroke-linecap:  round
 *   stroke-linejoin: round
 *
 * The path data is copied verbatim from Lucide's source so the visual
 * output is pixel-identical to `<Heart />` from lucide-react.
 *
 * Why we bother:
 *   • Lucide-react is correctly tree-shaken in production, but each
 *     icon is still a React component (`React.createElement` overhead).
 *   • On /mioshy-sex, the catalog renders 30+ game cards × 3 icons each
 *     ≈ 90 icon component instantiations per render — measurable TBT
 *     contribution flagged by Lighthouse.
 *   • Inline SVG components compile to direct `<svg>` elements with
 *     no per-icon library wrapper, no `forwardRef`, no `defaultProps`,
 *     no class merging — fastest possible path React can offer.
 *
 * API: each component accepts `className` (for sizing/color via
 * Tailwind classes like `h-3.5 w-3.5 text-rose-300`) and `aria-hidden`.
 * Other SVG attributes can be added if needed.
 *
 * Adding more icons: paste the path data from
 * https://lucide.dev/icons/<name> into a new component below.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const DEFAULTS: IconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

export function ArrowRight(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function Check(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function Crown(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function Flame(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
    </svg>
  );
}

export function Heart(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
    </svg>
  );
}

// Exported as `ImageIcon` to match the alias Lucide consumers used,
// since `Image` collides with `next/image` in this codebase.
export function ImageIcon(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

export function MessageCircleHeart(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
      <path d="M7.828 13.07A3 3 0 0 1 12 8.764a3 3 0 0 1 5.004 2.224 3 3 0 0 1-.832 2.083l-3.447 3.62a1 1 0 0 1-1.45-.001z" />
    </svg>
  );
}

export function Sparkles(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      <path d="M20 2v4" />
      <path d="M22 4h-4" />
      <circle cx="4" cy="20" r="2" />
    </svg>
  );
}

export function Star(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  );
}

// 2026-05-20 — Chrome layout icons added (SiteHeader, SiteFooter,
// MobileServicesBar). These render on EVERY page, so the perf win
// scales beyond /mioshy-sex.

export function Gamepad2(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <line x1="6" x2="10" y1="11" y2="11" />
      <line x1="8" x2="8" y1="9" y2="13" />
      <line x1="15" x2="15.01" y1="12" y2="12" />
      <line x1="18" x2="18.01" y1="10" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z" />
    </svg>
  );
}

export function Home(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export function Library(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="m16 6 4 14" />
      <path d="M12 6v14" />
      <path d="M8 8v12" />
      <path d="M4 4v16" />
    </svg>
  );
}

export function LogOut(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

export function Menu(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

export function X(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function Mail(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function Globe(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

// 2026-05-20 batch 2 — icons used on /mioshy-sex/[slug] detail page
// + AdultsHeroBuy (CTA / pairing flow). Adding these means the lucide
// bundle no longer needs to load for the entire /mioshy-sex surface.

export function CheckCircle2(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function Target(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function Copy(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

// `Loader2` (Lucide's spinning circle) — keeping the visual identity
// (rotation) means we attach a CSS animation. Consumer sites already
// expect the spin via Tailwind's `animate-spin` class on the SVG.
export function Loader2(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function Lock(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function Play(props: IconProps) {
  return (
    <svg {...DEFAULTS} {...props}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}
