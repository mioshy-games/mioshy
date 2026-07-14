"use client";

/**
 * PersonalOfferTimer — tile-style countdown for the personal-window offer
 * (site_settings.personal_window_display='clock'). Design per
 * docs/pricing-redesign-approved.html (.timer): a marketing lead line above a
 * row of tiles, hours on the LEFT (direction:ltr), gradient serif numbers.
 *
 * Wired to the user's own journeys.offer_expires_at. Reuses the shared
 * useCountdown engine and calls router.refresh() at 0 so the server re-renders
 * once the window closes (the discount reverts). Renders nothing before mount
 * (hydration-safe) or once expired.
 */

import { useRouter } from "next/navigation";
import { useCountdown } from "@/hooks/useCountdown";

const pad = (n: number) => String(n).padStart(2, "0");

export function PersonalOfferTimer({
  endsAt,
  isHe,
  label,
}: {
  /** ISO — the user's personal offer_expires_at. */
  endsAt: string;
  isHe: boolean;
  /** Optional lead line above the tiles. Defaults to the offer marketing copy. */
  label?: string;
}) {
  const router = useRouter();
  const { days, hours, minutes, seconds, mounted, expired } = useCountdown(
    endsAt,
    () => router.refresh(),
  );

  if (!mounted || expired) return null;

  // Full days / hours / minutes / seconds, hours-left order (direction:ltr).
  const units: Array<{ v: number; u: string }> = [
    { v: days, u: isHe ? "ימים" : "days" },
    { v: hours, u: isHe ? "שעות" : "hrs" },
    { v: minutes, u: isHe ? "דקות" : "min" },
    { v: seconds, u: isHe ? "שניות" : "sec" },
  ];

  return (
    <div className="pot" role="timer" aria-live="off">
      <div className="pot-lead">
        {label ?? (isHe ? "מבצע חד פעמי לזמן מוגבל" : "A one-time, limited-time offer")}
      </div>
      <div className="pot-tiles">
        {units.map((s, i) => (
          <div className="pot-tile" key={i}>
            <span className="pot-n">{pad(s.v)}</span>
            <span className="pot-u">{s.u}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        .pot {
          text-align: center;
          margin-bottom: 22px;
        }
        .pot-lead {
          font-size: 13px;
          font-weight: 700;
          color: #8a7a6b;
          margin-bottom: 9px;
        }
        .pot-tiles {
          display: flex;
          justify-content: center;
          gap: 9px;
          /* Hours on the LEFT regardless of page direction (clock order). */
          direction: ltr;
        }
        .pot-tile {
          min-width: 56px;
          background: #fff;
          border: 1px solid #ece2d4;
          border-radius: 12px;
          padding: 9px 4px;
          box-shadow: 0 6px 16px -12px rgba(80, 50, 35, 0.4);
        }
        .pot-n {
          display: block;
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
          font-weight: 900;
          font-size: 26px;
          line-height: 1;
          background: linear-gradient(95deg, #6c5ce7 0%, #d6409f 52%, #f79154 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .pot-u {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #8a7a6b;
          margin-top: 5px;
        }
      `}</style>
    </div>
  );
}
