"use client";

/**
 * JourneyCheckoutButton
 *
 * Single source of truth for "start a Journey subscription" CTAs.
 * Calls /api/billing/checkout/create directly and redirects to the
 * Cardcom Low-Profile page on success. Surfaces errors inline so we
 * never repeat the silent-failure bug from 2026-05-09 where the button
 * appeared to "do nothing" when the user wasn't signed in.
 *
 * Used on:
 *   - /journey (marketing landing — locked / unsubscribed users)
 *   - /[locale]/journey/assessment summary
 *   - any future surface that wants the same offer
 */

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCmsText } from "@/hooks/useCmsText";

interface Props {
  isHe:      boolean;
  /** Override the visible label. Defaults to a strong "join now" CTA. */
  label?:    string;
  /** Tailwind class overrides — base styles already applied. */
  className?: string;
  /** "primary" = white-on-emerald (default). "wine" = wine gradient. */
  variant?:  "primary" | "wine" | "white";
  /** Optional analytics source tag baked into the checkout session row. */
  source?:   string;
  /** Where Cardcom should land the user after a successful charge. */
  returnPath?: string;
}

export function JourneyCheckoutButton({
  isHe,
  label,
  className,
  variant = "primary",
  source = "journey_join_cta",
  returnPath,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // String-prop consumers — label/busy/error live in button children or
  // state, so they resolve through useCmsText().text.
  const defaultLabel = useCmsText("journeyAssessment.checkoutButton.defaultLabel").text;
  const busyLabel = useCmsText("journeyAssessment.checkoutButton.busyLabel").text;
  const errGeneric = useCmsText("journeyAssessment.checkoutButton.errGeneric").text;
  const errNetwork = useCmsText("journeyAssessment.checkoutButton.errNetwork").text;

  const visibleLabel = label ?? defaultLabel;
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan:    "weekly",
          product: "journey",
          source,
          language:    isHe ? "he" : "en",
          is_israeli:  isHe,
          return_path: returnPath ?? null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      // Auth gate — most common silent-failure cause. Push the user to
      // the signup flow with a redirect back to /journey so they
      // continue exactly where they were.
      //
      // F1 fix: window.location.pathname already includes the active
      // locale (e.g. "/he/journey"), and the signup page wraps `next`
      // again with /he/, so the user landed on /he/he/journey/...
      // Strip the leading "/he/" or "/en/" before encoding so signup
      // can re-prepend it cleanly.
      if (res.status === 401 || data?.code === "UNAUTHORIZED") {
        const rawPath =
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : "/journey";
        const localelessPath = rawPath.replace(/^\/(he|en)(?=\/|$)/, "") || "/journey";
        const back = encodeURIComponent(localelessPath);
        router.push(`/${isHe ? "he" : "en"}/auth/signup?next=${back}`);
        return;
      }

      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }

      // Surface anything else so the user knows something is off.
      setError(data?.message || errGeneric);
      setBusy(false);
    } catch {
      setError(errNetwork);
      setBusy(false);
    }
  };

  // Variant → base classes (size/typography preserved across surfaces).
  const base =
    variant === "wine"
      ? "rounded-full text-black px-9 text-[18px] font-semibold"
      : variant === "white"
        ? "rounded-full bg-[#FCCA65] text-black px-9 text-[18px] font-semibold shadow-2xl shadow-[#FCCA65]/30 hover:brightness-110"
        : "rounded-full bg-[#FCCA65] text-black px-9 text-[18px] font-semibold shadow-2xl shadow-[#FCCA65]/30 hover:brightness-110";

  const wineStyle =
    variant === "wine"
      ? {
          background: "linear-gradient(135deg, #FCCA65 0%, #B88F32 100%)",
          boxShadow: "0 18px 40px -12px rgba(252,202,101,0.55)",
        }
      : undefined;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={[
          "group inline-flex min-h-[58px] items-center justify-center gap-3 transition disabled:opacity-60",
          base,
          className ?? "",
        ].join(" ")}
        style={wineStyle}
      >
        {busy ? busyLabel : visibleLabel}
        {!busy ? <Arrow className="h-4 w-4" /> : null}
      </button>
      {error ? (
        <p
          className="text-[13px] text-rose-300"
          dir={isHe ? "rtl" : "ltr"}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
