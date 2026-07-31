/**
 * One line icon per journey category (Itzik 2026-07-31).
 *
 * Replaces the generic clock that used to sit on every chapter card and read as
 * "waiting" while the chapter was in fact open.
 *
 * House style: 24×24, stroke-only, `currentColor` so the card controls the
 * tint per state, 1.5 stroke, round caps. No fills — a filled glyph reads as a
 * status badge here, and none of these are statuses.
 */

import type { SVGProps } from "react";
import { CATEGORY_DISPLAY_ORDER, type CategoryKey } from "@/lib/journey/categories";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Sexuality & intimacy — two rings drawing closer. */
function IntimacyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="12" r="5.5" />
      <circle cx="15" cy="12" r="5.5" />
    </svg>
  );
}

/** Love & emotional connection — an open heart. */
function EmotionalConnectionIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20s-7-4.35-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 4.65-7 9-7 9Z" />
    </svg>
  );
}

/** Couple communication — two voices meeting. */
function CommunicationIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5h10a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8l-4 3v-3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z" />
      <path d="M18 9.5h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2v2.5l-3-2.5h-3" />
    </svg>
  );
}

/** Friendship & daily partnership — walking side by side. */
function FriendshipIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="7" r="2.75" />
      <circle cx="16" cy="7" r="2.75" />
      <path d="M3.5 19.5a4.5 4.5 0 0 1 9 0" />
      <path d="M11.5 19.5a4.5 4.5 0 0 1 9 0" />
    </svg>
  );
}

/** Family, parenting & outside pressures — a home holding people. */
function FamilyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5.5 9.8V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.8" />
      <circle cx="9.75" cy="13.5" r="1.4" />
      <circle cx="14.25" cy="13.5" r="1.4" />
      <path d="M8 20a2.4 2.4 0 0 1 3.5-2.1M16 20a2.4 2.4 0 0 0-3.5-2.1" />
    </svg>
  );
}

const BY_KEY: Record<CategoryKey, (p: IconProps) => JSX.Element> = {
  intimacy: IntimacyIcon,
  emotional_connection: EmotionalConnectionIcon,
  communication: CommunicationIcon,
  friendship: FriendshipIcon,
  family: FamilyIcon,
};

/**
 * Resolve by the category slug stored in journey_categories, which matches the
 * canonical keys in lib/journey/categories.ts. Unknown slugs fall back to the
 * emotional-connection glyph rather than rendering nothing.
 */
export function CategoryIcon({
  slug,
  ...props
}: IconProps & { slug: string | null | undefined }) {
  const key = (CATEGORY_DISPLAY_ORDER as string[]).includes(slug ?? "")
    ? (slug as CategoryKey)
    : "emotional_connection";
  const Cmp = BY_KEY[key];
  return <Cmp {...props} />;
}
