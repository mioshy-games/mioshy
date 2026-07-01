"use client";

// ============================================================
// components/journey/PromoExpiryCountdown.tsx
//
// Approved design: docs/promo-timer-mockup-approved.html (version B).
// A brand-gradient pill (same gradient as the CTA buttons) with white
// Frank-Ruhl numerals separated by thin vertical dividers — NO tiles.
// A centered CMS-editable title sits above the D/H/M/S row.
//
// Reuses the shared per-second engine (hooks/useCountdown): counts down to
// the promo's ends_at (the same promo that drives the struck price) and
// calls router.refresh() at 0 so the price reverts to regular automatically.
//
// Adaptive: leading zero units are dropped (< 1 day → no "יום"; < 1 hr → no
// hours; …), always keeping seconds. Renders inline-safe <span>s so it can
// sit inside the cadence-option <button>. Nothing until mounted (avoids
// hydration mismatch) or once expired.
// ============================================================

import { useRouter } from "next/navigation";
import { useCountdown } from "@/hooks/useCountdown";

const pad = (n: number) => String(n).padStart(2, "0");
const SERIF = 'var(--font-frank-ruhl), "Frank Ruhl Libre", serif';
const SANS = 'var(--font-heebo), "Assistant", "Heebo", system-ui, sans-serif';
const GRAD = "linear-gradient(95deg,#6C5CE7 0%,#D6409F 52%,#F79154 100%)";

export function PromoExpiryCountdown({
  endsAt,
  isHe,
  label,
  className = "",
}: {
  /** ISO promo end time (subscription_promos.ends_at). */
  endsAt: string;
  isHe: boolean;
  /** CMS-editable title (journeyAssessment.analysis.promoEndsPrefix). */
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const { days, hours, minutes, seconds, mounted, expired } = useCountdown(
    endsAt,
    () => router.refresh(),
  );

  if (!mounted || expired) return null;

  const all = [
    { v: days, u: isHe ? "יום" : "days" },
    { v: hours, u: isHe ? "שעות" : "hrs" },
    { v: minutes, u: isHe ? "דקות" : "min" },
    { v: seconds, u: isHe ? "שניות" : "sec" },
  ];
  // Drop leading zero units, but always keep at least seconds (the last).
  let start = 0;
  while (start < all.length - 1 && all[start].v === 0) start++;
  const segs = all.slice(start);

  return (
    <span
      className={className}
      role="timer"
      aria-live="off"
      aria-label={`${label} ${days} ${isHe ? "ימים" : "days"}`}
      dir={isHe ? "rtl" : "ltr"}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "center",
        background: GRAD,
        borderRadius: 13,
        padding: "8px 12px",
        boxShadow: "0 8px 20px -10px rgba(214,64,159,.5)",
      }}
    >
      <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 800, color: "#fff", textAlign: "center" }}>
        {label}
      </span>
      {/* LTR so the D:H:M:S reading order is stable in both directions. */}
      <span
        style={{ display: "flex", alignItems: "stretch", gap: 8, direction: "ltr" }}
        aria-hidden="true"
      >
        {segs.flatMap((s, i) => {
          const tile = (
            <span
              key={`t${i}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 38,
              }}
            >
              <span
                style={{
                  fontFamily: SERIF,
                  fontSize: 21,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: "#fff",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {pad(s.v)}
              </span>
              <span style={{ marginTop: 2, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.82)" }}>
                {s.u}
              </span>
            </span>
          );
          return i === 0
            ? [tile]
            : [
                <span
                  key={`s${i}`}
                  style={{ width: 1, alignSelf: "stretch", margin: "2px 0", background: "rgba(255,255,255,.45)" }}
                />,
                tile,
              ];
        })}
      </span>
    </span>
  );
}
