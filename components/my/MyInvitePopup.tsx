"use client";

/**
 * components/my/MyInvitePopup.tsx
 *
 * Once-per-session entry popup on /my, split by the user's pairing role:
 *
 *   · mode="owner"    — a purchaser who still needs a partner. Wraps the
 *                       existing <PartnerShareCard> (copy / WhatsApp / SMS /
 *                       QR) inside a modal so the invite/share surfaces the
 *                       moment they land, without redesigning the card.
 *   · mode="redeemer" — a registered non-purchaser (no couple yet). Reuses
 *                       the exact <RedeemDialog> code-entry modal.
 *
 * Dismissal contract (per role):
 *   · Appears ONCE per device until dismissed — never on every load.
 *   · Persisted in localStorage under a distinct key per role:
 *       owner    → "mioshy:invite-popup-dismissed"
 *       redeemer → "mioshy:redeem-popup-dismissed"
 *   · Closing via X (or completing the action) sets the key. Completion is
 *     additionally enforced server-side: once paired / in a couple the
 *     caller stops mounting this component at all, so it never reappears.
 *
 * Server-component caller (/my) mounts this; the localStorage + open-state
 * logic has to live in a client component, hence this wrapper.
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLocale } from "next-intl";
import { PartnerShareCard } from "@/components/between-us/PartnerShareCard";
import { RedeemDialog } from "@/components/between-us/RedeemCodeButton";

const DISMISS_KEYS = {
  owner: "mioshy:invite-popup-dismissed",
  redeemer: "mioshy:redeem-popup-dismissed",
} as const;

export function MyInvitePopup({
  mode,
  pairCode,
  redirectTo,
}: {
  mode: "owner" | "redeemer";
  /** Required for mode="owner": the couple's pair_code to share. */
  pairCode?: string | null;
  /** Where mode="redeemer" sends the user after a successful join. */
  redirectTo?: string;
}) {
  const locale = useLocale() as "he" | "en";
  const isHe = locale === "he";
  const storageKey = DISMISS_KEYS[mode];

  // Default closed; flip open only after confirming this device hasn't
  // dismissed it yet, so dismissed users never see a flash on load.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const dismissed = window.localStorage.getItem(storageKey);
      if (!dismissed) setOpen(true);
    } catch {
      // localStorage blocked (private mode / webview) → show once for the
      // session; dismiss becomes a no-op but still closes for now.
      setOpen(true);
    }
  }, [storageKey]);

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore — see note above */
    }
    setOpen(false);
  }

  if (!open) return null;

  // ─── Non-purchaser: reuse the exact code-entry modal (has its own X) ──
  if (mode === "redeemer") {
    const dest = redirectTo ?? "/my";
    return (
      <RedeemDialog
        isHe={isHe}
        onClose={dismiss}
        redirectTo={dest}
        authNext={dest}
      />
    );
  }

  // ─── Owner: wrap PartnerShareCard in a modal (X to close) ─────────────
  if (!pairCode) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      dir={isHe ? "rtl" : "ltr"}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-br from-violet-900 via-fuchsia-900 to-rose-900 p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={isHe ? "סגירה" : "Close"}
          className="absolute end-3 top-3 rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-2xl font-bold">
          {isHe
            ? "שתפו את הקוד עם בן/בת הזוג"
            : "Share your code with your partner"}
        </h3>

        <PartnerShareCard pairCode={pairCode} />
      </div>
    </div>
  );
}
