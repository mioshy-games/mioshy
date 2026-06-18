"use client";

/**
 * AssessmentOfferCard — non-blocking bottom banner/card offering the quick
 * assessment (Itzik 2026-06-18). Presentational only: copy + callbacks are
 * supplied by the controllers (in-game / global). Primary CTA → onAccept
 * (navigates to the existing assessment), secondary + X → onDismiss.
 *
 * Mobile-first: full-width bottom card, lifted above the MobileServicesBar
 * (z-40) so neither covers the other; safe-area aware. No backdrop — the page
 * stays fully usable (non-blocking).
 *
 * PostHog measurement lives here (one place for all controllers): fires
 * assessment_offer_shown on mount and _clicked / _dismissed on action, each
 * tagged with the trigger.
 */

import { useEffect } from "react";
import { captureOfferEvent, type OfferTrigger } from "@/lib/marketing/assessment-offer";

interface Props {
  trigger: OfferTrigger;
  title: string;
  body: string;
  cta: string;
  dismiss: string;
  locale: "he" | "en";
  onAccept: () => void;
  onDismiss: () => void;
}

export function AssessmentOfferCard({ trigger, title, body, cta, dismiss, locale, onAccept, onDismiss }: Props) {
  const isHe = locale === "he";

  useEffect(() => {
    captureOfferEvent("shown", trigger, locale);
  }, [trigger, locale]);

  const handleAccept = () => {
    captureOfferEvent("clicked", trigger, locale);
    onAccept();
  };
  const handleDismiss = () => {
    captureOfferEvent("dismissed", trigger, locale);
    onDismiss();
  };

  return (
    <div
      role="dialog"
      aria-label={isHe ? "הצעת אבחון" : "Assessment offer"}
      dir={isHe ? "rtl" : "ltr"}
      className="fixed inset-x-0 z-50 flex justify-center px-3 bottom-[calc(env(safe-area-inset-bottom,0px)+78px)] lg:bottom-[calc(env(safe-area-inset-bottom,0px)+16px)]"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-[#1a0a2e]/95 p-4 pe-9 text-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={isHe ? "סגירה" : "Close"}
          className="absolute end-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h3 className="text-[17px] font-extrabold leading-snug">{title}</h3>
        <p className="mt-1 text-[14px] leading-snug text-white/85">{body}</p>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 rounded-full bg-gradient-to-r from-amber-400 to-rose-400 px-4 py-2.5 text-[14px] font-bold text-stone-900 transition hover:brightness-105"
          >
            {cta}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 px-1 text-[13px] text-white/60 underline-offset-4 transition hover:text-white/90"
          >
            {dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
