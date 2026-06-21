"use client";

/**
 * AssessmentOfferCard — centred modal offering the quick assessment
 * (Itzik 2026-06-18, recentred 2026-06-19). Presentational only: copy +
 * callbacks are supplied by the controllers (in-game / global). Primary CTA →
 * onAccept (navigates to the existing assessment), secondary + X + backdrop →
 * onDismiss.
 *
 * Mobile-first: a single centred card over a dimmed backdrop, comfortably
 * readable (every text element ≥ 20px). Clicking the backdrop dismisses.
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

  // Perf (2026-06-21): while this full-screen blurred modal is open, freeze the
  // homepage hero's perpetual ambient animations underneath it. `backdrop-blur-md`
  // (line 65) re-rasterises every frame the background moves, which pins the main
  // thread and spiked homepage INP (input-delay) the whole time the offer was
  // shown. The blobs/badges sit fully behind the dimmed backdrop, so freezing
  // them is invisible. A <body> flag bridges this modal (mounted in the root
  // layout / in-game tree) and the hero (a separate subtree, which only knows to
  // pause on scroll via its own IntersectionObserver); styles.css pauses the
  // `.hero-*` animations while the flag is set. Cleared on unmount, so the
  // animations resume the moment the offer closes. The card only mounts while the
  // offer is open, so mount/unmount == open/close. See styles.css
  // `body.offer-modal-open`.
  useEffect(() => {
    document.body.classList.add("offer-modal-open");
    return () => document.body.classList.remove("offer-modal-open");
  }, []);

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
      aria-modal="true"
      aria-label={isHe ? "הצעת אבחון" : "Assessment offer"}
      dir={isHe ? "rtl" : "ltr"}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      {/* Dimmed backdrop — click to dismiss. */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={isHe ? "סגירה" : "Close"}
        tabIndex={-1}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-[#1a0a2e]/95 p-6 pe-12 text-white shadow-[0_24px_64px_-12px_rgba(0,0,0,0.75)] backdrop-blur-md">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={isHe ? "סגירה" : "Close"}
          className="absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h3 className="text-2xl font-extrabold leading-snug">{title}</h3>
        <p className="mt-3 text-xl leading-relaxed text-white/85">{body}</p>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 rounded-full bg-gradient-to-r from-amber-400 to-rose-400 px-6 py-3.5 text-xl font-bold text-stone-900 transition hover:brightness-105"
          >
            {cta}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 px-2 py-2 text-xl text-white/60 underline-offset-4 transition hover:text-white/90"
          >
            {dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
