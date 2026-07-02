"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PromoExpiryCountdown } from "@/components/journey/PromoExpiryCountdown";

/**
 * Task 21 — holiday-campaign sticky top bar. Rendered globally but only shows
 * in promo_mode=campaign_timer with an active promo (the API gates it — that's
 * the "one active indicator" resolver at the campaign layer). One line, brand
 * colors, ≤~10% mobile height, 48px remembered close (per-campaign, keyed by
 * ends_at so a new campaign re-appears), drops when the campaign ends.
 */
export function CampaignPromoBar({ isHe }: { isHe: boolean }) {
  const [state, setState] = useState<{ show: boolean; endsAt?: string; text?: string | null }>({
    show: false,
  });
  const [dismissed, setDismissed] = useState(true); // assume dismissed until we know

  useEffect(() => {
    let alive = true;
    fetch("/api/promo/campaign")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.show || !d.endsAt) return;
        setState(d);
        const key = `mioshy:campaign_dismissed:${d.endsAt}`;
        setDismissed(
          typeof window !== "undefined" && window.localStorage.getItem(key) === "1",
        );
      })
      .catch(() => { /* no bar */ });
    return () => { alive = false; };
  }, []);

  if (!state.show || !state.endsAt || dismissed) return null;
  if (new Date(state.endsAt).getTime() <= Date.now()) return null;

  const label = state.text?.trim() || (isHe ? "מבצע לזמן מוגבל" : "Limited-time offer");

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative flex items-center justify-center gap-3 bg-[linear-gradient(95deg,#6C5CE7_0%,#D6409F_52%,#F79154_100%)] px-12 py-2 text-center text-sm font-semibold text-white"
    >
      <span>{label}</span>
      <PromoExpiryCountdown
        endsAt={state.endsAt}
        isHe={isHe}
        label={isHe ? "מסתיים בעוד" : "Ends in"}
      />
      <button
        type="button"
        aria-label={isHe ? "סגירה" : "Dismiss"}
        onClick={() => {
          window.localStorage.setItem(`mioshy:campaign_dismissed:${state.endsAt}`, "1");
          setDismissed(true);
        }}
        className="absolute end-1 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center text-white/90 hover:text-white"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
