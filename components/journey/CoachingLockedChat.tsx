"use client";

// ============================================================
// Stage-1 coaching add-on — locked chat overlay.
//
// Shown in place of an active chat surface (PerItemThread / general
// expert channel / couple channel) when the journey subscriber does
// NOT have the coaching add-on (`entitlements.journeyCoaching === false`).
//
// The chapter content stays fully readable; only the chat is gated. We
// render a dimmed/blurred faux thread with a lock overlay on top. The
// CTA is intentionally inert in Stage 1 — clicking surfaces a "coming
// soon" line, NOT a purchase / Cardcom flow (upsell is Stage 2).
//
// Copy is inline bilingual (matches ComingSoonCountdown etc.); it can
// move to CMS later without touching the gate.
// ============================================================

import { useState } from "react";
import { Lock, MessageCircle } from "lucide-react";

export function CoachingLockedChat({ isHe }: { isHe: boolean }) {
  const [showSoon, setShowSoon] = useState(false);

  const headline = isHe
    ? "הוסיפו מומחה זוגי למנוי"
    : "Add a couples expert to your plan";
  const sub = isHe
    ? "צ'אט אישי עם מומחה זוגיות שמלווה אתכם לאורך הפרקים — חלק מתוסף הליווי."
    : "A private chat with a couples expert who guides you through the chapters — part of the coaching add-on.";
  const soon = isHe ? "בקרוב" : "Coming soon";

  return (
    <div className="relative">
      {/* Faux thread behind the overlay — dimmed + blurred so the surface
          reads as "a real chat that's locked", not an empty state. */}
      <div
        aria-hidden
        className="pointer-events-none select-none space-y-3 opacity-55 blur-[2px] saturate-75"
      >
        <div
          className="ml-auto w-3/4 rounded-[14px] px-4 py-3 text-[14px]"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--shell-text-2)" }}
        >
          {isHe ? "רצינו לשאול את המומחה על…" : "We wanted to ask the expert about…"}
        </div>
        <div
          className="w-3/4 rounded-[14px] px-4 py-3 text-[14px]"
          style={{ background: "rgba(255,255,255,0.04)", color: "var(--shell-text-3)" }}
        >
          {isHe
            ? "תשובת המומחה הזוגי שלכם תופיע כאן."
            : "Your couples expert's reply will appear here."}
        </div>
        <div
          className="h-[44px] w-full rounded-[12px]"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex max-w-[360px] flex-col items-center gap-2 rounded-[16px] border px-6 py-5 text-center backdrop-blur-sm"
          style={{
            background: "rgba(20,10,40,0.72)",
            borderColor: "var(--shell-line-soft)",
          }}
          dir={isHe ? "rtl" : "ltr"}
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.08)", color: "var(--shell-pink-text)" }}
          >
            <Lock className="h-5 w-5" />
          </span>
          <h3
            className="m-0 text-[15px] font-semibold"
            style={{ color: "var(--shell-text-1)" }}
          >
            {headline}
          </h3>
          <p className="m-0 text-[13px]" style={{ color: "var(--shell-text-3)" }}>
            {sub}
          </p>
          <button
            type="button"
            onClick={() => setShowSoon(true)}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors"
            style={{
              borderColor: "var(--shell-line-soft)",
              color: "var(--shell-text-1)",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {showSoon ? soon : headline}
          </button>
          {showSoon ? (
            <span className="text-[12px]" style={{ color: "var(--shell-text-3)" }}>
              {isHe
                ? "התוסף ייפתח לרכישה בקרוב 🙂"
                : "The add-on opens for purchase soon 🙂"}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
