"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * PricingCheckout
 * ──────────────────────────────────────────────────────────────
 * Client-side CTA that posts to /api/billing/checkout/create and then
 * redirects the browser to the Cardcom hosted checkout URL the server
 * returns.
 *
 * Auth state:
 *   - If the server returns 401 UNAUTHORIZED, we route the user to
 *     /auth/signup with a `next` parameter pointing back to /pricing.
 *     After signup they land back here and the next click will
 *     succeed (auth cookie now present). This is what Itzik calls
 *     the "free signup → confirm country (server-trusted) → pay"
 *     flow.
 *
 * Country / tax:
 *   - The server derives ISO-2 country from the request IP via Vercel
 *     edge headers (see /api/billing/checkout/create). The user does
 *     NOT pick country here; the server is the source of truth.
 *   - If geo is unknown in production, server returns GEO_UNKNOWN and
 *     we surface a "contact support" message.
 */
export function PricingCheckout({
  isHe,
  product,
  plan,
  ctaLabel,
  tax_note_he,
  tax_note_en,
}: {
  isHe: boolean;
  product: "journey" | "games" | "adults";
  plan: "weekly" | "monthly" | "annual";
  ctaLabel: string;
  tax_note_he: string;
  tax_note_en: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product,
          plan,
          purchase_type: "subscription",
          return_path: "/my",
        }),
      });

      // Not signed in → push to signup, come back to /pricing.
      if (res.status === 401) {
        const next = encodeURIComponent("/pricing");
        router.push(`/auth/signup?next=${next}`);
        return;
      }

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        // Surface the error code to the user in their language.
        const code = data?.code as string | undefined;
        if (code === "GEO_UNKNOWN") {
          setError(
            isHe
              ? "לא הצלחנו לזהות את המדינה שלכם. כתבו אלינו לתמיכה ונשלים ידנית."
              : "We couldn't determine your country. Please contact support and we'll complete the order manually.",
          );
        } else {
          setError(
            isHe
              ? "משהו לא הסתדר. נסו שוב בעוד רגע."
              : "Something went wrong. Please try again in a moment.",
          );
        }
        setLoading(false);
        return;
      }

      // Server returns the Cardcom hosted-checkout URL — full redirect.
      // Using window.location (not router.push) because Cardcom is
      // off-domain. The API returns the field as `redirect_url`.
      const url = data?.redirect_url as string | undefined;
      if (!url) {
        setError(
          isHe
            ? "לא קיבלנו כתובת תשלום מהשרת. נסו שוב."
            : "We didn't receive a payment URL from the server. Please try again.",
        );
        setLoading(false);
        return;
      }
      window.location.assign(url);
    } catch (err) {
      console.error("[PricingCheckout] checkout failed", err);
      setError(
        isHe
          ? "התרחשה שגיאת רשת. נסו שוב."
          : "Network error. Please try again.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        className="group inline-flex w-full min-h-[60px] items-center justify-center gap-3 rounded-full bg-[#170E14] px-8 text-[18px] font-semibold text-white shadow-[0_18px_40px_-12px_rgba(184,60,77,0.45)] transition hover:bg-[#B83C4D] hover:shadow-[0_22px_50px_-12px_rgba(184,60,77,0.6)] disabled:opacity-60 disabled:cursor-wait"
      >
        {loading ? (
          <>
            <span
              aria-hidden
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
            />
            {isHe ? "מעבירים אתכם לתשלום…" : "Taking you to checkout…"}
          </>
        ) : (
          <>
            {ctaLabel}
            <span
              aria-hidden
              className={`inline-block transition-transform group-hover:translate-x-[-3px] ${
                isHe ? "" : "rotate-180"
              }`}
            >
              ←
            </span>
          </>
        )}
      </button>

      {/* Tax/security note. text-[14px] is the secondary-text floor. */}
      <p className="mt-4 text-center text-[14px] text-[#7A6A75]">
        {isHe ? tax_note_he : tax_note_en}
      </p>

      {/* Inline error — only renders when set. role=alert announces it. */}
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-[15px] leading-[1.5] text-rose-900"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
