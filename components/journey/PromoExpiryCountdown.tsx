"use client";

// ============================================================
// components/journey/PromoExpiryCountdown.tsx
//
// A SUBTLE one-liner shown inside the paywall price card next to the
// price when a promo is active: "המבצע נגמר בעוד 2 ימים 04:11:23".
//
// Reuses the shared per-second countdown (hooks/useCountdown) — the SAME
// engine as the games "opens in …" chip — but styled as a light-theme
// subtle line (no big digit tiles). Counts down to the promo's ends_at
// (the same promo that drives the struck price). At 0 it calls
// router.refresh() once so the server re-renders WITHOUT the promo and
// the price reverts to regular automatically — no admin action.
//
// Renders nothing until mounted (avoids hydration mismatch on the ticking
// seconds) or once expired.
// ============================================================

import { useRouter } from "next/navigation";
import { useCountdown } from "@/hooks/useCountdown";

const pad = (n: number) => String(n).padStart(2, "0");

export function PromoExpiryCountdown({
  endsAt,
  isHe,
  label,
  className = "",
}: {
  /** ISO promo end time (subscription_promos.ends_at). */
  endsAt: string;
  isHe: boolean;
  /** CMS-editable prefix, e.g. "המבצע נגמר בעוד" / "Sale ends in". */
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const { days, hours, minutes, seconds, mounted, expired } = useCountdown(
    endsAt,
    () => router.refresh(),
  );

  // Nothing before the first client tick (no hydration mismatch) or after expiry.
  if (!mounted || expired) return null;

  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const dayWord = days === 1 ? (isHe ? "יום" : "day") : isHe ? "ימים" : "days";
  const dayPart = days > 0 ? `${days} ${dayWord} ` : "";

  return (
    // <span> (not <p>) so it can sit inside the cadence-option <button> next to
    // the price. display:block keeps it on its own subtle line.
    <span
      className={className}
      dir={isHe ? "rtl" : "ltr"}
      role="timer"
      // Day-granularity static a11y label; aria-live off so the ticking
      // seconds don't spam screen readers.
      aria-live="off"
      aria-label={`${label} ${days} ${dayWord}`}
      style={{
        display: "block",
        marginTop: 4,
        fontFamily:
          'var(--font-heebo), "Assistant", "Heebo", system-ui, sans-serif',
        fontSize: 12.5,
        fontWeight: 600,
        color: "#9a8a7c",
      }}
    >
      {label}{" "}
      <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums", color: "#7b6b5e", fontWeight: 700 }}>
        {dayPart}
        {hms}
      </span>
    </span>
  );
}
