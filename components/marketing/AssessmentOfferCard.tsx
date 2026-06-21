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

  // Perf (2026-06-21): while this full-screen blurred modal is open we touch the
  // <body> two ways, both fully reverted on unmount. The card only mounts while
  // the offer is open, so mount/unmount == open/close.
  //
  //  1. `offer-modal-open` class — pauses the homepage hero's perpetual ambient
  //     animations underneath the `backdrop-blur-md` (line 65). They otherwise
  //     re-rasterise at 60fps over a moving background, pinning the main thread
  //     and spiking homepage INP the whole time the offer is shown. The
  //     blobs/badges sit fully behind the dimmed backdrop, so freezing them is
  //     invisible; styles.css `body.offer-modal-open` does the pausing. Harmless
  //     on pages without a hero — the selector simply matches nothing.
  //
  //  2. Scroll-lock the background. `overflow:hidden` alone doesn't hold on iOS
  //     Safari, so we pin <body> with `position:fixed` at its current scroll
  //     offset (restored on close), which stops the background moving on desktop
  //     AND mobile. The modal itself is `position:fixed` to the viewport and
  //     <body> has no transform, so it isn't trapped by the pinned body.
  //
  //     Removing the body's scrollbar must not shift the page sideways. Instead
  //     of physical right-padding (wrong side in RTL — and Hebrew is the primary
  //     locale here), we reserve the scrollbar's channel with
  //     `scrollbar-gutter: stable` on <html>: the browser keeps it on whichever
  //     side the scrollbar actually sat (right in WebKit, left in Firefox-RTL),
  //     so the layout doesn't move. Gated on a real space-occupying scrollbar
  //     existing (gap > 0), so it's a no-op on mobile overlay scrollbars and on
  //     short pages with no scrollbar — neither of which can shift.
  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const scrollY = window.scrollY;
    const scrollbarGap = window.innerWidth - root.clientWidth;

    body.classList.add("offer-modal-open");
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overscrollBehavior: body.style.overscrollBehavior,
      gutter: root.style.getPropertyValue("scrollbar-gutter"),
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overscrollBehavior = "contain";
    if (scrollbarGap > 0) root.style.setProperty("scrollbar-gutter", "stable");

    return () => {
      body.classList.remove("offer-modal-open");
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.overscrollBehavior = prev.overscrollBehavior;
      if (prev.gutter) root.style.setProperty("scrollbar-gutter", prev.gutter);
      else root.style.removeProperty("scrollbar-gutter");
      window.scrollTo(0, scrollY);
    };
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
