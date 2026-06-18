"use client";

/**
 * GlobalAssessmentOffer — hosts two of the three quick-assessment touch points
 * (Itzik 2026-06-18): "right after login" (first authenticated load of the
 * session) and "return after 24h". The in-game (round 6) touch point lives in
 * TruthOrDareClient. Mounted once in the root layout.
 *
 * Suppression (no spam): never if the assessment is done or journey is already
 * owned; at most once per session (shared flag with the in-game offer); a
 * dismissal sticks for the session and the offer returns only at the next
 * trigger in a future session.
 */

import { useEffect, useState } from "react";
import { useRouter } from "@/navigation";
import { AssessmentOfferCard } from "@/components/marketing/AssessmentOfferCard";
import {
  fetchEligibility,
  fetchOfferTexts,
  isReturnAfter24h,
  markOfferShown,
  shouldSuppress,
  touchLastVisit,
  wasOfferShownThisSession,
  type OfferTexts,
  type OfferTrigger,
} from "@/lib/marketing/assessment-offer";

// Surfaces where the offer must never pop (it's noise there): the assessment
// itself, auth, and the admin dashboard.
const BLOCKED = ["/journey/assessment", "/auth", "/dashboard", "/admin"];

export function GlobalAssessmentOffer({ locale }: { locale: "he" | "en" }) {
  const router = useRouter();
  const [trigger, setTrigger] = useState<OfferTrigger | null>(null);
  const [texts, setTexts] = useState<OfferTexts | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Record the return-24h signal BEFORE stamping this visit.
    const returning = isReturnAfter24h();
    touchLastVisit();

    if (wasOfferShownThisSession()) return;
    const path = window.location.pathname;
    if (BLOCKED.some((p) => path.includes(p))) return;

    void (async () => {
      const elig = await fetchEligibility();
      if (cancelled || shouldSuppress(elig)) return;

      // First authenticated load of the session → "login"; else an anonymous
      // returner after 24h → "return24h"; otherwise no global offer (fresh
      // anonymous visitors are covered by the in-game touch point).
      const which: OfferTrigger | null = elig.loggedIn ? "login" : returning ? "return24h" : null;
      if (!which) return;

      const t = await fetchOfferTexts(locale, which);
      if (cancelled) return;
      markOfferShown();
      setTexts(t);
      setTrigger(which);
    })();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (!trigger || !texts) return null;

  return (
    <AssessmentOfferCard
      title={texts.title}
      body={texts.body}
      cta={texts.cta}
      dismiss={texts.dismiss}
      locale={locale}
      onAccept={() => {
        setTrigger(null);
        router.push("/journey/assessment");
      }}
      onDismiss={() => setTrigger(null)}
    />
  );
}
