"use client";

import { useEffect, useRef, useState } from "react";
import type { Analysis, Locale } from "@/lib/journey/types";
import { CATEGORY_FEEDBACK } from "@/lib/journey/category-feedback";
import {
  CATEGORY_DISPLAY_ORDER,
  CATEGORY_LABELS,
  categoryBand,
  BAND_LABEL,
} from "@/lib/journey/categories";
import { metaTrack } from "@/lib/analytics/meta-pixel";
import { useCmsText } from "@/hooks/useCmsText";
import { useTrialOffer } from "@/hooks/useTrialOffer";
import { OfferPopup } from "@/components/journey/OfferPopup";
import { PromoExpiryCountdown } from "@/components/journey/PromoExpiryCountdown";
import { PersonalOfferTimer } from "@/components/journey/PersonalOfferTimer";
import { ConsultationCallButton } from "@/components/journey/ConsultationCallButton";
import { WeeklyProgramSection } from "@/components/journey/WeeklyProgramSection";
import type { CadenceOption } from "@/lib/billing/pricing-validations";

/**
 * Active journey marketing-promo summary, computed SERVER-SIDE (the promo
 * lookup + discount math are server-only). For each enabled cadence it carries
 * the discounted FIRST-charge price and the full (pre-discount) price, per
 * currency — derived via the same applyDiscount the checkout uses, so the
 * banner shows exactly what Cardcom will charge. null when no journey promo is
 * active. See app/[locale]/journey/assessment/page.tsx and lib/billing/promos.
 *
 * Kept exported — app/[locale]/journey/assessment/page.tsx imports this type.
 */
type PromoCadenceMap = Record<string, { ils: number; usd: number }>;
/** One coaching option's active promo, computed SERVER-SIDE on the matching
 *  bundle. Carries its own ends_at so a with-coaching and a without-coaching
 *  promo (each its own DB row) can run together and drive their own timer. */
type PromoSet = {
  /** ISO promo end time — drives the in-card expiry countdown for this option. */
  endsAt: string | null;
  firstChargeByCadence: PromoCadenceMap;
  originalByCadence: PromoCadenceMap;
};
export type JourneyPromoSummary = {
  /** Promo for the with-coaching option (scope 'with' or 'all'); null if none. */
  withCoaching: PromoSet | null;
  /** Promo for the without-coaching option (scope 'without' or 'all'); null if none. */
  withoutCoaching: PromoSet | null;
};

// "First period only" label per cadence — the promo discounts only the first
// charge; renewals are full price, so we say so honestly (and per-cadence-
// accurate, not a blanket "first month" that would be wrong for yearly).
function firstPeriodLabel(cadence: string, isHe: boolean): string {
  switch (cadence) {
    case "yearly":
      return isHe ? "שנה ראשונה" : "first year";
    case "quarterly":
      return isHe ? "רבעון ראשון" : "first quarter";
    case "weekly":
      return isHe ? "שבוע ראשון" : "first week";
    default:
      return isHe ? "חודש ראשון" : "first month";
  }
}

// (Task 23, 2026-07-02) The fabricated ₪508 anchor (127×period-weeks) was
// removed — strikethrough now shows only a real regular price (the promo path).
const CADENCE_ORDER: Record<string, number> = {
  weekly: 0,
  monthly: 1,
  quarterly: 2,
  yearly: 3,
};

interface AnalysisSummaryProps {
  analysis: Analysis | null;
  locale: Locale;
  /** F3.3 — true when the user holds a journey subscription/entitlement
   *  (active|grace). Hides the pre-purchase selling sections (improvements /
   *  price / value-anchor) and shows the active-subscriber card instead. */
  journeySubscribed?: boolean;
  journeyCadences?: CadenceOption[];
  /** Active journey promo (server-computed) — drives the per-cadence discount
   *  display. null/undefined → regular prices. */
  activePromo?: JourneyPromoSummary | null;
  /** Task 21 — personal 48h offer deadline (personal_window). Drives the
   *  "מחיר ההיכרות שלכם שמור עד …" line near the price. Null = no window. */
  offerExpiresAt?: string | null;
  /** Task 21 — urgency mode. The campaign countdown (PromoExpiryCountdown) shows
   *  ONLY in campaign_timer; personal_window uses the offer-window line instead,
   *  so only one urgency indicator appears. */
  promoMode?: "off" | "personal_window" | "campaign_timer";
  /** Admin-controlled personal-window display (site_settings, migration 184).
   *  'text' → the existing offer-window line; 'clock' → a PromoExpiryCountdown
   *  wired to the user's personal offerExpiresAt. Only meaningful in
   *  personal_window mode. */
  personalWindowDisplay?: "text" | "clock";
  /** Render mode. "full" (default) = the assessment results paywall. "subscribe"
   *  = a lean subscribe page (reused by /journey/subscribe): keeps the hero +
   *  score bars + the pricing/checkout block, and hides the assessment-only
   *  sections (personal feedback, category cards, improvements, value-anchor).
   *  In "subscribe" mode `analysis` may be null (no assessment) — the pricing
   *  block still renders. The pricing/checkout code is identical in both modes,
   *  so displayed==charged is unchanged. */
  mode?: "full" | "subscribe";
  /** Post-signup continuation (money flow): seed the plan picker from the URL so
   *  a selection made before signup is restored, and — when `autoCheckout` and
   *  `authenticated` — continue straight to checkout without a re-select. The
   *  cadence+coaching are re-sent to the same resolver, so charge==selection. */
  initialCadence?: string;
  initialCoaching?: boolean;
  autoCheckout?: boolean;
  /** True when the server rendered this page for a signed-in user. Gates the
   *  auto-checkout so we never bounce an anonymous user into a checkout loop. */
  authenticated?: boolean;
}

/**
 * AnalysisSummary — short-assessment results / pre-purchase paywall
 * (route /journey/assessment, journeys.status='paywall').
 *
 * Redesigned per docs/assessment-results-mockup-v13.html (scoped styled-jsx).
 * Phase 3 restored the full dynamic wiring on the new skin:
 *   • h1 ← analysis.summary.ai_hero (hero_he/en); generic fallback when the AI
 *     call failed (no fabricated deterministic title).
 *   • personal-feedback narrative ← analysis.summary.narrative_he/en.
 *   • 5 bars + 5 cards ← category_scores + CATEGORY_FEEDBACK; lowest = focus
 *     (filled bar + "נתחיל מכאן" badge); score + level-descriptor dynamic.
 *   • money path: 3 packages ← journeyCadences (never hardcoded); promo via the
 *     server-computed activePromo (= applyDiscount, same as checkout). Selecting
 *     a package drives BOTH the displayed price and the checkout `plan`, so the
 *     displayed price == the Cardcom charge. Struck anchor, "first period",
 *     USD, and single-cadence fallback are all preserved.
 *   • journeySubscribed hides the selling sections (same gate as before).
 * The 6 "what will improve" lines and the included list are STATIC design copy
 * (NOT the AI recommendations).
 */

// Category keys, display names, order and the score→band mapping now live in
// the single source of truth: lib/journey/categories.ts.

export function AnalysisSummary({
  analysis,
  locale,
  journeySubscribed = false,
  journeyCadences = [],
  activePromo = null,
  offerExpiresAt = null,
  promoMode = "personal_window",
  personalWindowDisplay = "text",
  mode = "full",
  initialCadence,
  initialCoaching,
  autoCheckout = false,
  authenticated = false,
}: AnalysisSummaryProps) {
  const isHe = locale === "he";
  const isSubscribe = mode === "subscribe";

  // offerWindowLabel (Task 21 + Task 26 #2) is defined further down, after the
  // monthly promo/regular prices are resolved — the bonus copy needs them.

  // ── Cadence picker (hooks must run before the loading early-return) ──
  const enabledCadences = journeyCadences
    .filter((c) => c.enabled)
    .sort((a, b) => CADENCE_ORDER[a.cadence] - CADENCE_ORDER[b.cadence]);
  const defaultCadence =
    (enabledCadences.find((c) => c.is_default) ?? enabledCadences[0])?.cadence ??
    "monthly";
  // Seed from the URL when returning post-signup; validate against enabled
  // cadences so a stale/garbage value falls back to the default.
  const seededCadence =
    initialCadence && enabledCadences.some((c) => c.cadence === initialCadence)
      ? initialCadence
      : defaultCadence;
  const [selectedCadence, setSelectedCadence] = useState<string>(seededCadence);

  // ── Stage-1 coaching add-on ────────────────────────────────────────────
  // The toggle only appears once Itzik sets a coaching cost (>0) on any
  // enabled cadence. Until then coaching defaults to true and the bundle
  // equals content (cost 0) — identical to today, no confusing 0₪ choice.
  const hasCoachingCost = enabledCadences.some(
    (c) => (isHe ? c.coaching_cost_ils : c.coaching_cost_usd) > 0,
  );
  // Coaching is an OPT-IN paid add-on — starts UNCHECKED. Never auto-attach paid
  // coaching without an active choice (Itzik 2026-07-15). The user ticks the box
  // themselves; the checkout then sends coaching:true. Default false → the card
  // shows the base price + the "+{coaching_cost}" offer.
  const [coaching, setCoaching] = useState(initialCoaching ?? false);

  // ── Money path cadence (hoisted above the loading early-return so the trial
  // hook, which must run unconditionally, can key off it). The cadence to
  // charge: the selected one when enabled, else the server default ("weekly").
  const checkoutPlan = enabledCadences.some((c) => c.cadence === selectedCadence)
    ? selectedCadence
    : "weekly";

  // A3: 7-day trial for the CURRENTLY selected option (coaching + cadence). This
  // is the sole surface for journey-WITH-coaching. useTrialOffer re-probes when
  // coaching/plan change, so the CTA + disclosed post-trial price track the
  // toggle. When enabled the CTA swaps to "נסה 7 ימים חינם" and checkout → the
  // create-trial route with the same {plan, coaching}.
  const trial = useTrialOffer({ product: "journey", coaching, isHe, plan: checkoutPlan });

  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Partner-invite share + "schedule a call" modal (Stage 1).
  const [inviteCopied, setInviteCopied] = useState(false);
  // Plans collapsed to monthly by default; the rest expand on demand (Stage 1).
  const [showMorePlans, setShowMorePlans] = useState(false);

  const inviteUrl = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/${locale}/journey/assessment`
      : "";
  const shareInviteWhatsApp = () => {
    const msg = isHe
      ? "בואו נעשה יחד את האבחון הזוגי של מיאושי 💛"
      : "Let's take Mioshy's couples assessment together 💛";
    const url = inviteUrl();
    if (typeof window !== "undefined") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${msg} ${url}`)}`,
        "_blank",
        "noopener",
      );
    }
  };
  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl());
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      /* clipboard blocked — no-op */
    }
  };
  const scrollToPrice = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (typeof document !== "undefined") {
      document.getElementById("ar-price")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // CMS string consumers (resolve to raw strings; fall back to bilingual).
  const checkoutErrGeneric = useCmsText("journeyAssessment.analysis.checkoutErrorGeneric").text;
  const checkoutErrNetwork = useCmsText("journeyAssessment.analysis.checkoutErrorNetwork").text;
  const ctaLoadingLabel = useCmsText("journeyAssessment.analysis.ctaLoading").text;
  const ctaLabelCms = useCmsText("journeyAssessment.analysis.cta").text;
  const priceNoteCms = useCmsText("journeyAssessment.analysis.priceNote").text;
  const activeTitleCms = useCmsText("journeyAssessment.analysis.activeTitle").text;
  const activeSubCms = useCmsText("journeyAssessment.analysis.activeSub").text;
  const promoEndsPrefixCms = useCmsText("journeyAssessment.analysis.promoEndsPrefix").text;

  // ── CMS-editable static copy (seeded by migration 152, section "results").
  // useCmsText returns the key itself when a value is missing in BOTH cms_texts
  // and messages JSON, so `rc` treats a value that still looks like the key as
  // "unset" and renders the bilingual literal fallback. Prices/cadence DATA is
  // never CMS — only labels.
  const RK = "journeyAssessment.results";
  // Results-page improvements (2026-07-12) — new keys so the preview renders the
  // new copy via inline fallback without touching the shared prod cms_texts.
  const cmsEyebrowShort = useCmsText(`${RK}.eyebrowShort`).text;
  const cmsH1Ready = useCmsText(`${RK}.h1Ready`).text;
  const cmsStrip1 = useCmsText(`${RK}.strip1`).text;
  const cmsStrip2 = useCmsText(`${RK}.strip2`).text;
  const cmsFeedbackLabel = useCmsText(`${RK}.feedbackLabel`).text;
  const cmsCategoriesLabel = useCmsText(`${RK}.categoriesLabel`).text;
  const cmsContinueLabel = useCmsText(`${RK}.continueLabel`).text;
  // (heroSub + improvements* keys dropped — those sections were removed.)
  const cmsPriceTitle = useCmsText(`${RK}.priceTitle`).text;
  const cmsIncluded1 = useCmsText(`${RK}.included1`).text;
  // included2 (coaching) is no longer a bullet — it moved to the add-on section
  // below the includes. The hook still runs so the CMS row stays registered.
  void useCmsText(`${RK}.included2`).text;
  const cmsIncluded3 = useCmsText(`${RK}.included3`).text;
  const cmsIncluded4 = useCmsText(`${RK}.included4`).text;
  // included5 ("ייעוץ זוגי עם מיאושי") + fullAssessmentNote removed from the
  // pricing section (mockup v1, Itzik 2026-07-04): coaching is no longer listed
  // twice, and the full-assessment note is covered by the timeline's first line.
  const cmsStopNote = useCmsText(`${RK}.stopNote`).text;
  const cmsAnchorLead = useCmsText(`${RK}.anchorLead`).text;
  const cmsAnchorBold = useCmsText(`${RK}.anchorBold`).text;
  const cmsCadMonthly = useCmsText(`${RK}.cadenceMonthly`).text;
  const cmsCadQuarterly = useCmsText(`${RK}.cadenceQuarterly`).text;
  const cmsCadYearly = useCmsText(`${RK}.cadenceYearly`).text;
  const cmsCadWeekly = useCmsText(`${RK}.cadenceWeekly`).text;
  // Subscribe-page hero copy (mode="subscribe"). CMS-editable via these keys;
  // literal fallback via rc() until/unless seeded (no migration required).
  const cmsSubEyebrow = useCmsText(`${RK}.subEyebrow`).text;
  const cmsSubH1 = useCmsText(`${RK}.subH1`).text;
  const cmsSubFraming = useCmsText(`${RK}.subFraming`).text;
  // Locked-teaser CTA copy (below the second-weakest category card) — CMS-editable
  // like the keys above; literal fallback via rc() until/unless seeded.
  const cmsTeaserMsg = useCmsText(`${RK}.teaserMsg`).text;
  const cmsCatsMoreLink = useCmsText(`${RK}.catsMoreLink`).text;
  const rc = (raw: string, he: string, en: string) =>
    raw && raw.trim().length > 0 && !raw.startsWith(`${RK}.`)
      ? raw
      : isHe ? he : en;

  // Rotating reassurance for the loading state (cycles while analysis is null).
  const loadingLines = isHe
    ? ["בונים את התמונה האישית שלכם", "מתאימים את ההמלצות עבורכם", "עוד רגע…"]
    : ["Building your personal picture", "Tailoring your recommendations", "Almost there…"];
  const [loadingLineIdx, setLoadingLineIdx] = useState(0);
  useEffect(() => {
    if (analysis) return;
    const id = setInterval(
      () => setLoadingLineIdx((i) => (i + 1) % loadingLines.length),
      3000,
    );
    return () => clearInterval(id);
  }, [analysis, loadingLines.length]);

  // ── Post-signup auto-checkout ──────────────────────────────────────────────
  // When we return here after signup with ?pay=1 (the selection restored above),
  // continue straight to checkout — no re-select. `startCheckout` is defined
  // below, so we call it through a ref (assigned each render). Guards:
  //   • only when authenticated (server saw the user) — never bounce anon into a
  //     checkout loop;
  //   • wait for the trial probe so the endpoint (trial vs paid) is correct;
  //   • fire at most once per mount, and cap cross-reload retries (sessionStorage)
  //     so a stuck 401 can't loop — after the cap we just leave the selection.
  const startCheckoutRef = useRef<(() => void) | null>(null);
  const autoPayFiredRef = useRef(false);
  // While the auto-checkout is pending/firing we show a loading screen INSTEAD of
  // the selector, so the transition reads signup → loading → Cardcom (no flash of
  // the price page). Starts true only when we actually intend to auto-fire; flips
  // to false if we give up (cap) or the checkout errors without navigating — then
  // the selector is revealed (never a stuck empty screen). Checkout success/401
  // navigate away, so the loader simply persists until then.
  const [autoPayPending, setAutoPayPending] = useState(autoCheckout && authenticated);
  useEffect(() => {
    if (!autoCheckout || !authenticated || autoPayFiredRef.current) return;
    if (trial.loading) return;
    if (typeof window === "undefined" || !startCheckoutRef.current) return;
    const ATTEMPT_KEY = "ar_autopay_attempts";
    const attempts = Number(window.sessionStorage.getItem(ATTEMPT_KEY) ?? "0");
    // Consume the ?pay flag so a reload can't silently re-trigger checkout.
    const u = new URL(window.location.href);
    if (u.searchParams.has("pay")) {
      u.searchParams.delete("pay");
      window.history.replaceState({}, "", u.pathname + u.search + u.hash);
    }
    if (attempts >= 2) {
      // Give up auto-firing; reveal the selector with the restored selection.
      setAutoPayPending(false);
      return;
    }
    autoPayFiredRef.current = true;
    window.sessionStorage.setItem(ATTEMPT_KEY, String(attempts + 1));
    startCheckoutRef.current();
  }, [autoCheckout, authenticated, trial.loading]);

  if (!analysis && !isSubscribe) {
    return (
      <div className="ar-loading" dir={isHe ? "rtl" : "ltr"}>
        <span className="ar-spinner" aria-hidden />
        <p>{isHe ? "מכינים את התמונה האישית שלכם…" : "Preparing your personal picture…"}</p>
        <p className="ar-loading-sub" aria-live="polite">{loadingLines[loadingLineIdx]}</p>
        <style jsx>{`
          .ar-loading {
            display: flex;
            /* 100vh so the light background fills the screen — at 60vh the dark
               page background showed through below it. */
            min-height: 100vh;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
            padding: 40px 24px;
            background: #fcfaf7;
            color: #2e2622;
            font-family: var(--font-heebo), "Heebo", system-ui, sans-serif;
            font-size: 20px;
            text-align: center;
          }
          .ar-loading-sub {
            font-size: 16px;
            color: #7b6b5e;
          }
          .ar-spinner {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid rgba(122, 31, 43, 0.18);
            border-top-color: #7a1f2b;
            animation: ar-spin 0.8s linear infinite;
          }
          @keyframes ar-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  // ── Dynamic content (AI + categories) ──────────────────────────────────
  // The h1 is now a fixed CMS string (2026-07-12) — the AI ai_hero is no longer
  // used for the title; its narrative still drives the personal-feedback card.
  const narrative = analysis
    ? isHe ? analysis.summary.narrative_he : analysis.summary.narrative_en
    : null;
  const categoryScores = analysis?.summary.category_scores ?? null;
  const insufficientKeys = categoryScores?.insufficient_keys ?? [];

  // ── Money path ──────────────────────────────────────────────────────────
  // checkoutPlan is computed above (hoisted for the trial hook). It's the SAME
  // value the displayed price keys off, so displayed price == Cardcom charge.
  const startCheckout = async () => {
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      // A3: swap to the trial endpoint when a trial is enabled for the selected
      // {coaching, cadence}. Same {plan, coaching} → the day-7 charge matches
      // the displayed price.
      const endpoint = trial.enabled
        ? "/api/billing/checkout/create-trial"
        : "/api/billing/checkout/create";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: checkoutPlan,
          product: "journey",
          // Stage-1: the buyer's coaching choice. Drives BOTH the displayed
          // price and the Cardcom charge (shared resolver), so they match.
          coaching,
          source: "analysis_summary",
          language: locale,
          is_israeli: locale === "he",
          // Land on the hub (/my) so the new subscriber sees PartnerShareCard.
          return_path: `/${locale}/my`,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || data?.code === "UNAUTHORIZED") {
        const basePath =
          typeof window !== "undefined"
            ? window.location.pathname
            : `/journey/assessment`;
        const localeless =
          basePath.replace(/^\/(he|en)(?=\/|$)/, "") || "/journey/assessment";
        // Preserve the selection across signup: return here with the picked
        // cadence + coaching and pay=1 so we auto-continue to checkout (the
        // page reads these and re-sends them to the SAME resolver → charge ==
        // selection). Money-neutral; just skips a second plan pick.
        const qs = new URLSearchParams({
          cadence: checkoutPlan,
          coaching: coaching ? "1" : "0",
          pay: "1",
        });
        const back = encodeURIComponent(`${localeless}?${qs.toString()}`);
        window.location.href = `/${locale}/auth/signup?next=${back}`;
        return;
      }
      if (data?.redirect_url) {
        // Checkout is proceeding — clear the auto-pay retry counter.
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem("ar_autopay_attempts");
        }

        // Meta InitiateCheckout — mid-funnel "buyer-intent" event, fired the
        // moment checkout actually proceeds to Cardcom (the results path fired
        // NOTHING here before). Dual-fire deduped by a fresh per-click uuid:
        //   • Pixel  → metaTrack (DNT-gated by MetaPixelProvider, exactly like
        //              every other InitiateCheckout in the app; fbq beacons
        //              survive the navigation below).
        //   • CAPI   → /api/analytics/initiate-checkout with keepalive:true so
        //              the request outlives window.location.href; email/id are
        //              hashed server-side (no raw PII leaves the browser).
        // Fire-and-forget: guarded by `checkoutBusy` re-entry + the immediate
        // navigation, so it fires once per click. Never blocks the redirect.
        try {
          const icEventId =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `ic-${checkoutPlan}-${data.redirect_url}`;
          const icValue = selectedOption ? amtOf(selectedOption) : 0;
          const icContentName = `${checkoutPlan}${coaching ? "+coaching" : ""}`;
          metaTrack(
            "InitiateCheckout",
            {
              value: icValue,
              currency: "ILS",
              content_name: icContentName,
              content_category: "journey",
              num_items: 1,
            },
            icEventId,
          );
          if (typeof fetch !== "undefined") {
            void fetch("/api/analytics/initiate-checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              keepalive: true,
              body: JSON.stringify({
                eventId: icEventId,
                value: icValue,
                currency: "ILS",
                contentName: icContentName,
                eventSourceUrl:
                  typeof window !== "undefined" ? window.location.href : null,
              }),
            }).catch(() => {});
          }
        } catch {
          // Analytics must never break checkout.
        }

        window.location.href = data.redirect_url;
        return;
      }
      setCheckoutError(data?.message || checkoutErrGeneric);
      setCheckoutBusy(false);
    } catch {
      setCheckoutError(checkoutErrNetwork);
      setCheckoutBusy(false);
    }
  };
  // Expose the latest startCheckout to the post-signup auto-checkout effect
  // (declared above, before the loading early-return).
  startCheckoutRef.current = startCheckout;

  // Post-signup auto-checkout: render a loader INSTEAD of the selector until the
  // checkout redirects to Cardcom — no flash of the price page. Placed after the
  // ref assignment above (so the effect can still fire) and after all hooks. If
  // the checkout errored without navigating (checkoutError set) the condition
  // drops and the selector is revealed with the error, never a stuck loader.
  if (autoPayPending && !checkoutError) {
    return (
      <div className="ar-loading" dir={isHe ? "rtl" : "ltr"}>
        <span className="ar-spinner" aria-hidden />
        <p>{isHe ? "מעבירים אתכם לתשלום…" : "Taking you to checkout…"}</p>
        <style jsx>{`
          .ar-loading {
            display: flex;
            min-height: 100vh;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
            padding: 40px 24px;
            background: #fcfaf7;
            color: #2e2622;
            font-family: var(--font-heebo), "Heebo", system-ui, sans-serif;
            font-size: 20px;
            text-align: center;
          }
          .ar-spinner {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid rgba(122, 31, 43, 0.18);
            border-top-color: #7a1f2b;
            animation: ar-spin 0.8s linear infinite;
          }
          @keyframes ar-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  const sym = isHe ? "₪" : "$";
  const fmt = (n: number) => n.toLocaleString(isHe ? "he-IL" : "en-US");
  // Locale-correct price string. Hebrew puts ₪ AFTER the number with a space
  // ("57 ₪"); English keeps "$" before ("$57"). Prices are dynamic, so compose
  // here consistently instead of concatenating {price}{sym} inline.
  // Non-breaking space binds the amount to ₪ so "189 ₪" never wraps the currency
  // onto its own line (Itzik, 2026-07-02).
  const priceStr = (n: number) => (isHe ? `${fmt(n)} ${sym}` : `${sym}${fmt(n)}`);
  // Bundle = content + (coaching ? coaching_cost : 0). This is the amount the
  // checkout charges for the current toggle, so the display matches Cardcom.
  const coachingCostOf = (c: CadenceOption) =>
    isHe ? c.coaching_cost_ils : c.coaching_cost_usd;
  const amtOf = (c: CadenceOption) =>
    (isHe ? c.price_ils : c.price_usd) + (coaching ? coachingCostOf(c) : 0);
  // Server-computed promo for the CURRENT coaching state (scope-aware). Each
  // scope has its own promo (and ends_at), so with/without can differ.
  const promoSet =
    (activePromo ? (coaching ? activePromo.withCoaching : activePromo.withoutCoaching) : null) ??
    null;
  // CMS-editable prefix for the promo-expiry countdown (falls back to the
  // bilingual literal when the key is unset — useCmsText returns the key).
  const promoEndsLabel =
    promoEndsPrefixCms && !promoEndsPrefixCms.startsWith("journeyAssessment.")
      ? promoEndsPrefixCms
      : isHe
        ? "המבצע מוגבל בזמן"
        : "Limited-time offer";
  // "Was …" anchor for quarterly/yearly: the FULL (regular, non-promo) monthly
  // price × months-in-period, for the SAME coaching option (amtOf already folds
  // the coaching add-on when the with-coaching toggle is on). Edited live from
  // the admin → the anchor recomputes automatically. Only shown when it exceeds
  // the real DB price (no negative/zero savings).
  const monthlyRow = journeyCadences.find((c) => c.cadence === "monthly");
  const monthlyFull = monthlyRow ? amtOf(monthlyRow) : null;

  // Task 21 + Task 26 #2 (Itzik 2026-07-03) — personal-window BONUS line. The
  // trial is the PRIMARY message (timeline above the CTA); this is the secondary
  // one-time bonus: first month at the promo price instead of regular, held
  // until the named deadline (no ticking clock). Prices are the live monthly
  // promo/regular via priceStr (NBSP → no line break). Shows only when the user
  // is inside their window AND an intro discount actually applies to monthly.
  const offerWindowLabel = (() => {
    if (!offerExpiresAt) return null;
    const end = new Date(offerExpiresAt);
    if (end.getTime() <= Date.now()) return null;
    const pf = promoSet?.firstChargeByCadence["monthly"];
    const po = promoSet?.originalByCadence["monthly"];
    if (!pf || !po) return null; // no monthly intro discount → no bonus line
    const promoPrice = priceStr(isHe ? pf.ils : pf.usd);
    const regularPrice = priceStr(isHe ? po.ils : po.usd);
    try {
      const d = end.toLocaleDateString(locale, { weekday: "long" });
      const tm = end.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      // Task 26 #2 v4 (Itzik 2026-07-03) — no technical hyphen structures:
      // "עולה {price}" not "ב-{price}", "בשעה {time}" not "ב-{time}",
      // "ניתנת פעם אחת" not "חד-פעמית".
      return isHe
        ? `ההטבה על סיום האבחון ניתנת פעם אחת: החודש הראשון עולה ${promoPrice} במקום ${regularPrice}, והיא שמורה לכם עד ${d} בשעה ${tm}.`
        : `The assessment-completion bonus is given once: the first month costs ${promoPrice} instead of ${regularPrice}, and it's held for you until ${d} at ${tm}.`;
    } catch {
      return null;
    }
  })();

  const monthsInPeriod = (cadence: string) =>
    cadence === "yearly" ? 12 : cadence === "quarterly" ? 3 : 0;
  // "N months free" in grammatical Hebrew (1 / dual / plural).
  const freeMonthsHe = (n: number) =>
    n === 1 ? "חודש חינם" : n === 2 ? "חודשיים חינם" : `${n} חודשים חינם`;
  const periodLabel = (cadence: string) =>
    cadence === "yearly"
      ? isHe ? "/שנה" : "/yr"
      : cadence === "quarterly"
        ? isHe ? "/רבעון" : "/quarter"
        : cadence === "weekly"
          ? isHe ? "/שבוע" : "/wk"
          : isHe ? "/חודש" : "/mo";
  const cadenceTitle = (cadence: string) =>
    cadence === "monthly"
      ? rc(cmsCadMonthly, "חודשי", "Monthly")
      : cadence === "quarterly"
        ? rc(cmsCadQuarterly, "רבעוני", "Quarterly")
        : cadence === "yearly"
          ? rc(cmsCadYearly, "שנתי", "Yearly")
          : rc(cmsCadWeekly, "שבועי", "Weekly");
  // "סה״כ ל..." word for the bottom total row — לחודש/לרבעון/לשנה (per-period,
  // matching the selected cadence). Distinct from periodLabel's "/חודש" slash form.
  const totalPeriodWord = (cadence: string) =>
    cadence === "yearly"
      ? isHe ? "לשנה" : "per year"
      : cadence === "quarterly"
        ? isHe ? "לרבעון" : "per quarter"
        : cadence === "weekly"
          ? isHe ? "לשבוע" : "per week"
          : isHe ? "לחודש" : "per month";
  const selectedOption =
    enabledCadences.find((c) => c.cadence === selectedCadence) ??
    enabledCadences[0] ??
    null;

  // Included panel for the SELECTED plan — exact structure per the approved
  // pricing card: a gradient "חיסכון X%" line under the name, then a divider,
  // muted lead, and a gradient-dot list. `saveText` is the plan's savings string
  // (null → no savings line). The expert item is gated on the coaching toggle.
  return (
    <div className="ar-root" dir={isHe ? "rtl" : "ltr"}>
      {/* Coaching-offer popup — a layer ABOVE the results screen (spec:
          pull/mioshy-offer-popup-impl.md). Results only (not the subscribe page),
          non-subscribers, and only while a real personal-window offer is live.
          Triggered once when the category area scrolls into view; the countdown
          is the actual offer deadline (offerExpiresAt). */}
      {!isSubscribe && !journeySubscribed && categoryScores && offerExpiresAt ? (
        <OfferPopup
          isHe={isHe}
          lowestCategoryName={
            isHe
              ? CATEGORY_LABELS[categoryScores.lowest_key].he
              : CATEGORY_LABELS[categoryScores.lowest_key].en
          }
          offerExpiresAt={offerExpiresAt}
          onClaim={() => scrollToPrice({ preventDefault: () => {} })}
        />
      ) : null}
      {/* ── HERO ───────────────────────────────────────────────────── */}
      {/* subscribe page: shorter hero, no in-hero logo (the site header/nav
          carries the logo there) and no score graph. Background image stays. */}
      <div className={`ar-hero${isSubscribe ? " ar-hero--sub" : ""}`}>
        {!isSubscribe ? (
          <a className="ar-logo" href={`/${locale}`} aria-label="Mioshy home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mioshy-white.svg" alt="Mioshy" width={116} height={37} />
          </a>
        ) : null}
        <div className="ar-hero-figure" aria-hidden />
        <div className="ar-hero-content">
          <div className="ar-eyebrow">
            {isSubscribe
              ? rc(cmsSubEyebrow, "הייעוץ הזוגי של מיאושי", "Mioshy couples coaching")
              : rc(cmsEyebrowShort, "תוצאות האבחון הקצר", "Short assessment results")}
          </div>
          <h1 className="ar-h1 font-heading">
            {isSubscribe
              ? rc(cmsSubH1, "מתחילים היום לפלפל את הזוגיות!", "Start spicing up your relationship today!")
              : rc(cmsH1Ready, "תוצאות האבחון שלך מוכנות", "Your assessment results are ready")}
          </h1>
          {/* Results page: the "you completed the assessment…" subline was removed
              (Stage 1 design). The subscribe page keeps its own framing line. */}
          {isSubscribe ? (
            <p className="ar-sub">
              {rc(
                cmsSubFraming,
                "הצטרפו ותיהנו ממנוי זוגי מלא הכולל גישה חופשית גם לבני הזוג (ללא תוספת תשלום).",
                "Join and enjoy a full couple subscription with free access for your partner too (at no extra charge).",
              )}
            </p>
          ) : null}
          {/* Score graph moved out of the hero into the light sheet, above the
              "what your answers tell" section (2026-07-12). */}
          {/* Hero link removed (2026-07-02) — duplicated the sticky CTA + the
              offer section and distracted from reading the report. */}
        </div>
      </div>

      {/* ── SHEET ──────────────────────────────────────────────────── */}
      <div className="ar-sheet">
        {/* PERSONAL FEEDBACK + SCORE GRAPH — assessment-only; hidden on subscribe.
            Stage 1 design: the round photo is gone; the 5-domain graph sits at the
            top of the sheet, right under the "your personal feedback" label, then
            the narrative continues below. Order: label → graph → narrative. */}
        {!isSubscribe && categoryScores ? (
          <section className="ar-section">
            <div className="ar-fbcard">
              <div className="ar-sublabel ar-center">
                {rc(cmsFeedbackLabel, "המשוב האישי שלכם", "Your personal feedback")}
              </div>
              <div className="ar-bars on-light">
                {CATEGORY_DISPLAY_ORDER.map((key) => {
                  const value = categoryScores[key];
                  const insufficient = insufficientKeys.includes(key);
                  const hot = !insufficient && key === categoryScores.lowest_key;
                  const heightPct = insufficient ? 8 : Math.max(14, Math.min(100, value));
                  return (
                    <div className={`ar-bar${hot ? " hot" : ""}`} key={key}>
                      <span className="ar-v">{insufficient ? "–" : value}</span>
                      <div
                        className="ar-col"
                        style={
                          hot
                            ? { height: `${heightPct}%`, background: "var(--ar-grad)", border: 0 }
                            : {
                                height: `${heightPct}%`,
                                background:
                                  "linear-gradient(rgba(122,31,43,.05),rgba(122,31,43,.05)) padding-box, var(--ar-grad) border-box",
                              }
                        }
                      />
                      <span className="ar-lbl">{isHe ? CATEGORY_LABELS[key].shortHe : CATEGORY_LABELS[key].shortEn}</span>
                    </div>
                  );
                })}
              </div>
              {narrative ? <p className="ar-fbtext">{narrative}</p> : null}
            </div>
          </section>
        ) : null}

        {/* CATEGORIES — assessment-only cards; hidden on the subscribe page.
            The score graph moved UP into the personal-feedback block (Stage 1). */}
        {!isSubscribe && categoryScores ? (
          <section className="ar-section">
            <div className="ar-sublabel">
              {rc(cmsCategoriesLabel, "מה התשובות שלכם מספרות", "What your answers tell")}
            </div>
            {/* Stage 1: show ONE card — the couple's lowest-scoring domain
                (categoryScores.lowest_key), so the headline weakness matches the
                highlighted ("hot") bar. lowest_key is the min among
                sufficiently-covered categories, with a deterministic tie-break
                (stable sort over the fixed category order — see analysis.ts), so
                the card never flips between refreshes. The rest come with the
                full assessment. No "most important" badge (single card). */}
            <div className="ar-cats">
              {(() => {
                const key = categoryScores.lowest_key;
                const score = categoryScores[key];
                const fb = CATEGORY_FEEDBACK[key];
                const insufficient = insufficientKeys.includes(key);
                const band = categoryBand(score);
                const textHe = band === "weak" ? fb.weak_he : band === "medium" ? fb.medium_he : fb.strong_he;
                const textEn = band === "weak" ? fb.weak_en : band === "medium" ? fb.medium_en : fb.strong_en;
                const text = insufficient
                  ? isHe
                    ? "כדי לתת לכם משוב מדויק בתחום הזה צריך עוד כמה תשובות, וזה מה שהאבחון המלא עושה."
                    : "We need a few more answers to give you accurate feedback here, that's what the full assessment does."
                  : isHe
                    ? textHe
                    : textEn;
                return (
                  <div className="ar-catcard" key={key}>
                    <div className="ar-scorerow">
                      <span className="ar-snum font-heading">{insufficient ? "–" : score}</span>
                      <span className="ar-sof">/ 100</span>
                      <span className="ar-sexp">
                        {insufficient
                          ? isHe ? "דרוש אבחון מלא" : "full assessment needed"
                          : isHe ? BAND_LABEL[band].he : BAND_LABEL[band].en}
                      </span>
                    </div>
                    <div className="ar-cname">{isHe ? CATEGORY_LABELS[key].he : CATEGORY_LABELS[key].en}</div>
                    <p className="ar-ctxt">{text}</p>
                  </div>
                );
              })()}
            </div>
            {/* Teaser (Phase 2, Part C) — a REAL masked peek at the couple's
                SECOND-weakest domain (the top card shows the weakest). Real
                name/score/text from the SSOT + category-feedback, faded downward
                by the .ar-locked mask so it reads as a teaser, not a full free
                reveal. Decorative (aria-hidden); the CTA scrolls to #ar-price. */}
            <div className="ar-teaser">
              <div className="ar-teaser-behind" aria-hidden />
              {(() => {
                const featuredKey = categoryScores.lowest_key;
                const secondKey = CATEGORY_DISPLAY_ORDER
                  .filter((k) => k !== featuredKey && !insufficientKeys.includes(k))
                  .slice()
                  .sort((a, b) => categoryScores[a] - categoryScores[b])[0] ?? null;
                if (!secondKey) {
                  // No second sufficiently-covered category — generic teaser.
                  return (
                    <div className="ar-catcard ar-locked" aria-hidden>
                      <div className="ar-scorerow">
                        <span className="ar-snum font-heading">?</span>
                        <span className="ar-sof">/ 100</span>
                      </div>
                      <div className="ar-cname">
                        {isHe ? "עוד תחומים באבחון המלא" : "More areas in the full assessment"}
                      </div>
                      <p className="ar-ctxt">
                        {isHe
                          ? "האבחון המלא פותח את שאר התחומים עם משוב מלא לכל אחד."
                          : "The full assessment unlocks the rest of the areas with full feedback for each."}
                      </p>
                    </div>
                  );
                }
                const s2 = categoryScores[secondKey];
                const b2 = categoryBand(s2);
                const fb2 = CATEGORY_FEEDBACK[secondKey];
                const t2 = isHe
                  ? b2 === "weak" ? fb2.weak_he : b2 === "medium" ? fb2.medium_he : fb2.strong_he
                  : b2 === "weak" ? fb2.weak_en : b2 === "medium" ? fb2.medium_en : fb2.strong_en;
                return (
                  <div className="ar-catcard ar-locked" aria-hidden>
                    <div className="ar-scorerow">
                      <span className="ar-snum font-heading">{s2}</span>
                      <span className="ar-sof">/ 100</span>
                      <span className="ar-sexp">{isHe ? BAND_LABEL[b2].he : BAND_LABEL[b2].en}</span>
                    </div>
                    <div className="ar-cname">{isHe ? CATEGORY_LABELS[secondKey].he : CATEGORY_LABELS[secondKey].en}</div>
                    <p className="ar-ctxt">{t2}</p>
                  </div>
                );
              })()}
              <div className="ar-teaser-cta">
                <p className="ar-teaser-msg">
                  {rc(
                    cmsTeaserMsg,
                    "רוצים לגלות את הפרטים המלאים - איך לשפר את הזוגיות ולהחזיר לה את התשוקה והכיף?",
                    "Want to discover the full details - how to improve your relationship and bring back the passion and fun?",
                  )}
                </p>
                <a href="#ar-price" className="ar-cats-more-link" onClick={scrollToPrice}>
                  {rc(cmsCatsMoreLink, "להצטרפות לליווי", "Join the coaching")}
                </a>
              </div>
            </div>

            {/* Social-proof strip — under the "long assessment" link (Stage 1).
                Copy approved by Itzik 2026-07-13 (no numbers). */}
            {!journeySubscribed ? (
              <div className="ar-strip">
                <span className="ar-strip-since">{rc(cmsStrip1, "מאז 2021", "Since 2021")}</span>
                <span className="ar-strip-stat">
                  {rc(
                    cmsStrip2,
                    "אנחנו מלווים זוגות בדרך לזוגיות חזקה ומלאת תשוקה.",
                    "We've been guiding couples toward a strong, passionate relationship.",
                  )}
                </span>
              </div>
            ) : null}
            <div className="ar-howcard">
              {/* Partner-invite share (Stage 1) — invite the partner to take the
                  assessment via WhatsApp or a copied link. */}
              <div className="ar-share">
                <div className="ar-share-title">
                  {isHe ? "הזמינו את בן/בת הזוג לאבחון" : "Invite your partner to the assessment"}
                </div>
                <div className="ar-share-btns">
                  <button
                    type="button"
                    className="ar-share-btn wa"
                    onClick={shareInviteWhatsApp}
                    aria-label={isHe ? "שתפו בוואטסאפ" : "Share on WhatsApp"}
                    title={isHe ? "שתפו בוואטסאפ" : "Share on WhatsApp"}
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.3-1.7-1.3-3.2s.8-2.3 1.1-2.6c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6c-.2.2-.3.4-.1.7.5.8 1.1 1.4 1.8 1.9.3.2.6.4 1 .1l.7-.7c.2-.2.4-.2.6-.1l2 1c.3.1.5.2.5.4.1.2.1.9-.1 1.2z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="ar-share-btn copy"
                    onClick={copyInviteLink}
                    aria-label={isHe ? "העתיקו לינק" : "Copy link"}
                    title={isHe ? "העתיקו לינק" : "Copy link"}
                  >
                    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
                      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
                    </svg>
                  </button>
                </div>
                <div className={`ar-share-copied${inviteCopied ? " show" : ""}`} aria-live="polite">
                  {isHe ? "הקישור הועתק!" : "Link copied!"}
                </div>
              </div>

              {/* "מכאן ממשיכים יחד" block moved BELOW the weekly section
                  (2026-07-13) — rendered after <WeeklyProgramSection/>. */}
            </div>

          </section>
        ) : null}

        {/* "מה תקבלו בליווי" section removed (Stage 1 design). */}

        {/* Weekly-program section — reused from the journey hub; CTA scrolls to
            the plans below (Stage 2). */}
        {!isSubscribe ? (
          <div className="ar-weekly">
            {/* Results page: hide the section's own CTA — the plans + their CTA
                sit right below. The marketing hub (/journey) keeps its CTA. */}
            <WeeklyProgramSection ctaHref="#ar-price" hideCta />
          </div>
        ) : null}

        {/* "מכאן ממשיכים יחד" — header + expert paragraph + schedule-a-call CTA;
            moved BELOW the weekly section (2026-07-13). Order on the page:
            share → weekly program → this block → price. */}
        {!isSubscribe ? (
          <div className="ar-howcard">
            <div className="ar-hl">
              {rc(cmsContinueLabel, "מכאן ממשיכים יחד", "From here we continue together")}
            </div>
            <p className="ar-expert">
              {isHe
                ? "מרגע שתצטרפו, מומחה זוגי מהצוות שלנו הופך להיות שלכם. הוא קורא את האבחון שלכם ובונה לכם תוכנית סדורה, עם פרקים שבועיים שמתקדמים יחד אתכם צעד אחר צעד. וכשעולה שאלה או רגע קשה באמצע הערב, הוא שם בשבילכם בצ׳אט."
                : "From the moment you join, a relationship expert from our team becomes yours. They read your assessment and build you a structured plan, with weekly chapters that progress with you step by step. And when a question or a hard moment comes up mid-evening, they're there for you in chat."}
            </p>
            <ConsultationCallButton
              label={isHe ? "לקביעת שיחה עם נציג" : "Schedule a call with a rep"}
              source="assessment_results"
            />
          </div>
        ) : null}

        {/* PRICE (non-subscriber) / ACTIVE-SUBSCRIBER card */}
        {!journeySubscribed ? (
          <section className="ar-section" id="ar-price">
            {/* Personal-window countdown (display='clock') moved DOWN to sit
                beside the selected price/promo (Itzik 2026-07-15) — the urgency
                belongs next to the number it applies to, not at the card top.
                Now rendered inside the selected cadence card, below price+savings. */}
            <div className="ar-pricecard">
              {/* Header lives INSIDE the card, at the top (Itzik 2026-07-15). */}
              <h2 className="ar-sh font-heading">
                {rc(cmsPriceTitle, "איזו חבילה מתאימה לכם?", "Which plan fits you?")}
              </h2>
              {/* Coaching add-on moved INTO the selected cadence card (below the
                  includes, after a divider) to match the approved mockup — see
                  the .ar-addon block inside the cadence map below. */}

              {/* Desktop two-column shell (Itzik 2026-07-15). BOTH wrappers are
                  `display:contents` on mobile — they add NOTHING to the mobile box
                  tree, so the approved mobile layout is byte-for-byte unchanged.
                  Only the min-width:760 media query turns them into the SaaS
                  two-column grid: plans on the right, sticky summary+CTA on the
                  left. No base/mobile rule is touched. */}
              <div className="ar-cols">
              <div className="ar-col-plans">
              {/* Packages ← journeyCadences. Price shown = promo first-charge
                  (server-computed) or the regular price for that cadence. */}
              <div className="ar-opts-wrap">
                {/* Stage 1: only the monthly plan shows by default; the rest sit
                    behind "לצפייה בעוד חבילות" below. The selected plan always
                    shows (so a non-monthly selection is never hidden). */}
                {enabledCadences.map((c) => {
                const selected = c.cadence === selectedCadence;
                const visible = c.cadence === "monthly" || showMorePlans || selected;
                if (!visible) return null;
                const amt = amtOf(c);
                const pf = promoSet?.firstChargeByCadence[c.cadence];
                const po = promoSet?.originalByCadence[c.cadence];
                const hasPromo = !!(promoSet && pf && po);
                // Card ALWAYS shows the BASE (without-coaching) price — coaching
                // is a separate add-on line + a separate total, never merged into
                // the base (Itzik 2026-07-15). Base + its promo come from the
                // without-coaching scope, independent of the checkbox.
                const wSet = activePromo?.withoutCoaching ?? null;
                const baseReg = isHe ? c.price_ils : c.price_usd;
                const wpf = wSet?.firstChargeByCadence[c.cadence];
                const wpo = wSet?.originalByCadence[c.cadence];
                const baseHasPromo = !!(wSet && wpf && wpo);
                const baseFirst = baseHasPromo ? (isHe ? wpf!.ils : wpf!.usd) : baseReg;
                const baseOrig = baseHasPromo ? (isHe ? wpo!.ils : wpo!.usd) : baseReg;
                const basePromoSavePct =
                  baseHasPromo && baseOrig > 0 && baseFirst < baseOrig
                    ? Math.round(((baseOrig - baseFirst) / baseOrig) * 100)
                    : null;
                // Sub-row:
                //  • Monthly (promo): "חודש ראשון, אח״כ {full} ₪" — one line, no %.
                //  • Quarterly/yearly: prominent "חיסכון {X}%" (no struck price,
                //    no {price}/period). X = the LEGITIMATE saving vs paying the
                //    same span monthly (full monthly × N, DB-driven — not an old
                //    fabricated anchor). Guard: only when positive.
                const months = monthsInPeriod(c.cadence);
                let savePct: number | null = null;
                if (!hasPromo && months && monthlyFull != null) {
                  const before = monthlyFull * months;
                  if (before > amt) {
                    savePct = Math.round(((before - amt) / before) * 100);
                  }
                }
                // Yearly "N months free" — computed LIVE (Itzik 2026-07-04):
                // floor((full monthly × 12 − yearly price) / full monthly).
                // Today: (67×12 − 1570)/67 = floor(3.4) = 3 → "3 חודשים חינם".
                const freeMonths =
                  c.cadence === "yearly" && monthlyFull != null && amt > 0
                    ? Math.floor((monthlyFull * 12 - amt) / monthlyFull)
                    : null;
                // "חיסכון X%" line — shown under the name inside the selected
                // card's included block (psave). null → no savings line.
                const saveText =
                  basePromoSavePct != null
                    ? `${isHe ? "חיסכון" : "Save"} ${basePromoSavePct}%${
                        c.cadence === "monthly"
                          ? isHe ? " על החודש הראשון" : " on the first month"
                          : ""
                      }`
                    : savePct != null
                      ? `${isHe ? "חיסכון" : "Save"} ${savePct}%${
                          c.cadence === "yearly" && freeMonths && freeMonths > 0
                            ? isHe ? ` · ${freeMonthsHe(freeMonths)}` : ` · ${freeMonths} months free`
                            : ""
                        }`
                      : null;
                return (
                  <div className={`ar-opt-group${selected ? " sel" : ""}`} key={c.cadence}>
                  {/* Trial strip at the TOP of the selected card — gradient bg,
                      white text; moves with the selection (Stage 1). */}
                  {selected && trial.enabled ? (
                    <div className="ar-trial-strip">
                      <span className="ar-trial-t1">{trial.cardTag}</span>
                      <span className="ar-trial-t2">
                        {isHe ? "גישה מלאה לשני בני הזוג" : "Full access for both partners"}
                      </span>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className={`ar-opt${selected ? " sel" : ""}`}
                    onClick={() => setSelectedCadence(c.cadence)}
                    aria-pressed={selected}
                  >
                    <span className="ar-radio" />
                    {/* Name (+ the promo recurring-price note). The "חיסכון %"
                        line moved into the selected card's included block. */}
                    <span className="ar-opt-info">
                      <span className="ar-opt-name">{cadenceTitle(c.cadence)}</span>
                      {baseHasPromo ? (
                        <span className="ar-opt-note">
                          {`${firstPeriodLabel(c.cadence, isHe)}${isHe ? ", אח״כ " : ", then "}${priceStr(baseOrig)}`}
                        </span>
                      ) : null}
                    </span>
                    {/* Promo-expiry timer in its own centered slot between the
                        name and the price (desktop); wraps to a centered line
                        below on mobile. Only on the promo'd package; reverts the
                        price at 0. The title replaces the old "מבצע" pill. */}
                    {/* Task 21 — the ticking campaign countdown shows ONLY in
                        campaign_timer. In personal_window the offer-window line
                        ("מחיר ההיכרות שלכם שמור עד …") is the single urgency
                        indicator, so the countdown must NOT render here too. */}
                    {promoMode === "campaign_timer" && hasPromo && promoSet?.endsAt ? (
                      <span className="ar-opt-timer">
                        <PromoExpiryCountdown
                          endsAt={promoSet.endsAt}
                          isHe={isHe}
                          label={promoEndsLabel}
                        />
                      </span>
                    ) : null}
                    <span className={`ar-opt-price${selected ? "" : " plain"}`}>
                      <span className="ar-price-num">{fmt(baseFirst)}</span>
                      <span className="ar-price-cur">{sym}</span>
                      <span className="ar-price-per">{periodLabel(c.cadence)}</span>
                    </span>
                  </button>
                  {/* Savings line under the name — shown for EVERY visible card
                      (monthly, quarterly, yearly), not only the selected one, so
                      the revealed plans carry "חיסכון X%" like the approved mock. */}
                  {saveText ? <div className="psave">{saveText}</div> : null}
                  {/* Personal-window countdown — right beside the price/savings it
                      applies to (selected card only). */}
                  {selected &&
                  promoMode === "personal_window" &&
                  personalWindowDisplay === "clock" &&
                  offerExpiresAt &&
                  new Date(offerExpiresAt).getTime() > Date.now() ? (
                    <div className="ar-inline-timer">
                      <PersonalOfferTimer endsAt={offerExpiresAt} isHe={isHe} />
                    </div>
                  ) : null}
                  {/* Included block — only the selected card. INLINE (not a helper)
                      so styled-jsx adds its scope class and .incl/.dot apply. */}
                  {selected ? (
                    <div className="incl">
                      {/* "המנוי כולל..." lead removed (Itzik 2026-07-15) — the
                          "גישה מלאה לשני בני הזוג" line now lives in the trial
                          strip. Divider above also removed. */}
                      <ul>
                        {[
                          // Coaching is no longer listed here — it has its own
                          // add-on section below (checkbox + expert points), per
                          // the approved mockup. cmsIncluded2 intentionally unused.
                          rc(cmsIncluded1, "פרק חדש כל שבוע", "A new chapter every week"),
                          rc(cmsIncluded3, "משחקי זוגות אונליין", "Online couples games"),
                          rc(cmsIncluded4, "הסקס של מיאושי", "Mioshy's sex games"),
                        ].map((it, i) => (
                          <li key={i}>
                            <span aria-hidden className="dot" />
                            {it}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {/* Coaching add-on — INSIDE the selected card, below the
                      includes, after a divider (approved mockup). Toggles the
                      shared `coaching` state; "+X" is this cadence's coaching_cost
                      (dynamic). */}
                  {selected && hasCoachingCost ? (
                    <div className="ar-addon">
                      {/* Gradient separator between the base plan and the coaching
                          add-on (Itzik 2026-07-15) — replaces the framed boxes. */}
                      <div className="ar-grad-div" aria-hidden />
                      <div className="ar-addon-head">
                        <button
                          type="button"
                          className="ar-addbtn"
                          onClick={() => setCoaching(!coaching)}
                          aria-pressed={coaching}
                        >
                          <span className={`ar-box${coaching ? " on" : ""}`} aria-hidden />
                          <span className="ar-addtitle">
                            {isHe ? "הוספת ייעוץ זוגי עם מומחה" : "Add couples coaching with an expert"}
                          </span>
                        </button>
                        <div className="ar-addbig">
                          +{fmt(coachingCostOf(c))} <span className="ar-cur">{sym}</span>{" "}
                          <span className="ar-mo">{periodLabel(c.cadence)}</span>
                        </div>
                      </div>
                      {/* Expert content is ALWAYS visible (Itzik 2026-07-15) — the
                          checkbox above still decides whether coaching is added to
                          the order and price, but people always see what they'd get.
                          Gradient-dot bullets, same as the "מה כלול" list. */}
                      <div className="ar-cexpert">
                        <ul className="ar-points">
                          <li>
                            <span aria-hidden className="dot" />
                            <span>{isHe ? "זמין לכם בצ'אט לכל שאלה" : "Available in chat for any question"}</span>
                          </li>
                          <li>
                            <span aria-hidden className="dot" />
                            <span>{isHe ? "מתאים לכם את התוכן השבועי אישית" : "Personalises your weekly content"}</span>
                          </li>
                          <li>
                            <span aria-hidden className="dot" />
                            <span>{isHe ? "מבצע מעקב שבועי וחודשי" : "Weekly and monthly tracking"}</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  ) : null}
                  </div>
                );
              })}
              </div>

              {/* Reveal quarterly/yearly (Stage 1). */}
              {!showMorePlans && enabledCadences.length > 1 ? (
                <button
                  type="button"
                  className="ar-more-plans"
                  onClick={() => setShowMorePlans(true)}
                >
                  {isHe ? "לצפייה בעוד חבילות" : "See more plans"}
                </button>
              ) : null}
              </div>{/* /.ar-col-plans */}

              <div className="ar-col-sum">
              {/* Desktop-only itemised order summary (Itzik 2026-07-15) — hidden on
                  mobile (base `display:none`), shown only ≥760px. Money-honest:
                  the base line is the FULL recurring base, coaching its own line,
                  then a single "signup discount" line = subtotal − first charge, so
                  the rows always reconcile to the .ar-total below (which stays the
                  single source of the charged total). All values are the same live
                  ones used on mobile (promoSet / coaching / amtOf). */}
              {selectedOption ? (() => {
                const c = selectedOption;
                const cad = c.cadence;
                const baseFull = isHe ? c.price_ils : c.price_usd;
                const coachCost = coachingCostOf(c);
                const subtotal = baseFull + (coaching ? coachCost : 0);
                const pf = promoSet?.firstChargeByCadence[cad];
                const firstTotal =
                  activePromo && pf ? (isHe ? pf.ils : pf.usd) : subtotal;
                const discount = subtotal - firstTotal;
                return (
                  <div className="ar-order-sum">
                    <h3 className="ar-os-title font-heading">
                      {isHe ? "סיכום ההזמנה" : "Order summary"}
                    </h3>
                    <div className="ar-os-line">
                      <span>
                        {isHe
                          ? `מנוי ${cadenceTitle(cad)}`
                          : `${cadenceTitle(cad)} plan`}
                      </span>
                      <span className="ar-os-v">
                        {/* No dir=ltr wrapper: in RTL the ₪ falls to the LEFT of
                            the number, consistent with the big total. */}
                        {priceStr(baseFull)}
                      </span>
                    </div>
                    <div className={`ar-os-line${coaching ? "" : " muted"}`}>
                      <span>{isHe ? "ייעוץ עם מומחה" : "Expert coaching"}</span>
                      <span className="ar-os-v">
                        {coaching ? (
                          priceStr(coachCost)
                        ) : isHe ? (
                          "לא נבחר"
                        ) : (
                          "Not added"
                        )}
                      </span>
                    </div>
                    {discount > 0 ? (
                      <div className="ar-os-line ar-os-disc">
                        <span>{isHe ? "הטבת הרשמה" : "Signup discount"}</span>
                        {/* HE: isolate ONLY the sign+digits ("−30") as an LTR unit
                            so the minus stays glued before the number, while the ₪
                            sits outside and falls to the LEFT in RTL, consistent
                            with the other summary rows. EN is LTR, so keep it whole. */}
                        <span className="ar-os-v">
                          {isHe ? (
                            <>
                              <bdi dir="ltr">{`−${fmt(discount)}`}</bdi>
                              {" "}
                              {sym}
                            </>
                          ) : (
                            <bdi dir="ltr">{`−${priceStr(discount)}`}</bdi>
                          )}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })() : null}

              {/* Selected-cadence headline — the amount Cardcom will charge for
                  the selected plan. Preserves the struck anchor (ILS derived /
                  USD CMS), the promo "first period" nuance, and USD.
                  Task 16: hidden during a trial — the trial timeline above
                  already states the day-7 charge, so an "לתשלום עכשיו"-style
                  line here would contradict "no charge for 7 days". */}
              {!trial.enabled && selectedOption
                ? (() => {
                    const cad = selectedOption.cadence;
                    const pf = promoSet?.firstChargeByCadence[cad];
                    const po = promoSet?.originalByCadence[cad];
                    if (activePromo && pf && po) {
                      const firstAmt = isHe ? pf.ils : pf.usd;
                      const origAmt = isHe ? po.ils : po.usd;
                      return (
                        <div className="ar-summary">
                          {/* Static display_text badge removed (Itzik 2026-07-01)
                              — the ticking promo-expiry clock next to the monthly
                              price now carries the promo signal. */}
                          <p className="ar-summary-line">
                            <span>{isHe ? "לתשלום" : "To pay"}</span>{" "}
                            <span>{firstPeriodLabel(cad, isHe)}</span>{" "}
                            <b>{priceStr(firstAmt)}</b>{" "}
                            <span>{isHe ? "במקום" : "instead of"}</span>{" "}
                            <span className="ar-sr">{isHe ? "היה " : "was "}</span>
                            <s>{priceStr(origAmt)}</s>{" "}
                            <span>{periodLabel(cad)}</span>
                          </p>
                          <p className="ar-summary-note">
                            {isHe
                              ? "מחיר לתשלום הראשון; החידושים מלאים."
                              : "First-payment price; renewals at full price."}
                          </p>
                        </div>
                      );
                    }
                    // Task 23 (2026-07-02): the fabricated ₪508 anchor
                    // (127×weeks) was removed — a strikethrough shows ONLY on a
                    // real regular price, which happens on the promo path above.
                    // No promo → no strikethrough, just the real price.
                    return (
                      <div className="ar-summary">
                        <p className="ar-summary-line">
                          <span>{isHe ? "לתשלום" : "To pay"}</span>{" "}
                          <b>{priceStr(amtOf(selectedOption))}</b>{" "}
                          <span>{periodLabel(cad)}</span>
                        </p>
                        {priceNoteCms && priceNoteCms.trim().length > 0 ? (
                          <p className="ar-summary-note">{priceNoteCms}</p>
                        ) : null}
                      </div>
                    );
                  })()
                : null}

              {/* Zone A end — the personal-window offer. 'clock' is shown by the
                  tile timer at the TOP of the plans (Stage 1), so here we only
                  render the 'text' offer-window line. */}
              {personalWindowDisplay !== "clock" && offerWindowLabel ? (
                <p className="ar-offer-strip">{offerWindowLabel}</p>
              ) : null}

              {/* "מה כלול" moved INTO the selected package card above (2026-07-12,
                  includedPanel) so it follows the selection. The coaching item
                  (included2) is still gated on the coaching toggle there. */}

              {/* Trial-timeline block (היום / 5 ימים / 7 ימים / ביטול) removed
                  2026-07-16 — the .ar-stop line + total below carry the billing
                  detail. The zone separator above it went with it. */}

              {/* Bold TOTAL row (Itzik 2026-07-15) — a separate summary that ties
                  the (unchanged) base price + coaching add-on together. Base and
                  coaching stay shown separately above; this only sums them.
                  Big line = the DISCOUNTED first-period total (promoSet.firstCharge,
                  coaching-aware); sub-line = the regular recurring (amtOf = full
                  base + coaching). No promo → single line, no "after that". Updates
                  live with the selected cadence and the coaching checkbox. */}
              {selectedOption ? (() => {
                const cad = selectedOption.cadence;
                const recurring = amtOf(selectedOption);
                const pf = promoSet?.firstChargeByCadence[cad];
                const firstTotal =
                  activePromo && pf ? (isHe ? pf.ils : pf.usd) : recurring;
                const discounted = firstTotal < recurring;
                return (
                  <div className="ar-total" aria-live="polite">
                    <div className="ar-total-main">
                      <span className="ar-total-label">
                        {isHe
                          ? `סה״כ ${
                              discounted
                                ? firstPeriodLabel(cad, true)
                                : totalPeriodWord(cad)
                            }`
                          : `Total ${
                              discounted
                                ? firstPeriodLabel(cad, false)
                                : totalPeriodWord(cad)
                            }`}
                      </span>
                      <span className="ar-total-amt">{priceStr(firstTotal)}</span>
                    </div>
                    {discounted ? (
                      <div className="ar-total-after">
                        {isHe
                          ? `לאחר מכן ${priceStr(recurring)} ${totalPeriodWord(cad)}`
                          : `then ${priceStr(recurring)} ${totalPeriodWord(cad)}`}
                      </div>
                    ) : null}
                    {/* Urgency at the decision point (Itzik 2026-07-15) — on mobile
                        the top-of-card promo clock has scrolled away by the time the
                        total row is in view, so mirror the SAME active countdown
                        (campaign endsAt / personal offer window) right here. */}
                    {promoMode === "campaign_timer" && discounted && promoSet?.endsAt ? (
                      <div className="ar-total-timer">
                        <PromoExpiryCountdown
                          endsAt={promoSet.endsAt}
                          isHe={isHe}
                          label={promoEndsLabel}
                        />
                      </div>
                    ) : promoMode === "personal_window" &&
                      personalWindowDisplay === "clock" &&
                      offerExpiresAt &&
                      new Date(offerExpiresAt).getTime() > Date.now() ? (
                      <div className="ar-total-timer">
                        <PersonalOfferTimer
                          endsAt={offerExpiresAt}
                          isHe={isHe}
                          label={isHe ? "ההטבה בתוקף עוד:" : "Offer ends in:"}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })() : null}

              <button
                type="button"
                className="ar-cta"
                onClick={startCheckout}
                disabled={checkoutBusy}
              >
                {checkoutBusy
                  ? ctaLoadingLabel && ctaLoadingLabel.trim().length > 0
                    ? ctaLoadingLabel
                    : isHe ? "רגע…" : "One sec…"
                  : trial.enabled
                    ? (isHe ? "מחזירים את התשוקה עכשיו" : "Bring back the passion now")
                    : ctaLabelCms && ctaLabelCms.trim().length > 0
                      ? ctaLabelCms
                      : isHe ? "להצטרפות עכשיו" : "Join now"}
              </button>
              {checkoutError ? (
                <p className="ar-checkout-error" role="alert">
                  {checkoutError}
                </p>
              ) : null}
              <div className="ar-stop">
                {rc(
                  cmsStopNote,
                  "מעבר לתשלום · חיוב בתום 7 ימים · תזכורת לפני החיוב",
                  "Proceed to payment · charged at the end of 7 days · reminder before the charge",
                )}
              </div>
              </div>{/* /.ar-col-sum */}
              </div>{/* /.ar-cols */}
            </div>
          </section>
        ) : (
          <section className="ar-section">
            <div className="ar-active">
              <div className="ar-active-title font-heading">
                {activeTitleCms && activeTitleCms.trim().length > 0
                  ? activeTitleCms
                  : isHe ? "אתם כבר בליווי" : "You're already in the program"}
              </div>
              <p className="ar-active-sub">
                {activeSubCms && activeSubCms.trim().length > 0
                  ? activeSubCms
                  : isHe
                    ? "הליווי שלכם פעיל. אפשר להמשיך מהמסך הראשי."
                    : "Your program is active. Continue from your home screen."}
              </p>
              <a className="ar-active-link" href={`/${locale}/my`}>
                {isHe ? "למסך שלי" : "Go to my screen"}
              </a>
            </div>
          </section>
        )}

        {/* Value anchor — pre-purchase only; hidden on the subscribe page. */}
        {!journeySubscribed && !isSubscribe ? (
          <p className="ar-anchor">
            {rc(
              cmsAnchorLead,
              "פגישת ייעוץ אחת מתחילה ב-500 ₪ ויכולה להגיע לאלפי שקלים.",
              "A single counselling session starts at ₪500 and can reach thousands.",
            )}{" "}
            <b>
              {rc(
                cmsAnchorBold,
                "איתנו תקבלו ליווי צמוד ותוכנית מובנית, עם פרק אחד בשבוע שבו תבצעו משימות ופעילויות שהמומחים שלנו בנו במיוחד עבורכם, ותעצימו את הזוגיות מיום ליום.",
                "With us you get close guidance and a structured plan, one chapter a week of tasks and activities our experts built especially for you, strengthening your relationship day by day.",
              )}
            </b>
          </p>
        ) : null}
      </div>


      <style jsx>{`
        .ar-root {
          --ar-grad: linear-gradient(
            95deg,
            #6c5ce7 0%,
            #d6409f 52%,
            #f79154 100%
          );
          background: #fcfaf7;
          color: #2e2622;
          font-family: var(--font-heebo), "Assistant", "Heebo", system-ui,
            sans-serif;
          font-size: 20px;
          line-height: 1.55;
          -webkit-font-smoothing: antialiased;
          position: relative;
          overflow: hidden;
        }
        .font-heading {
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
        }
        .ar-sr {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
        }
        .ar-eyebrow {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        /* HERO */
        .ar-hero {
          position: relative;
          overflow: hidden;
          color: #fff;
          /* extra top padding (was 30) clears the absolute logo band */
          padding: 58px 24px 34px;
          background-image: linear-gradient(
              180deg,
              rgba(36, 29, 26, 0.3) 0%,
              rgba(36, 29, 26, 0.72) 60%,
              #241d1a 100%
            ),
            url("/images/m-hero-assess.webp");
          background-size: cover;
          background-position: left center;
          background-repeat: no-repeat;
        }
        /* subscribe page: shorter hero (no logo band above, no graph below).
           min-height keeps enough of the background image visible; content is
           vertically centered within it. */
        .ar-hero.ar-hero--sub {
          min-height: 300px;
          padding: 28px 24px 26px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .ar-logo {
          position: absolute;
          top: 18px;
          left: 22px;
          z-index: 2;
          display: inline-flex;
          transition: opacity 0.2s;
        }
        .ar-logo:hover {
          opacity: 0.8;
        }
        .ar-logo :global(img) {
          width: 116px;
          height: auto;
          display: block;
        }
        .ar-hero-figure {
          display: none;
        }
        .ar-hero-content {
          position: relative;
          z-index: 1;
        }
        .ar-hero .ar-eyebrow {
          color: #e7d8c6;
        }
        .ar-h1 {
          font-size: 42px;
          font-weight: 900;
          line-height: 1.12;
          color: #fff;
          margin: 12px 0 8px;
          /* Defensive clamp: even if the AI returns a long hero, the title
             can't take over the hero (the copy should be a short one-liner). */
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ar-sub {
          font-size: 22px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.45;
          /* Subline is the last hero element now the graph moved out — no
             trailing gap (2026-07-12). */
          margin-bottom: 0;
        }
        .ar-bars {
          display: flex;
          gap: 10px;
          align-items: flex-end;
          height: 120px;
        }
        .ar-bar {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          height: 100%;
        }
        .ar-col {
          width: 100%;
          border-radius: 8px 8px 4px 4px;
          border: 2px solid transparent;
        }
        .ar-v {
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 7px;
          color: rgba(255, 255, 255, 0.9);
        }
        .ar-lbl {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          margin-top: 9px;
          text-align: center;
          font-weight: 500;
          line-height: 1.3;
        }
        /* Score graph on the light sheet (2026-07-12): NO card/border — the
           bars sit directly on the cream sheet, centred, with dark
           numbers/labels; columns keep the brand gradient (outline for the
           non-focus bars, filled for the focus bar). */
        .ar-bars.on-light {
          max-width: 420px;
          margin: 4px auto 24px;
        }
        .ar-bars.on-light .ar-v {
          color: #2e2622;
        }
        .ar-bars.on-light .ar-lbl {
          color: #111111;
        }
        /* Social-proof gradient strip (2026-07-12) — white text on brand grad. */
        .ar-strip {
          /* Aligned to the "מכאן ממשיכים יחד" card above (same width, centred)
             and pulled snug beneath it so the two read as one unit (Stage 1). */
          max-width: 620px;
          margin: 18px auto 0;
          background: var(--ar-grad);
          border-radius: 16px;
          padding: 16px 20px;
          text-align: center;
          color: #fff;
          box-shadow: 0 12px 28px -16px rgba(150, 60, 150, 0.5);
        }
        .ar-strip-since {
          display: block;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0.92;
          margin-bottom: 4px;
        }
        .ar-strip-stat {
          display: block;
          /* Mobile base; desktop bumps to 28px in the ≥760 media query. */
          font-size: 20px;
          font-weight: 700;
          line-height: 1.45;
        }
        .ar-herolink {
          display: inline-block;
          margin-top: 24px;
          color: #fff;
          font-weight: 700;
          font-size: 20px;
          text-decoration: underline;
          text-underline-offset: 6px;
          text-decoration-thickness: 2px;
          text-decoration-color: rgba(255, 255, 255, 0.55);
          cursor: pointer;
        }

        /* SHEET */
        .ar-sheet {
          background: #fcfaf7;
          position: relative;
          padding: 34px 24px 30px;
        }
        .ar-section {
          margin-bottom: 40px;
        }
        /* Header lives at the top INSIDE the card, with a comfortable white gap
           above and below (Itzik 2026-07-15). */
        .ar-sh {
          font-size: 25px;
          margin: 8px auto 24px;
          line-height: 1.2;
          text-align: center;
        }
        /* Trial badge above the "which plan" title — gradient text, centred
           (pricing-redesign-approved.html .badge). */
        .ar-trial-above {
          display: block;
          text-align: center;
          margin: 0 auto 10px;
          font-family: var(--font-heebo), "Assistant", "Heebo", system-ui, sans-serif;
          font-size: 18px;
          font-weight: 900;
          background: var(--ar-grad);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .ar-sublabel {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #7a1f2b;
          margin-bottom: 10px;
        }
        .ar-center {
          text-align: center;
        }

        /* FEEDBACK */
        .ar-fbcard {
          text-align: center;
          max-width: 640px;
          margin: 0 auto;
        }
        .ar-fbtext {
          font-size: 20px;
          font-weight: 500;
          line-height: 1.4;
          color: #2e2622;
        }

        /* CATEGORY cards */
        .ar-cats {
          display: flex;
          flex-direction: column;
          gap: 30px;
          margin-top: 18px;
          max-width: 700px;
          margin-inline: auto;
        }
        .ar-catcard {
          background: linear-gradient(155deg, #ffffff 0%, #fbf2e4 100%);
          border-radius: 18px;
          padding: 18px 20px;
          box-shadow: 0 8px 24px -16px rgba(80, 50, 35, 0.3);
          display: flex;
          flex-direction: column;
        }
        .ar-catcard.low {
          background: linear-gradient(155deg, #ffffff 0%, #fbf2e4 100%)
              padding-box,
            var(--ar-grad) border-box;
          border: 2px solid transparent;
        }
        .ar-scorerow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .ar-snum {
          font-size: 36px;
          font-weight: 900;
          line-height: 1;
          background: var(--ar-grad);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .ar-sof,
        .ar-sexp {
          font-size: 15px;
          color: #7b6b5e;
          font-weight: 600;
        }
        .ar-badge {
          margin-inline-start: auto;
          font-size: 12px;
          font-weight: 800;
          color: #fff;
          background: var(--ar-grad);
          padding: 4px 11px;
          border-radius: 99px;
          white-space: nowrap;
        }
        .ar-cname {
          font-weight: 800;
          font-size: 28px;
          margin-bottom: 6px;
          background: var(--ar-grad);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          display: inline-block;
        }
        .ar-ctxt {
          font-size: 22px;
          line-height: 1.4;
          color: #5a4f46;
        }
        /* Under the single category card: message + link to the plans (Stage 1). */
        .ar-cats-more {
          max-width: 620px;
          margin: 16px auto 0;
          text-align: center;
        }
        .ar-cats-more-msg {
          font-size: 17px;
          line-height: 1.5;
          color: #5a4f46;
          font-weight: 500;
          margin-bottom: 10px;
        }
        .ar-cats-more-link {
          display: inline-block;
          font-size: 18px;
          font-weight: 400;
          color: #000000;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
        }

        /* Locked-results teaser (docs/results-teaser-mockup-v3.html). */
        .ar-teaser {
          position: relative;
          max-width: 700px;
          /* extra ~10px gap below the CTA link (Itzik 2026-07-15) */
          margin: 14px auto 10px;
        }
        /* Faint card peeking below the fading locked card — "one more behind". */
        .ar-teaser-behind {
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: -6px;
          height: 46px;
          background: linear-gradient(155deg, #ffffff 0%, #fbf2e4 100%);
          border-radius: 16px;
          box-shadow: 0 8px 24px -16px rgba(80, 50, 35, 0.3);
          opacity: 0.55;
          z-index: -1;
        }
        /* The locked twin of the visible category card: same card styling, faded
           out downward with a gradient mask (intensity per the mockup) so the
           score + name + start of the text show, then dissolve. */
        .ar-locked {
          padding-bottom: 6px;
          box-shadow: 0 8px 24px -20px rgba(80, 50, 35, 0.25);
          -webkit-mask-image: linear-gradient(
            to bottom,
            #000 0,
            #000 26%,
            transparent 72%
          );
          mask-image: linear-gradient(
            to bottom,
            #000 0,
            #000 26%,
            transparent 72%
          );
        }
        /* Locked score is muted (not the live gradient); the "?" score, its
           "/ 100", and the whole 🔒 pill all sit at 50% opacity (Itzik 2026-07-15). */
        .ar-locked .ar-snum {
          background: none;
          -webkit-text-fill-color: #c9bdad;
          color: #c9bdad;
          opacity: 0.5;
        }
        .ar-locked .ar-sof {
          opacity: 0.5;
        }
        .ar-locked .ar-ctxt {
          white-space: nowrap;
          overflow: hidden;
        }
        .ar-lockpill {
          margin-inline-start: auto;
          font-size: 13px;
          font-weight: 800;
          color: #8a7a6b;
          background: #f0eae1;
          border-radius: 99px;
          padding: 4px 11px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          opacity: 0.5;
        }
        /* CTA pulled up into the faded area (mockup pattern). */
        .ar-teaser-cta {
          position: relative;
          margin-top: -8px;
          text-align: center;
          padding-top: 8px;
        }
        .ar-teaser-msg {
          font-size: 17px;
          line-height: 1.5;
          color: #2e2622;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .ar-teaser-msg b {
          color: #7a1f2b;
        }

        /* Expert paragraph below the share block (Stage 2). */
        .ar-expert {
          max-width: 620px;
          margin: 20px auto 0;
          text-align: center;
          font-size: 19px;
          line-height: 1.55;
          font-weight: 500;
          color: #2e2622;
        }
        /* Weekly-program section wrapper — the shared component brings its own
           (start-aligned) styling; just reset the sheet's centering. */
        .ar-weekly {
          text-align: start;
          margin-top: 12px;
        }

        /* HOW IT CONTINUES */
        .ar-howcard {
          text-align: center;
          max-width: 620px;
          margin: 20px auto 0;
          padding: 0 8px;
        }
        .ar-hl {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #7a1f2b;
          margin-bottom: 12px;
        }
        .ar-howcard p {
          font-size: 20px;
          line-height: 1.55;
          color: #2e2622;
          font-weight: 500;
        }
        .ar-howcard p + p {
          margin-top: 12px;
        }

        /* PRICE — no outer card (Itzik 2026-07-15): just the pricing content on
           the page background, no border/shadow/fill wrapping the whole area. */
        .ar-pricecard {
          max-width: 520px;
          margin: 0 auto;
          padding: 16px;
        }
        /* Two-column desktop shell — on mobile the wrappers are display:contents
           so they contribute NOTHING to layout (mobile is byte-for-byte the
           approved design); the itemised order summary is desktop-only. Everything
           below is turned on solely inside the min-width:760 block. */
        .ar-cols,
        .ar-col-plans,
        .ar-col-sum {
          display: contents;
        }
        .ar-order-sum {
          display: none;
        }
        /* Trial-timeline slot + .ar-trial-* rules removed 2026-07-16 (the
           trial-timeline block no longer renders). */
        .ar-trial-tag {
          display: inline-block;
          width: fit-content;
          margin-top: 6px;
          /* One line — never let "חינם" drop alone (Itzik 2026-07-04). */
          white-space: nowrap;
          /* 20px per Itzik 2026-07-03 (was 13px). */
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          background: var(--ar-grad);
          padding: 3px 10px;
          border-radius: 99px;
        }
        /* Coaching add-on (v2, 2026-07): a single checkbox in solid brand pink
           (D6409F, NOT the gradient) plus a per-cadence add-on price and, when
           checked, the expert value points. Replaces the with/without segmented
           toggle. Money plumbing unchanged (drives the shared coaching state). */
        /* Inside the selected card, aligned under the plan name (padding-start
           clears the radio, matching .incl); the divider spans the card width. */
        /* Coaching add-on — no frame; a gradient rule (.ar-grad-div) separates it
           from the base list above (Itzik 2026-07-15). */
        .ar-addon {
          padding: 0 17px 16px 17px;
        }
        /* Long gradient separator between base and coaching. */
        .ar-grad-div {
          height: 1px;
          border-radius: 1px;
          background: linear-gradient(95deg, #6c5ce7, #d6409f 52%, #f79154);
          margin: 4px 4px 18px;
        }
        /* Checkbox row on top, "+X" on its own line below, right-aligned (mockup);
           the "+X" lines up with the monthly price's right edge (33px indent). */
        .ar-addon-head {
          display: block;
        }
        /* Checkbox FIRST (RTL start = right), the label right after it (Itzik
           2026-07-15). JSX order is [box, title] and the row groups at the start. */
        .ar-addbtn {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          width: 100%;
          gap: 11px;
          background: none;
          border: 0;
          cursor: pointer;
          padding: 0;
          text-align: start;
        }
        .ar-box {
          width: 24px;
          height: 24px;
          border-radius: 7px;
          border: 2px solid #d8c8b3;
          flex: none;
          position: relative;
          transition: 0.15s;
        }
        .ar-box.on {
          border-color: transparent;
          background: #d6409f;
        }
        .ar-box.on::after {
          content: "";
          position: absolute;
          top: 5px;
          inset-inline-start: 6px;
          width: 10px;
          height: 5px;
          border-left: 2.5px solid #fff;
          border-bottom: 2.5px solid #fff;
          transform: rotate(-45deg);
        }
        .ar-addtitle {
          font-family: var(--font-heebo), "Assistant", "Heebo", sans-serif;
          font-size: 18px;
          font-weight: 600;
          color: #2e2622;
        }
        .ar-addbig {
          font-family: var(--font-assistant), "Assistant", "Heebo", system-ui, sans-serif;
          font-weight: 900;
          font-size: 26px;
          line-height: 1.1;
          white-space: nowrap;
          color: #2e2622;
          text-align: right;
          margin-top: 9px;
        }
        .ar-addbig .ar-cur {
          font-size: 16px;
          font-weight: 800;
        }
        .ar-addbig .ar-mo {
          font-family: var(--font-heebo), "Assistant", "Heebo", sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: #8a7a6b;
        }
        .ar-cexpert {
          margin-top: 16px;
        }
        /* "המומחה זמין לשני בני הזוג" — mirrors the trial strip: a gradient banner
           (white text), 26px, rounded TOP corners only, flat bottom. Appears when
           coaching is ticked (symmetry with "7 ימי ניסיון חינם"). */
        .ar-cexpert-lead {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          margin: 0 -17px 14px;
          padding: 12px 16px;
          border-radius: 16px 16px 0 0;
          background: linear-gradient(95deg, #6c5ce7, #d6409f 52%, #f79154);
          color: #fff;
          font-family: var(--font-heebo), "Assistant", "Heebo", system-ui, sans-serif;
          font-weight: 900;
          font-size: 26px;
          line-height: 1.1;
        }
        .ar-points {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 13px;
          padding: 0;
          margin: 0;
        }
        .ar-points li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 600;
          line-height: 1.4;
          color: #2e2622;
        }
        .ar-points svg {
          width: 19px;
          height: 19px;
          flex: none;
          margin-top: 1px;
          stroke: url(#arCoachGrad);
        }
        /* Packages container — the top border carries the trial legend
           (Itzik 2026-07-04). The margin/padding-top opens room so the legend
           sits ON the border without touching the coaching tabs above it. */
        /* Stray top border removed (Itzik 2026-07-15) — the h2 "איזו חבילה
           מתאימה לכם?" above the card is the header; the cadence cards flow
           directly with no disconnected hairline. */
        .ar-opts-wrap {
          position: relative;
        }
        /* Fieldset-legend trial tag, centered on the container's top border.
           Solid brand dark ink + white text (deliberately NOT the gradient, so
           it doesn't blend with the coaching tabs). One tag for the whole
           selector. white-space:nowrap keeps it one line on mobile. */
        .ar-trial-legend {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1;
          white-space: nowrap;
          max-width: calc(100% - 24px);
          background: #241d1a;
          color: #fff;
          font-family: var(--font-heebo), "Assistant", "Heebo", system-ui, sans-serif;
          font-size: 20px;
          font-weight: 800;
          padding: 5px 16px;
          border-radius: 999px;
          box-shadow: 0 4px 14px -6px rgba(0, 0, 0, 0.4);
        }
        /* Approved mockup: docs/promo-timer-mockup-approved.html (version B).
           Base = mobile (timer wraps to a centered line below); desktop
           override in the ≥760 media query keeps it inline (flex:1, centered). */
        /* Plan cards (pricing-redesign-approved.html): name+save on the start,
           price on the end (no period label). One .ar-opt-group per plan so the
           selected card + its included list read as one unit. */
        /* The selection row is a transparent flex row; the card chrome (bg +
           border) lives on .ar-opt-group. Radio/name at the start, price at the
           end (justify-content:space-between; .ar-opt-info flex:1). */
        .ar-opt {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 11px;
          width: 100%;
          background: none;
          border: 0;
          /* Left padding (46px) reserves the absolute radio's lane; content stays
             right-aligned to 17px. */
          padding: 16px 17px 0 46px;
          position: relative;
          z-index: 1;
          cursor: pointer;
          text-align: right;
          margin-bottom: 0;
          transition: 0.18s;
          font-family: inherit;
        }
        /* Plan card — white bg + subtle border, clipped so the trial strip and
           gradient ring follow the rounded corners. */
        .ar-opt-group {
          position: relative;
          background: #fff;
          border: 1.5px solid #ece2d4;
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .ar-opt-group:last-of-type {
          margin-bottom: 0;
        }
        /* Selected card = gradient border ring drawn by ::before (mask). */
        .ar-opt-group.sel {
          border-color: transparent;
          box-shadow: 0 8px 20px -12px rgba(150, 60, 150, 0.35);
        }
        .ar-opt-group.sel::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 16px;
          padding: 2px;
          background: linear-gradient(95deg, #6c5ce7, #d6409f 52%, #f79154);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: 2;
        }
        /* Trial "7 ימי ניסיון חינם" strip at the top of the SELECTED card. */
        /* "7 ימי ניסיון חינם" + "גישה מלאה לשני בני הזוג" — a two-line gradient
           banner (white text), rounded TOP corners only, flat bottom flush with
           the card body. The coaching "expert" strip below mirrors this exactly. */
        .ar-trial-strip {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 2px;
          margin: 0 0 16px;
          padding: 14px 16px;
          border-radius: 16px 16px 0 0;
          background: linear-gradient(95deg, #6c5ce7, #d6409f 52%, #f79154);
          color: #fff;
          font-family: var(--font-heebo), "Assistant", "Heebo", system-ui, sans-serif;
        }
        .ar-trial-t1 {
          font-weight: 900;
          font-size: 26px;
          line-height: 1.1;
        }
        .ar-trial-t2 {
          font-weight: 600;
          font-size: 18px;
          line-height: 1.5;
        }
        .ar-opt-group.sel .ar-opt {
          border: 0;
          background: transparent;
          border-radius: 0;
          box-shadow: none;
        }
        /* Radio: hollow ring; selected = gradient fill + white centre dot. */
        /* Radio pinned to the LEFT edge (blue line, Itzik 2026-07-15) so the
           coaching checkbox and every cadence radio start from one point, while
           all text content aligns to the right edge. */
        .ar-radio {
          position: absolute;
          left: 17px;
          top: 20px;
          flex: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid #d8c8b3;
          display: grid;
          place-items: center;
        }
        .ar-opt.sel .ar-radio {
          border-color: transparent;
          background: #d6409f;
        }
        .ar-opt.sel .ar-radio::after {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #fff;
        }
        .ar-opt-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
          text-align: right;
        }
        .ar-opt-name {
          font-family: var(--font-heebo), "Assistant", "Heebo", system-ui, sans-serif;
          font-weight: 800;
          font-size: 24px;
          line-height: 1.1;
          color: #2e2622;
        }
        .ar-opt-note {
          font-size: 13px;
          font-weight: 600;
          color: #8a7a6b;
        }
        /* "חיסכון X%" — gradient text, own line under the name. */
        .ar-opt-save {
          width: fit-content;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.2;
          margin-top: 2px;
          background: var(--ar-grad);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        /* Campaign-timer slot (only in promo_mode=campaign_timer). */
        .ar-opt-timer {
          flex-basis: 100%;
          display: flex;
          justify-content: center;
          margin-top: 10px;
        }
        /* Price — number + ₪ + period, on its OWN line, right-aligned UNDER the
           plan name (ALL cadences, per Itzik). ₪ and period in ink, not grey. */
        .ar-opt-price {
          order: 3;
          flex-basis: 100%;
          margin-inline-start: 0;
          margin-top: 3px;
          padding-inline-start: 0;
          display: flex;
          align-items: baseline;
          justify-content: flex-start;
          gap: 5px;
          white-space: nowrap;
          font-size: 24px;
          font-weight: 900;
          color: #2e2622;
          font-family: var(--font-heebo), "Assistant", "Heebo", system-ui, sans-serif;
        }
        .ar-price-num {
          font-size: 24px;
          font-weight: 900;
          line-height: 1;
          color: #2e2622;
          background: none;
          -webkit-text-fill-color: #2e2622;
        }
        .ar-price-cur {
          font-size: 14px;
          font-weight: 800;
          line-height: 1;
          color: #2e2622;
          background: none;
          -webkit-text-fill-color: #2e2622;
        }
        .ar-price-per {
          font-size: 14px;
          font-weight: 700;
          line-height: 1;
          color: #2e2622;
        }
        /* SELECTED (focal) package: 46px price (Assistant sans — all pricing
           numbers share one font, Itzik 2026-07-15), ₪ 19px; period muted 13px. */
        .ar-opt-group.sel .ar-opt-price {
          font-family: var(--font-assistant), "Assistant", "Heebo", system-ui, sans-serif;
          font-size: 46px;
        }
        .ar-opt-group.sel .ar-price-num {
          font-family: var(--font-assistant), "Assistant", "Heebo", system-ui, sans-serif;
          font-size: 46px;
        }
        .ar-opt-group.sel .ar-price-cur {
          font-size: 19px;
        }
        .ar-opt-group.sel .ar-price-per {
          font-size: 13px;
          color: #8a7a6b;
        }
        /* Included list under the SELECTED plan (pricing-redesign-approved.html):
           lead line + gradient-dot list aligned under the plan name (padding-
           start clears the radio). No "מה כלול" heading, no top divider. */
        /* Selected-card included block — exact approved spec. */
        .psave {
          padding: 5px 17px 0 17px;
          font-size: 20px;
          font-weight: 700;
          width: max-content;
          background: linear-gradient(95deg, #6c5ce7, #d6409f 52%, #f79154);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        /* On a NON-selected card the savings line is the last element (no incl
           block below it), so it needs its own bottom padding to breathe inside
           the card. */
        .ar-opt-group:not(.sel) .psave {
          padding-bottom: 16px;
        }
        /* Countdown sits right below the price/savings inside the selected card,
           aligned to the start (right, RTL) — beside the number it applies to,
           not centered mid-card. Overrides PersonalOfferTimer's own centering. */
        .ar-inline-timer {
          padding-block: 8px 2px;
          padding-inline: 17px 17px;
        }
        .ar-inline-timer :global(.pot) {
          margin-bottom: 0;
        }
        /* "מבצע חד פעמי לזמן מוגבל" label removed (Itzik 2026-07-15). */
        .ar-inline-timer :global(.pot-lead) {
          display: none;
        }
        /* Countdown tiles aligned to the other side (left, RTL). */
        .ar-inline-timer :global(.pot-tiles) {
          justify-content: flex-end;
        }
        /* Base "מה כלול" list — no frame (Itzik 2026-07-15); the gradient rule in
           the coaching block below provides the separation. */
        .incl {
          padding: 14px 17px 16px 17px;
        }
        .incl-div {
          height: 1px;
          background: #ece2d4;
          margin: 0 -33px 13px 0;
        }
        .incl-lead {
          font-size: 20px;
          color: #8a7a6b;
          font-weight: 600;
          margin-bottom: 14px;
        }
        .incl ul {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 13px;
        }
        .incl li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 600;
          color: #2e2622;
        }
        .dot {
          width: 8px;
          height: 8px;
          flex: none;
          border-radius: 50%;
          background: linear-gradient(95deg, #6c5ce7, #d6409f 52%, #f79154);
        }
        /* "לצפייה בעוד חבילות" — 14px black underlined link (Stage 1). */
        .ar-more-plans {
          display: block;
          margin: 14px auto 0;
          background: none;
          border: 0;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          color: #241d1a;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        /* Bold TOTAL row — discounted first-period total (big) + regular
           recurring below. base + coaching, separate summary above CTA. */
        .ar-total {
          max-width: 400px;
          margin: 18px auto 6px;
          padding: 14px 18px;
          border-radius: 16px;
          background: rgba(214, 64, 159, 0.06);
          border: 1.5px solid rgba(214, 64, 159, 0.22);
        }
        .ar-total-main {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .ar-total-label {
          font-size: 17px;
          font-weight: 800;
          color: #2e2622;
        }
        .ar-total-amt {
          font-family: var(--font-assistant), "Assistant", "Heebo", system-ui, sans-serif;
          font-size: 30px;
          font-weight: 900;
          background: var(--ar-grad);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .ar-total-after {
          margin-top: 6px;
          font-size: 14px;
          font-weight: 600;
          color: #7b6b5e;
          text-align: right;
        }
        /* Offer countdown beside the total — urgency at the decision point. Sits
           just under the total, tiles aligned to the start (right, RTL), the
           timer's own lead/centering overridden (same as .ar-inline-timer). */
        .ar-total-timer {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(214, 64, 159, 0.18);
        }
        .ar-total-timer :global(.pot) {
          margin-bottom: 0;
        }
        .ar-total-timer :global(.pot-tiles) {
          justify-content: flex-end;
        }
        /* Lead ("ההטבה בתוקף עוד:") aligned with the right-hugging tiles, not
           centered (Itzik 2026-07-15). */
        .ar-total-timer :global(.pot-lead) {
          text-align: right;
        }

        /* Selected-cadence headline summary (restored money-path detail) */
        .ar-summary {
          margin-top: 16px;
          text-align: center;
        }
        .ar-summary-line {
          font-size: 18px;
          color: #2e2622;
          font-weight: 600;
          line-height: 1.5;
        }
        .ar-summary-line b {
          font-family: var(--font-assistant), "Assistant", "Heebo", system-ui, sans-serif;
          font-size: 26px;
          font-weight: 900;
          background: var(--ar-grad);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .ar-summary-line s {
          color: #9a8a7c;
          font-weight: 600;
        }
        .ar-summary-note {
          font-size: 14px;
          color: #7b6b5e;
          margin-top: 4px;
        }
        .ar-fulltext {
          /* body sans (Assistant/Heebo), not the serif heading font */
          font-family: inherit;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.3;
          color: #2e2622;
          text-align: center;
          margin-top: 16px;
        }
        .ar-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          text-align: center;
          border: 0;
          cursor: pointer;
          font-family: inherit;
          font-weight: 800;
          font-size: 20px;
          color: #fff;
          padding: 18px;
          border-radius: 16px;
          background: var(--ar-grad);
          box-shadow: 0 16px 36px -12px rgba(150, 60, 150, 0.5);
          text-decoration: none;
          margin-top: 18px;
        }
        .ar-cta:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .ar-checkout-error {
          margin-top: 10px;
          text-align: center;
          font-size: 14px;
          color: #b3261e;
          background: rgba(179, 38, 30, 0.08);
          border: 1px solid rgba(179, 38, 30, 0.25);
          border-radius: 10px;
          padding: 8px 10px;
        }
        .ar-stop {
          text-align: center;
          font-size: 15px;
          font-weight: 500;
          color: #000000;
          margin-top: 12px;
        }
        /* Task 23 — "מנוי אחד, שני בני זוג" reassurance line near the price. */
        .ar-couple-note {
          text-align: center;
          /* 22px per Itzik 2026-07-03 (was 15px). */
          font-size: 22px;
          font-weight: 600;
          color: #5a4f46;
          margin-top: 14px;
        }
        /* Task 21 — personal 48h offer-window line (brand wine, quiet). */
        /* Zone A offer strip (mockup v1, Itzik 2026-07-04) — the personal-window
           line as a soft cream card, brand wine text. Site tokens. */
        .ar-offer-strip {
          margin-top: 16px;
          padding: 12px 16px;
          border-radius: 14px;
          background: #fbf1e6;
          border: 1px solid #f0e0cc;
          text-align: center;
          font-size: 18px;
          font-weight: 600;
          line-height: 1.5;
          color: #7a1f2b;
        }
        /* Personal-window countdown (display='clock', migration 184) — centre
           the reused PromoExpiryCountdown pill. */
        .ar-offer-clock {
          margin-top: 16px;
          display: flex;
          justify-content: center;
        }
        /* Zone divider between the three areas (choice / included / how it
           works). Hairline in the card-border tone. */
        /* .ar-zone-sep removed 2026-07-16 (its only use was above the removed
           trial-timeline block). */

        /* ACTIVE SUBSCRIBER */
        .ar-active {
          max-width: 520px;
          margin: 0 auto;
          text-align: center;
          background: #ffffff;
          border: 1px solid #ece2cf;
          border-radius: 24px;
          padding: 28px 20px;
          box-shadow: 0 18px 44px -22px rgba(120, 70, 120, 0.28);
        }
        .ar-active-title {
          font-size: 26px;
          font-weight: 900;
          color: #2e2622;
          margin-bottom: 8px;
        }
        .ar-active-sub {
          font-size: 18px;
          color: #5a4f46;
          margin-bottom: 16px;
        }
        .ar-active-link {
          display: inline-block;
          font-weight: 800;
          color: #7a1f2b;
          text-decoration: underline;
          text-underline-offset: 4px;
        }

        .ar-anchor {
          text-align: center;
          font-size: 20px;
          line-height: 1.5;
          color: #2e2622;
          font-weight: 600;
          max-width: 620px;
          margin: 6px auto 0;
          border: 1px solid #ead9c8;
          border-radius: 18px;
          padding: 20px 24px;
        }
        .ar-anchor :global(b) {
          color: #7a1f2b;
          font-weight: 800;
        }

        /* Partner-invite share (Stage 1) — WhatsApp + copy-link, centred. */
        .ar-share {
          text-align: center;
          margin-bottom: 20px;
        }
        .ar-share-title {
          font-size: 17px;
          font-weight: 700;
          color: #5a4f46;
          margin-bottom: 10px;
        }
        .ar-share-btns {
          display: inline-flex;
          gap: 12px;
        }
        .ar-share-btn {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 0;
          cursor: pointer;
          display: grid;
          place-items: center;
          color: #fff;
          transition: transform 0.15s;
        }
        .ar-share-btn:hover {
          transform: translateY(-2px);
        }
        .ar-share-btn.wa {
          background: #25d366;
        }
        .ar-share-btn.copy {
          background: var(--ar-grad);
        }
        .ar-share-copied {
          font-size: 13px;
          font-weight: 700;
          color: #2e8b57;
          margin-top: 8px;
          height: 16px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .ar-share-copied.show {
          opacity: 1;
        }

        /* Schedule-a-call CTA (Stage 1). */
        .ar-callcta {
          display: inline-block;
          margin-top: 16px;
          background: var(--ar-grad);
          border: 0;
          color: #fff;
          font-family: inherit;
          font-weight: 800;
          font-size: 17px;
          padding: 12px 24px;
          border-radius: 999px;
          cursor: pointer;
          transition: 0.15s;
          box-shadow: 0 12px 26px -12px rgba(150, 60, 150, 0.5);
        }
        .ar-callcta:hover {
          filter: brightness(1.06);
        }

        /* Schedule-a-call modal skeleton (Calendly wired later). */
        .ar-callmodal-root {
          position: fixed;
          inset: 0;
          z-index: 130;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .ar-callmodal-scrim {
          position: absolute;
          inset: 0;
          background: rgba(30, 20, 16, 0.55);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
        }
        .ar-callmodal {
          position: relative;
          width: 100%;
          max-width: 460px;
          background: #fff;
          border-radius: 20px;
          padding: 26px 22px;
          text-align: center;
          box-shadow: 0 30px 70px -30px rgba(40, 25, 18, 0.6);
        }
        .ar-callmodal-x {
          position: absolute;
          top: 10px;
          inset-inline-end: 14px;
          background: none;
          border: 0;
          font-size: 26px;
          line-height: 1;
          color: #9a8a7c;
          cursor: pointer;
        }
        .ar-callmodal-title {
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
          font-size: 24px;
          font-weight: 800;
          color: #2e2622;
          margin-bottom: 8px;
        }
        .ar-callmodal-sub {
          font-size: 16px;
          color: #5a4f46;
          margin-bottom: 18px;
        }
        .ar-callmodal-embed {
          min-height: 260px;
          border: 1.5px dashed #e0d3c2;
          border-radius: 14px;
          display: grid;
          place-items: center;
          color: #a2917f;
          font-size: 15px;
          padding: 20px;
        }

        /* ============ MOBILE width (≤759) ============
           The pricing area fills ~95% of the screen. The base max-width:520 cap
           left empty gutters on wider phones / portrait tablets, and the sheet's
           24px side padding narrowed it further. Scoped to max-width:759 so the
           desktop two-column layout (min-width:760) is completely untouched. */
        @media (max-width: 759px) {
          #ar-price {
            /* cancel the sheet's 24px side padding so the section is full-bleed */
            margin-inline: -24px;
          }
          .ar-pricecard {
            width: 95%;
            /* sensible cap so it doesn't get too wide on a large tablet in
               portrait (still below the 760 desktop breakpoint) */
            max-width: 760px;
            padding: 16px 10px;
          }
        }

        /* ============ DESKTOP (≥760) ============ */
        @media (min-width: 760px) {
          .ar-hero {
            display: block;
            padding: 0;
            background: #241d1a;
            background-image: none;
            /* Stage 1: shorter hero now the subline + graph left it (was 420). */
            min-height: 200px;
          }
          .ar-logo {
            top: 28px;
            left: 36px;
          }
          .ar-hero-figure {
            display: block;
            position: absolute;
            top: 0;
            bottom: 0;
            right: 0;
            width: 48%;
            /* Fill the box fully (cover), keep the couple centred, and fall back
               to the hero ink so no blank strip ever shows (Stage 1 fix). */
            background: #241d1a url("/images/hero-assess.webp") center center /
              cover no-repeat;
          }
          .ar-hero-figure::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
              to left,
              rgba(36, 29, 26, 0) 0%,
              rgba(36, 29, 26, 0.25) 38%,
              #241d1a 78%
            );
          }
          .ar-hero-content {
            position: relative;
            z-index: 1;
            max-width: 780px;
            margin: 0 auto;
            text-align: center;
            /* Bottom padding trimmed (was 60) now the graph left the hero, so it
               ends clean under the subline (2026-07-12). */
            padding: 54px 40px 46px;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .ar-h1 {
            font-size: 50px;
            max-width: 720px;
          }
          .ar-sub {
            font-size: 22px;
            max-width: 680px;
            margin-bottom: 0;
          }
          .ar-bars.on-light {
            max-width: 480px;
            height: 170px;
            width: 100%;
          }
          .ar-strip-stat {
            font-size: 28px;
          }
          .ar-sheet {
            max-width: 1060px;
            margin: 0 auto;
            padding: 60px 48px 80px;
          }
          .ar-section {
            max-width: 920px;
            margin-left: auto;
            margin-right: auto;
            margin-bottom: 56px;
          }
          .ar-fbcard {
            max-width: 680px;
          }
          .ar-fbtext {
            font-size: 20px;
          }
          /* The pricing section gets extra room for the two columns (this one
             section only — via #ar-price — so other sections keep their width). */
          #ar-price {
            max-width: 1040px;
          }
          .ar-pricecard {
            /* Two-column SaaS layout on desktop (Itzik 2026-07-15): wide enough
               for a comfortable plans column + the sticky summary, generously
               spaced. Mobile keeps its own (untouched) width. */
            max-width: 1000px;
            padding: 36px 44px 40px;
          }
          /* Turn the mobile display:contents wrappers into the real grid. */
          .ar-cols {
            display: flex;
            gap: 48px;
            align-items: flex-start;
          }
          .ar-col-plans {
            display: block;
            flex: 1.4;
            min-width: 0;
          }
          .ar-col-sum {
            display: block;
            width: 372px;
            flex: none;
            position: sticky;
            top: 24px;
            /* No card wrapper (Itzik 2026-07-15) — just the summary content on the
               page background: no border, shadow, or fill. */
            padding: 0;
          }
          /* Dedupe the total: the standalone "לתשלום" money line is redundant on
             desktop — the order-summary breakdown + the single .ar-total below
             cover it. (Only ever rendered off-trial; hidden here either way.) */
          .ar-summary {
            display: none;
          }
          /* Itemised order summary (desktop only). */
          .ar-order-sum {
            display: block;
            margin-bottom: 6px;
          }
          .ar-os-title {
            font-size: 22px;
            font-weight: 900;
            margin-bottom: 14px;
            text-align: start;
          }
          .ar-os-line {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            font-size: 20px;
            margin-bottom: 11px;
            color: #5a5049;
          }
          .ar-os-line.muted {
            opacity: 0.5;
          }
          .ar-os-v {
            font-weight: 700;
            color: #2e2622;
            white-space: nowrap;
          }
          .ar-os-disc .ar-os-v {
            color: #7a1f2b;
          }
          /* On desktop the total blends INTO the summary panel — drop its own
             pink box so the panel reads as one card (the panel carries the frame).
             Mobile keeps the standalone boxed total. */
          .ar-total {
            border: 0;
            background: transparent;
            border-top: 1px solid #ece2d4;
            border-radius: 0;
            padding: 12px 0 0;
            margin: 12px 0 0;
            max-width: none;
          }
          .ar-total-timer {
            border-top: 0;
            padding-top: 8px;
          }
          .ar-cta {
            margin-top: 14px;
          }
          /* Desktop: radio + name/save on the start, price on the end (same
             single-row layout as mobile; the campaign timer, when present, owns
             the centre). */
          .ar-opt-note {
            white-space: nowrap;
          }
          .ar-opt-timer {
            order: 2;
            flex: 1;
            flex-basis: auto;
            margin-top: 0;
          }
          .ar-sh {
            text-align: center;
            font-size: 30px;
          }
          .ar-sublabel {
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}
