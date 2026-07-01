"use client";

// ============================================================
// components/journey/PromoExpiryCountdown.tsx
//
// Flat number-tile countdown shown inside the paywall price card next to
// the monthly package price. Same TILE structure as the games
// ComingSoonCountdown, but restyled flat/clean for the LIGHT results
// theme (light lilac tiles, dark numerals — no dark chrome/shadow).
//
// Reuses the shared per-second engine (hooks/useCountdown) — counts down
// to the promo's ends_at (the same promo that drives the struck price) and
// calls router.refresh() at 0 so the price reverts to regular automatically.
//
// Renders inline-safe <span>s (so it can sit inside the cadence-option
// <button>). Nothing until mounted (avoids hydration mismatch) or expired.
// The eyebrow label is CMS-editable (journeyAssessment.analysis.promoEndsPrefix).
// ============================================================

import { useRouter } from "next/navigation";
import { useCountdown } from "@/hooks/useCountdown";

const pad = (n: number) => String(n).padStart(2, "0");
const FONT = 'var(--font-heebo), "Assistant", "Heebo", system-ui, sans-serif';

export function PromoExpiryCountdown({
  endsAt,
  isHe,
  label,
  className = "",
}: {
  /** ISO promo end time (subscription_promos.ends_at). */
  endsAt: string;
  isHe: boolean;
  /** CMS-editable eyebrow (journeyAssessment.analysis.promoEndsPrefix). */
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const { days, hours, minutes, seconds, mounted, expired } = useCountdown(
    endsAt,
    () => router.refresh(),
  );

  if (!mounted || expired) return null;

  const segs = [
    { v: days, u: isHe ? "ימים" : "days" },
    { v: hours, u: isHe ? "שעות" : "hrs" },
    { v: minutes, u: isHe ? "דקות" : "min" },
    { v: seconds, u: isHe ? "שניות" : "sec" },
  ];

  return (
    <span
      className={className}
      role="timer"
      // Day-granularity static a11y label; aria-live off so the ticking
      // seconds don't spam screen readers (tiles are aria-hidden).
      aria-live="off"
      aria-label={`${label} ${days} ${isHe ? "ימים" : "days"}`}
      dir={isHe ? "rtl" : "ltr"}
      style={{ display: "block", marginTop: 8 }}
    >
      <span
        style={{
          display: "block",
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.04em",
          color: "#7a1f2b",
          marginBottom: 5,
        }}
      >
        {label}
      </span>
      {/* LTR so the D:H:M:S reading order is stable in both directions. */}
      <span style={{ display: "inline-flex", gap: 6, direction: "ltr" }} aria-hidden="true">
        {segs.map((s, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: 44,
              borderRadius: 10,
              padding: "6px 7px",
              // Flat light tile — subtle lilac tint, no border/shadow.
              background: "rgba(108,92,231,0.10)",
            }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontSize: 19,
                fontWeight: 800,
                lineHeight: 1,
                color: "#2e2622",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {pad(s.v)}
            </span>
            <span
              style={{
                marginTop: 3,
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: "0.02em",
                color: "#9a8a7c",
              }}
            >
              {s.u}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
