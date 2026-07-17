"use client";

/**
 * AssessmentInvitePopup — post-signup invite to the short couple assessment,
 * shown on the survey success page (/[locale]/my/survey, via PollDashboardLanding).
 *
 * Built on the OfferPopup pattern (dark overlay + white rounded modal, full-bleed
 * hero image, X OUTSIDE the card). This is a layer ABOVE the landing — closing
 * returns the user to the normal page.
 *
 * Behaviour:
 *   • Shown ONCE per user (localStorage flag), same as the other popups.
 *   • Skipped entirely for a user who already has a completed short assessment
 *     (journeys status paywall/complete/completed — resolved server-side and
 *     passed as `hasShortAssessment`): no point inviting someone who did it.
 *   • Category names come from CATEGORY_LABELS (lib/journey/categories.ts, the
 *     single source of truth), in CATEGORY_DISPLAY_ORDER.
 *
 * Copy is the approved final wording (mockup v7). Hebrew primary; English
 * fallbacks so the /en locale never shows Hebrew.
 */

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { CATEGORY_DISPLAY_ORDER, CATEGORY_LABELS } from "@/lib/journey/categories";

const SEEN_KEY = "mioshy_survey_assessment_popup_seen_v1";

export function AssessmentInvitePopup({
  locale,
  hasShortAssessment,
}: {
  locale: string;
  /** Server-resolved: does the user already have a completed short assessment?
   *  true → the popup never shows. */
  hasShortAssessment: boolean;
}) {
  const isHe = locale === "he";
  const [open, setOpen] = useState(false);

  // Show once, on arrival — unless already seen or the user already did the
  // short assessment.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasShortAssessment) return;
    if (window.localStorage.getItem(SEEN_KEY)) return;
    window.localStorage.setItem(SEEN_KEY, "1");
    // Small delay so the landing paints first (smoother entrance).
    const id = window.setTimeout(() => setOpen(true), 450);
    return () => window.clearTimeout(id);
  }, [hasShortAssessment]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);
  const goToAssessment = () => {
    track("click", { target: "survey_assessment_popup_cta", label: "לאבחון עכשיו" });
    if (typeof window !== "undefined") {
      window.location.href = `/${locale}/journey/assessment`;
    }
  };

  const cats = CATEGORY_DISPLAY_ORDER.map((k) =>
    isHe ? CATEGORY_LABELS[k].he : CATEGORY_LABELS[k].en,
  );

  return (
    <>
      {/* One shared gradient def for every checkmark stroke (no bg / no circle). */}
      <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="aipGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6C5CE7" />
            <stop offset="52%" stopColor="#D6409F" />
            <stop offset="100%" stopColor="#F79154" />
          </linearGradient>
        </defs>
      </svg>

      <div
        className="aip-overlay on"
        dir={isHe ? "rtl" : "ltr"}
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      >
        <div className="aip-modal-wrap">
          {/* X OUTSIDE the card (top-start), child of the wrap so overflow:hidden
              on the modal doesn't clip it. */}
          <button className="aip-close" onClick={close} aria-label={isHe ? "סגירה" : "Close"}>✕</button>
          <div className="aip-modal" role="dialog" aria-modal="true" aria-label={isHe ? "הזמנה לאבחון" : "Assessment invite"}>
            <div className="aip-hero">
              <span className="aip-badge">{isHe ? "האבחון הזוגי הקצר" : "The short couple assessment"}</span>
              {/* Full-bleed hero image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/sale.webp" alt="" className="aip-img" />
            </div>
            <div className="aip-body">
              <h2 className="aip-title">
                {isHe ? "רוצים לדעת מה באמת קורה ביניכם?" : "Want to know what's really going on between you?"}
              </h2>
              <p className="aip-lead">
                {isHe
                  ? "גלו איך להכניס פלפל לזוגיות שלכם בתחומים השונים:"
                  : "Discover how to spice up your relationship across the different areas:"}
              </p>
              <ul className="aip-cats">
                {cats.map((name) => (
                  <li key={name} className="aip-cat">
                    <svg className="aip-check" viewBox="0 0 24 24" aria-hidden>
                      <path
                        d="M5 13l4 4L19 7"
                        fill="none"
                        stroke="url(#aipGrad)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>{name}</span>
                  </li>
                ))}
              </ul>
              <button className="aip-cta" onClick={goToAssessment}>
                {isHe ? "לאבחון עכשיו" : "Take the assessment now"}
              </button>
              <button className="aip-later" onClick={close}>
                {isHe ? "אולי מאוחר יותר" : "Maybe later"}
              </button>
            </div>
          </div>{/* /.aip-modal */}
        </div>{/* /.aip-modal-wrap */}
      </div>

      <style jsx>{`
        .aip-overlay {
          position: fixed; inset: 0; background: rgba(20, 8, 16, 0.55);
          -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 18px;
          z-index: 1000; opacity: 0; transition: opacity 0.3s;
          font-family: var(--font-heebo), "Heebo", system-ui, sans-serif;
        }
        .aip-overlay.on { opacity: 1; }
        .aip-modal-wrap { position: relative; width: 100%; max-width: 400px; }
        .aip-modal {
          position: relative; width: 100%; background: #fff;
          border-radius: 26px; overflow: hidden; box-shadow: 0 30px 80px rgba(20, 8, 16, 0.4);
          transform: translateY(24px) scale(0.96);
          transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.25, 1);
        }
        .aip-overlay.on .aip-modal { transform: none; }
        /* X OUTSIDE the card (top-start). On narrow phones keep it inside so it
           can't be clipped off-screen. */
        .aip-close {
          position: absolute; top: -15px; inset-inline-start: -15px; z-index: 5;
          width: 36px; height: 36px; border: 0; border-radius: 50%;
          background: #fff; color: #333; font-size: 18px;
          cursor: pointer; line-height: 1; box-shadow: 0 4px 14px rgba(20, 8, 16, 0.35);
        }
        @media (max-width: 420px) {
          .aip-close { top: 8px; inset-inline-start: 8px; background: rgba(255, 255, 255, 0.9); box-shadow: none; }
        }
        .aip-hero {
          position: relative; height: 160px; background: #faf1f4;
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .aip-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; }
        .aip-badge {
          position: absolute; top: 14px; inset-inline-end: 14px; background: #fff; color: #7a1f3d;
          font-weight: 800; font-size: 12px; padding: 6px 12px; border-radius: 20px; z-index: 2;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .aip-body { padding: 22px 24px 26px; text-align: center; }
        .aip-title {
          font-family: var(--font-heading), var(--font-frank-ruhl), Georgia, serif;
          font-weight: 800; font-size: 25px; line-height: 1.25; margin-bottom: 10px; color: #170e14;
        }
        .aip-lead { font-size: 16px; line-height: 1.55; color: #170e14; margin-bottom: 14px; }
        .aip-cats { list-style: none; margin: 0 0 4px; padding: 0; text-align: start; }
        .aip-cat {
          display: flex; align-items: center; gap: 10px;
          font-size: 16px; font-weight: 600; color: #2a2130; padding: 5px 2px;
        }
        .aip-check { width: 22px; height: 22px; flex: 0 0 22px; }
        .aip-cta {
          display: block; width: 100%; margin-top: 20px; border: 0; border-radius: 16px;
          background: linear-gradient(95deg, #6c5ce7 0%, #d6409f 52%, #f79154 100%); color: #fff;
          font-weight: 800; font-size: 19px; padding: 16px; cursor: pointer;
          box-shadow: 0 10px 24px rgba(214, 64, 159, 0.35);
        }
        .aip-later {
          display: block; margin: 12px auto 0; background: none; border: 0;
          color: #6b6168; font-size: 14px; text-decoration: underline; cursor: pointer;
        }
        @media (prefers-reduced-motion: reduce) {
          .aip-overlay, .aip-modal { transition: none; }
        }
      `}</style>
    </>
  );
}
