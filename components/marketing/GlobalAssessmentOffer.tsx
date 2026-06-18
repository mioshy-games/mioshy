"use client";

/**
 * GlobalAssessmentOffer — hosts three of the five quick-assessment touch points
 * (Itzik 2026-06-18): "right after login" (first authenticated load of the
 * session), "return after 24h", and "2 minutes of browsing". The in-game
 * (round 6) and exit-intent touch points live in TruthOrDareClient. Mounted
 * once in the root layout.
 *
 * Global ceiling: ONE offer per session across all five triggers (shared flag).
 * First-eligible-wins; when several are eligible at once the priority is
 * exit-intent > after-login > return-24h > spin-6 > 2-min-browse. Here the
 * immediate pass resolves login > return-24h; the 2-min-browse timer only fires
 * if nothing claimed the ceiling first. Never if assessment done / journey
 * owned; dismissal sticks for the session.
 */

import { useEffect, useState } from "react";
// next/navigation (NOT @/navigation): this component is mounted in the ROOT
// layout, OUTSIDE NextIntlClientProvider, so next-intl's locale-aware useRouter
// (which calls useLocale) would throw "No intl context" and crash every page.
// We have `locale` as a prop, so we prefix the path manually instead.
import { useRouter } from "next/navigation";
import { AssessmentOfferCard } from "@/components/marketing/AssessmentOfferCard";
import {
  fetchEligibility,
  fetchOfferTexts,
  isAdultsPath,
  isReturnAfter24h,
  markOfferShown,
  shouldSuppress,
  touchLastVisit,
  wasOfferShownThisSession,
  type OfferTexts,
  type OfferTrigger,
} from "@/lib/marketing/assessment-offer";

// Surfaces where the offer must never pop (noise): the assessment itself, auth,
// and the admin dashboard. (Adults/sex are excluded for 2-min-browse ONLY, via
// isAdultsPath — login/return may still show there.)
const BLOCKED = ["/journey/assessment", "/auth", "/dashboard", "/admin"];
const BROWSE_DELAY_MS = 2 * 60 * 1000; // 2 minutes

export function GlobalAssessmentOffer({ locale }: { locale: "he" | "en" }) {
  const router = useRouter();
  const [trigger, setTrigger] = useState<OfferTrigger | null>(null);
  const [texts, setTexts] = useState<OfferTexts | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Record the return-24h signal BEFORE stamping this visit.
    const returning = isReturnAfter24h();
    touchLastVisit();

    const onBlocked = (path: string) => BLOCKED.some((p) => path.includes(p));

    const show = async (which: OfferTrigger) => {
      if (cancelled || wasOfferShownThisSession()) return;
      const t = await fetchOfferTexts(locale, which);
      if (cancelled || wasOfferShownThisSession()) return;
      markOfferShown(); // claim the global ceiling
      setTexts(t);
      setTrigger(which);
    };

    void (async () => {
      if (wasOfferShownThisSession()) return;
      const elig = await fetchEligibility();
      if (cancelled || shouldSuppress(elig)) return; // done / owns journey → never

      // Immediate pass (priority login > return-24h). Skipped on blocked paths.
      if (!onBlocked(window.location.pathname)) {
        if (elig.loggedIn) return void (await show("login"));
        if (returning) return void (await show("return24h"));
      }

      // Nothing immediate → arm the 2-min-browse timer (excludes adults/sex at
      // fire time, and any blocked path).
      timer = setTimeout(() => {
        if (cancelled || wasOfferShownThisSession()) return;
        const path = window.location.pathname;
        if (onBlocked(path) || isAdultsPath(path)) return;
        void show("browse2min");
      }, BROWSE_DELAY_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [locale]);

  if (!trigger || !texts) return null;

  return (
    <AssessmentOfferCard
      trigger={trigger}
      title={texts.title}
      body={texts.body}
      cta={texts.cta}
      dismiss={texts.dismiss}
      locale={locale}
      onAccept={() => {
        setTrigger(null);
        router.push(`/${locale}/journey/assessment`);
      }}
      onDismiss={() => setTrigger(null)}
    />
  );
}
