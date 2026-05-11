/**
 * StateBadge - a single, calm pill that communicates the state of a
 * pillar card on /my (Day 1 of the redesign, see docs/my-page-redesign-spec.md §0).
 *
 * One of three variants:
 *   - "open"          → 🔓 פתוח / Open
 *   - "in_progress"   → ⏳ בתהליך / In progress
 *   - "not_purchased" → 🔒 לא נרכש / Not yet
 *
 * Replaces the leading emoji icon (🎮 / 🧭 / 💜) on EntitledPillar +
 * ServicePanel cards. The badge itself doesn't link to anything - it
 * just signals state. The card body still owns the click target.
 *
 * Why a separate component (and not inline classes):
 *   - One source of truth for token usage, so badges can't drift in
 *     color/spacing across the dashboard.
 *   - A single place to add a tooltip / a11y label later.
 *   - Reused on the marketing-mode card AND the entitled card.
 */

import { Lock, LockOpen, Loader2 } from "lucide-react"

export type PillarStateKind = "open" | "in_progress" | "not_purchased"

const COPY: Record<PillarStateKind, { he: string; en: string }> = {
  open:           { he: "פתוח",     en: "Open" },
  in_progress:    { he: "בתהליך",   en: "In progress" },
  not_purchased:  { he: "לא נרכש",  en: "Not yet" },
}

const VARIANT_CLASSES: Record<PillarStateKind, string> = {
  // Cool emerald - paid + active
  open:           "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  // Warm amber - mid-flight
  in_progress:    "bg-amber-400/15 text-amber-100 border-amber-300/30",
  // Quiet zinc - not yours yet
  not_purchased:  "bg-white/5 text-white/60 border-white/10",
}

const ICON: Record<PillarStateKind, typeof Lock> = {
  open:           LockOpen,
  in_progress:    Loader2,
  not_purchased:  Lock,
}

export function StateBadge({
  state,
  isHe,
  className = "",
}: {
  state: PillarStateKind
  isHe: boolean
  className?: string
}) {
  const Icon = ICON[state]
  const label = isHe ? COPY[state].he : COPY[state].en

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5",
        "rounded-full border px-2.5 py-0.5",
        "text-[11px] font-semibold uppercase tracking-wide",
        VARIANT_CLASSES[state],
        className,
      ].join(" ")}
      // Static - no animations on this badge per the "Static by default" rule
      // in the spec. Even the in_progress variant doesn't spin; the icon
      // shape alone signals "things are moving".
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  )
}
