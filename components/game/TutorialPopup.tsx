"use client";

/**
 * TutorialPopup — first-time tutorial overlay for the wheel games.
 * ──────────────────────────────────────────────────────────────────
 * Shows once per device on the first visit to a wheel game, then
 * never again. Persistence is handled in localStorage under the
 * key `mioshy:tod-tutorial-seen`.
 *
 * Three-line message: spin → reveal → choose. No fluff. Tapping
 * anywhere outside the card or on the dismiss button closes it
 * forever for that browser.
 *
 * Created 2026-05-07 (Itzik #52).
 */

import { useEffect, useState } from "react";
import { Sparkles, MousePointerClick, Eye, Heart, X } from "lucide-react";

const STORAGE_KEY = "mioshy:tod-tutorial-seen";

export function TutorialPopup({ isHe }: { isHe: boolean }) {
  // Default to NOT showing — flip to true only after we've verified the
  // user hasn't seen it yet. Doing it the other way around would flash
  // the modal for users who've already dismissed it on every page load.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      // localStorage may be blocked (private mode, embedded webview).
      // Fall back to "show once per session" by simply opening — the
      // dismiss handler is a no-op in that case, and the modal will
      // close normally for the duration of the session.
      setOpen(true);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore — see comment above */
    }
    setOpen(false);
  };

  if (!open) return null;

  const t = isHe
    ? {
        badge: "ברוכים הבאים",
        title: "ככה זה עובד",
        step1: "סובבו את הגלגל",
        step2: "קבלו שאלה - אמת או חובה",
        step3: "ענו או בצעו, ועברו לסיבוב הבא",
        cta: "מעולה, יוצאים לדרך",
        dismiss: "סגירה",
      }
    : {
        badge: "Welcome",
        title: "Here's how it works",
        step1: "Spin the wheel",
        step2: "Reveal a Truth or Dare",
        step3: "Answer or do it — then spin again",
        cta: "Got it, let's start",
        dismiss: "Close",
      };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      className="fixed inset-0 z-[60] flex items-center justify-center px-5"
      onClick={dismiss}
    >
      {/* Backdrop — solid wash so the wheel behind doesn't distract */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(8,4,12,0.78)" }}
      />

      <div
        className="relative w-full max-w-[420px] rounded-3xl border p-6 sm:p-7"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          background:
            "linear-gradient(160deg, #1a0f15 0%, #0E0810 60%, #0E0810 100%)",
          boxShadow:
            "0 30px 80px -20px rgba(184,60,77,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow halo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -start-12 -top-12 h-40 w-40 rounded-full opacity-30 blur-3xl"
          style={{ background: "#B83C4D" }}
        />

        <button
          type="button"
          onClick={dismiss}
          aria-label={t.dismiss}
          className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/20 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FAF6F7]"
            style={{ background: "rgba(184,60,77,0.25)" }}
          >
            <Sparkles className="h-3 w-3" />
            {t.badge}
          </span>

          <h2 className="mt-3 font-heading text-[26px] font-extrabold leading-tight text-white sm:text-[28px]">
            {t.title}
          </h2>

          <ol className="mt-5 flex flex-col gap-3.5">
            <Step
              n={1}
              icon={<MousePointerClick className="h-4 w-4" />}
              text={t.step1}
            />
            <Step n={2} icon={<Eye className="h-4 w-4" />} text={t.step2} />
            <Step n={3} icon={<Heart className="h-4 w-4" />} text={t.step3} />
          </ol>

          <button
            type="button"
            onClick={dismiss}
            className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-6 text-[16px] font-bold text-white transition hover:brightness-110"
            style={{
              background:
                "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
              boxShadow: "0 16px 36px -12px rgba(184,60,77,0.55)",
            }}
          >
            {t.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  icon,
  text,
}: {
  n: number;
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#FAF6F7]"
        style={{
          background: "rgba(184,60,77,0.22)",
          boxShadow: "inset 0 0 0 1px rgba(184,60,77,0.35)",
        }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="flex items-baseline gap-2 text-[16px] leading-snug text-white/90">
        <span
          className="text-[12px] font-bold tracking-wider text-white/45"
          aria-hidden
        >
          {String(n).padStart(2, "0")}
        </span>
        {text}
      </span>
    </li>
  );
}
