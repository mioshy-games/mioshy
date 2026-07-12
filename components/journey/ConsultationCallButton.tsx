"use client";

/**
 * ConsultationCallButton (Stage 2) — the "schedule a call with a rep" CTA on the
 * results page. Opens the Calendly popup widget; on `calendly.event_scheduled`
 * it fires the Meta Schedule Pixel event and records a lead + CAPI (server),
 * sharing one eventId so Meta deduplicates the two layers.
 */

import { useEffect, useRef } from "react";
import { metaTrack } from "@/lib/analytics/meta-pixel";
import { recordConsultationScheduled } from "@/app/actions/consultation";

const CALENDLY_URL = "https://calendly.com/mioshy-support/30min";
const WIDGET_JS = "https://assets.calendly.com/assets/external/widget.js";
const WIDGET_CSS = "https://assets.calendly.com/assets/external/widget.css";

type CalendlyGlobal = { initPopupWidget?: (opts: { url: string }) => void };

export function ConsultationCallButton({
  label,
  source = "assessment_results",
}: {
  label: string;
  source?: string;
}) {
  // One tracking fire per mount (a user rarely books twice on one visit).
  const firedRef = useRef(false);

  useEffect(() => {
    // Load Calendly assets once.
    if (!document.querySelector(`link[data-calendly="1"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = WIDGET_CSS;
      link.dataset.calendly = "1";
      document.head.appendChild(link);
    }
    if (!document.querySelector(`script[data-calendly="1"]`)) {
      const s = document.createElement("script");
      s.src = WIDGET_JS;
      s.async = true;
      s.dataset.calendly = "1";
      document.head.appendChild(s);
    }

    // Only trust messages from Calendly's own origin (instruction boundary).
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== "https://calendly.com") return;
      const data = e.data as { event?: string; payload?: { invitee?: { uri?: string } } };
      if (!data || typeof data !== "object" || data.event !== "calendly.event_scheduled") return;
      if (firedRef.current) return;
      firedRef.current = true;

      const eventId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `sched.${Date.now()}.${Math.round(performance.now())}`;
      const inviteeUri = data.payload?.invitee?.uri ?? null;

      try {
        metaTrack("Schedule", { source, content_name: "consultation_call" }, eventId);
      } catch {
        /* pixel unavailable — no-op */
      }
      recordConsultationScheduled({ source, eventId, calendlyInviteeUri: inviteeUri }).catch(
        () => undefined,
      );
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [source]);

  const open = () => {
    const C = (window as unknown as { Calendly?: CalendlyGlobal }).Calendly;
    if (C?.initPopupWidget) {
      C.initPopupWidget({ url: CALENDLY_URL });
    } else {
      // Widget not ready yet → open Calendly in a new tab as a fallback.
      window.open(CALENDLY_URL, "_blank", "noopener");
    }
  };

  return (
    <button type="button" className="consult-cta" onClick={open}>
      {label}
      <style jsx>{`
        .consult-cta {
          display: inline-block;
          margin-top: 16px;
          background: linear-gradient(95deg, #6c5ce7 0%, #d6409f 52%, #f79154 100%);
          border: 0;
          color: #fff;
          font-family: var(--font-heebo), "Assistant", "Heebo", system-ui, sans-serif;
          font-weight: 800;
          font-size: 17px;
          padding: 12px 24px;
          border-radius: 999px;
          cursor: pointer;
          transition: 0.15s;
          box-shadow: 0 12px 26px -12px rgba(150, 60, 150, 0.5);
        }
        .consult-cta:hover {
          filter: brightness(1.06);
        }
      `}</style>
    </button>
  );
}
