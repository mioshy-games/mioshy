"use client";

/**
 * components/games/ComingSoonCountdown.tsx
 *
 * Work-order 2026-06-15, part D — the live "opens in …" countdown shown on a
 * scheduled (coming-soon) game card in both catalogues.
 *
 * Ticks every second. The moment it reaches the open time it calls
 * router.refresh() once, so the server re-renders the card in its now-open
 * state — the game "opens automatically" with no manual flag and no cron. (A
 * fresh page load would also show it open, since the open state is computed
 * live from opens_at; the refresh just makes an already-open tab flip on time.)
 *
 * Labels are inline he/en UI scaffolding, matching the catalogue cards'
 * existing convention (price / NEW / POPULAR are hardcoded the same way). The
 * schedule itself — the only thing that must be admin-controlled — is the
 * opens_at column.
 */

import { useRouter } from "next/navigation";
import { useCountdown } from "@/hooks/useCountdown";

export function ComingSoonCountdown({
  opensAt,
  isHe,
  className = "",
}: {
  /** ISO open time. */
  opensAt: string;
  isHe: boolean;
  className?: string;
}) {
  const router = useRouter();
  // Shared per-second countdown (hooks/useCountdown). Fires router.refresh()
  // once at the open time so an already-open tab flips on time.
  const { days, hours, minutes, seconds, mounted, expired } = useCountdown(
    opensAt,
    () => router.refresh(),
  );

  const prefix = isHe ? "נפתח בעוד" : "Opens in";

  // Pre-mount / just-opened fallback — a calm static chip.
  if (!mounted || expired) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-[13px] font-semibold text-white/85 backdrop-blur ${className}`}
        dir={isHe ? "rtl" : "ltr"}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
        {isHe ? "בקרוב" : "Coming soon"}
      </div>
    );
  }

  const segs: Array<{ value: number; label: string }> = [
    { value: days, label: isHe ? "ימים" : "days" },
    { value: hours, label: isHe ? "שעות" : "hrs" },
    { value: minutes, label: isHe ? "דקות" : "min" },
    { value: seconds, label: isHe ? "שניות" : "sec" },
  ];

  return (
    <div
      className={`inline-flex flex-col gap-1.5 rounded-2xl border border-white/15 bg-black/45 px-3 py-2 backdrop-blur ${className}`}
      dir={isHe ? "rtl" : "ltr"}
      role="timer"
      // a11y (M7): static, day-granularity label + aria-live off so the
      // per-second ticking doesn't spam screen readers. The visual digits
      // below are aria-hidden for the same reason.
      aria-live="off"
      aria-label={`${prefix} ${days} ${isHe ? "ימים" : "days"}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-200">
        {prefix}
      </span>
      {/* Numbers stay LTR so the D:H:M:S reading order is stable in both dirs. */}
      <div className="flex items-stretch gap-1.5" dir="ltr" aria-hidden="true">
        {segs.map((seg, i) => (
          <div
            key={i}
            className="flex min-w-[44px] flex-col items-center rounded-lg bg-white/10 px-2 py-1"
          >
            <span className="font-heading text-[20px] font-extrabold leading-none tabular-nums text-white">
              {String(seg.value).padStart(2, "0")}
            </span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/55">
              {seg.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
