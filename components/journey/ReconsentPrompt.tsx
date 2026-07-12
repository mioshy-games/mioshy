"use client";

/**
 * ReconsentPrompt — results-summary re-consent popup.
 *
 * Appears once, immediately, on the results page (mounted inside JourneyClient's
 * results branch) for signed-in users who did NOT tick the marketing-consent box
 * at signup. Design per docs/reconsent-popup-mockup-approved.html (mobile-first
 * bottom sheet, gradient CTA). Copy comes from CMS keys via useCmsText
 * (journeyAssessment.reconsent.*), matching migration 143's pattern.
 *
 * Eligibility + writes are server-side (app/actions/reconsent). This component
 * only renders the UI and calls those actions; it never decides consent itself.
 */

import { useEffect, useState } from "react";
import { useCmsText } from "@/hooks/useCmsText";
import {
  checkReconsentEligibility,
  submitReconsent,
} from "@/app/actions/reconsent";

export function ReconsentPrompt() {
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const title = useCmsText("journeyAssessment.reconsent.title").text;
  const bodyA = useCmsText("journeyAssessment.reconsent.bodyA").text;
  const bodyB = useCmsText("journeyAssessment.reconsent.bodyB").text;
  const consent = useCmsText("journeyAssessment.reconsent.consent").text;
  const cta = useCmsText("journeyAssessment.reconsent.cta").text;
  const later = useCmsText("journeyAssessment.reconsent.later").text;

  useEffect(() => {
    let alive = true;
    checkReconsentEligibility()
      .then((r) => {
        if (alive && r.eligible) setShow(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!show) return null;

  const answer = async (accept: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    // Optimistically close — the write + Brevo sync happen server-side and must
    // not block dismissal. Never re-shows (server stamps reconsent_prompt_shown_at).
    setShow(false);
    try {
      await submitReconsent(accept);
    } catch {
      /* swallow — the popup is dismissed regardless; nothing to recover here */
    }
  };

  return (
    <div className="reconsent-root" role="dialog" aria-modal="true" aria-labelledby="reconsent-title">
      <div className="reconsent-scrim" />
      <div className="reconsent-modal">
        <div className="reconsent-emblem" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 6.5h16v11H4z" />
            <path d="M4 7l8 6 8-6" />
          </svg>
        </div>
        <h2 id="reconsent-title" className="reconsent-title" dir="auto">
          {title}
        </h2>
        <p className="reconsent-body" dir="auto">{bodyA}</p>
        <p className="reconsent-body reconsent-body-two" dir="auto">{bodyB}</p>
        <p className="reconsent-consent" dir="auto">{consent}</p>
        <button
          type="button"
          className="reconsent-cta"
          onClick={() => answer(true)}
          disabled={submitting}
        >
          {cta}
        </button>
        <button
          type="button"
          className="reconsent-later"
          onClick={() => answer(false)}
          disabled={submitting}
        >
          {later}
        </button>
      </div>

      <style jsx>{`
        .reconsent-root {
          position: fixed;
          inset: 0;
          z-index: 120;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .reconsent-scrim {
          position: absolute;
          inset: 0;
          background: rgba(30, 20, 16, 0.55);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
        }
        .reconsent-modal {
          position: relative;
          width: 100%;
          max-width: 440px;
          margin: 0 12px 14px;
          background: #fff;
          border: 1px solid #ece2d4;
          border-radius: 26px;
          padding: 26px 22px 20px;
          text-align: center;
          box-shadow: 0 -10px 50px -18px rgba(40, 25, 18, 0.5);
          animation: reconsent-rise 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        @media (min-width: 640px) {
          .reconsent-root {
            align-items: center;
          }
          .reconsent-modal {
            margin-bottom: 0;
            box-shadow: 0 30px 70px -30px rgba(40, 25, 18, 0.55);
          }
        }
        @keyframes reconsent-rise {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        .reconsent-emblem {
          width: 58px;
          height: 58px;
          margin: 0 auto 15px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: linear-gradient(
            135deg,
            rgba(108, 92, 231, 0.14),
            rgba(247, 145, 84, 0.14)
          );
        }
        .reconsent-emblem svg {
          width: 27px;
          height: 27px;
          fill: none;
          stroke: #6c5ce7;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .reconsent-title {
          font-family: "Frank Ruhl Libre", Georgia, serif;
          font-weight: 800;
          font-size: 26px;
          line-height: 1.24;
          color: #2e2622;
          margin-bottom: 14px;
        }
        .reconsent-body {
          font-size: 20px;
          line-height: 1.6;
          color: #463d37;
          margin-bottom: 12px;
        }
        .reconsent-body-two {
          color: #5a5049;
        }
        .reconsent-consent {
          font-size: 14px;
          line-height: 1.45;
          color: #8a7a6b;
          max-width: 330px;
          margin: 16px auto 12px;
        }
        .reconsent-cta {
          display: block;
          width: 100%;
          height: 54px;
          border: 0;
          cursor: pointer;
          border-radius: 15px;
          background: linear-gradient(95deg, #6c5ce7 0%, #d6409f 52%, #f79154 100%);
          color: #fff;
          font-weight: 800;
          font-size: 18px;
          box-shadow: 0 14px 30px -12px rgba(150, 60, 150, 0.5);
        }
        .reconsent-cta:disabled,
        .reconsent-later:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .reconsent-later {
          margin-top: 14px;
          background: none;
          border: 0;
          color: #7b6b5e;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      `}</style>
    </div>
  );
}
