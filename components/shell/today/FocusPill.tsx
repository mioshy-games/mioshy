/**
 * FocusPill — small wine-tinted chip that names the user's current
 * priority focus area ("המוקד הנוכחי: מיניות ואינטימיות").
 *
 * Renders null when no focus is set so the page doesn't render an
 * empty pill — gives the parent layout total control over whether to
 * show fallback copy or skip the row entirely.
 */

import { Heart } from "lucide-react";

interface Props {
  /** Localized prefix, e.g. "המוקד הנוכחי". */
  prefix: string;
  /** Localized focus label, e.g. "מיניות ואינטימיות". Null = hide. */
  focusLabel: string | null;
}

export function FocusPill({ prefix, focusLabel }: Props) {
  if (!focusLabel) return null;
  return (
    <span
      className="inline-flex items-center gap-2.5 self-start rounded-full border px-3.5 py-1.5 text-[14px] font-bold"
      style={{
        background: "var(--shell-wine-soft)",
        borderColor: "var(--shell-wine-edge)",
        color: "var(--shell-pink-text)",
      }}
    >
      <Heart className="h-4 w-4" aria-hidden />
      <span>
        {prefix}: {focusLabel}
      </span>
    </span>
  );
}
