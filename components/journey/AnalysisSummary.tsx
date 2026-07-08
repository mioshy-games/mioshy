"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Analysis, Locale } from "@/lib/journey/types";
import {
  CATEGORY_FEEDBACK,
  CATEGORY_WEAK_BELOW,
  type CategoryKey,
} from "@/lib/journey/category-feedback";
import { useCmsText } from "@/hooks/useCmsText";
import { useTrialOffer } from "@/hooks/useTrialOffer";
import { PromoExpiryCountdown } from "@/components/journey/PromoExpiryCountdown";
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
  /** Render mode. "full" (default) = the assessment results paywall. "subscribe"
   *  = a lean subscribe page (reused by /journey/subscribe): keeps the hero +
   *  score bars + the pricing/checkout block, and hides the assessment-only
   *  sections (personal feedback, category cards, improvements, value-anchor).
   *  In "subscribe" mode `analysis` may be null (no assessment) — the pricing
   *  block still renders. The pricing/checkout code is identical in both modes,
   *  so displayed==charged is unchanged. */
  mode?: "full" | "subscribe";
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

// Fixed display order for the 5 categories (bars + cards) — matches the mockup
// and is stable across users so the visual is comparable.
const CAT_ORDER: CategoryKey[] = [
  "intimacy",
  "emotional_connection",
  "communication",
  "friendship",
  "family",
];

// Short bar labels (distinct from the longer CATEGORY_FEEDBACK card names).
const BAR_LABEL: Record<CategoryKey, { he: string; en: string }> = {
  intimacy: { he: "אינטימיות", en: "Intimacy" },
  emotional_connection: { he: "חיבור רגשי", en: "Emotional" },
  communication: { he: "תקשורת", en: "Communication" },
  friendship: { he: "חברות", en: "Friendship" },
  family: { he: "משפחה", en: "Family" },
};

// Dynamic level descriptor by score (and the lowest override). Display-only.
function levelDesc(score: number, isLowest: boolean, isHe: boolean): string {
  if (isLowest) return isHe ? "הכי הרבה מקום לצמיחה" : "the most room to grow";
  if (score < 50) return isHe ? "מקום לחיזוק" : "room to strengthen";
  if (score < 62) return isHe ? "בסיס טוב" : "a good base";
  return isHe ? "תחום חזק יחסית" : "a relative strength";
}

export function AnalysisSummary({
  analysis,
  locale,
  journeySubscribed = false,
  journeyCadences = [],
  activePromo = null,
  offerExpiresAt = null,
  promoMode = "personal_window",
  mode = "full",
}: AnalysisSummaryProps) {
  const isHe = locale === "he";
  const isSubscribe = mode === "subscribe";
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  // offerWindowLabel (Task 21 + Task 26 #2) is defined further down, after the
  // monthly promo/regular prices are resolved — the bonus copy needs them.

  // ── Cadence picker (hooks must run before the loading early-return) ──
  const enabledCadences = journeyCadences
    .filter((c) => c.enabled)
    .sort((a, b) => CADENCE_ORDER[a.cadence] - CADENCE_ORDER[b.cadence]);
  const defaultCadence =
    (enabledCadences.find((c) => c.is_default) ?? enabledCadences[0])?.cadence ??
    "monthly";
  const [selectedCadence, setSelectedCadence] = useState<string>(defaultCadence);

  // ── Stage-1 coaching add-on ────────────────────────────────────────────
  // The toggle only appears once Itzik sets a coaching cost (>0) on any
  // enabled cadence. Until then coaching defaults to true and the bundle
  // equals content (cost 0) — identical to today, no confusing 0₪ choice.
  const hasCoachingCost = enabledCadences.some(
    (c) => (isHe ? c.coaching_cost_ils : c.coaching_cost_usd) > 0,
  );
  const [coaching, setCoaching] = useState(true);

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
  const cmsEyebrow = useCmsText(`${RK}.eyebrow`).text;
  const cmsHeroSub = useCmsText(`${RK}.heroSub`).text;
  const cmsFeedbackLabel = useCmsText(`${RK}.feedbackLabel`).text;
  const cmsCategoriesLabel = useCmsText(`${RK}.categoriesLabel`).text;
  const cmsContinueLabel = useCmsText(`${RK}.continueLabel`).text;
  const cmsContinueP1 = useCmsText(`${RK}.continueP1`).text;
  const cmsContinueP2 = useCmsText(`${RK}.continueP2`).text;
  const cmsImprovementsLabel = useCmsText(`${RK}.improvementsLabel`).text;
  const cmsImprove1 = useCmsText(`${RK}.improve1`).text;
  const cmsImprove2 = useCmsText(`${RK}.improve2`).text;
  const cmsImprove3 = useCmsText(`${RK}.improve3`).text;
  const cmsImprove4 = useCmsText(`${RK}.improve4`).text;
  const cmsImprove5 = useCmsText(`${RK}.improve5`).text;
  const cmsImprove6 = useCmsText(`${RK}.improve6`).text;
  const cmsPriceTitle = useCmsText(`${RK}.priceTitle`).text;
  const cmsIncluded1 = useCmsText(`${RK}.included1`).text;
  const cmsIncluded2 = useCmsText(`${RK}.included2`).text;
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
  const aiHero = analysis?.summary.ai_hero ?? null;
  const heroText = aiHero ? (isHe ? aiHero.hero_he : aiHero.hero_en) : null;
  // AI failed → generic, NON-deterministic h1 (no fabricated insight).
  const h1Text =
    heroText ??
    (isHe ? "הנה תמונת המצב מהאבחון שלכם." : "Here's the picture from your assessment.");
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
        const rawPath =
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : `/journey/assessment`;
        const localeless =
          rawPath.replace(/^\/(he|en)(?=\/|$)/, "") || "/journey/assessment";
        const back = encodeURIComponent(localeless);
        window.location.href = `/${locale}/auth/signup?next=${back}`;
        return;
      }
      if (data?.redirect_url) {
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
  const selectedOption =
    enabledCadences.find((c) => c.cadence === selectedCadence) ??
    enabledCadences[0] ??
    null;

  // Task 16 — 7-day trial timeline (shown in the package selector when a trial
  // is enabled for the selected option). Copy is the "בעוד X ימים" relative-time
  // revision (Itzik 2026-07-02); this builds the "בעוד 7 ימים" line only. The
  // price is injected live from the selected option (single source), so it never
  // drifts. Amounts go through priceStr (NBSP -> no line break). Non-monthly uses
  // the existing approved period labels. EN never renders (trial is ILS-only).
  const trialDay7 = (() => {
    const cad = checkoutPlan;
    const pf = promoSet?.firstChargeByCadence[cad];
    const po = promoSet?.originalByCadence[cad];
    if (pf && po) {
      const first = isHe ? pf.ils : pf.usd;
      const full = isHe ? po.ils : po.usd;
      if (cad === "monthly") {
        return isHe
          ? `מתחיל החיוב. חודש ראשון ${priceStr(first)}, ואחריו ${priceStr(full)} לחודש.`
          : `billing begins. ${priceStr(first)} first month, then ${priceStr(full)}/mo.`;
      }
      return isHe
        ? `מתחיל החיוב. ${priceStr(first)} ${firstPeriodLabel(cad, true)}, ואחריו ${priceStr(full)} ${periodLabel(cad)}.`
        : `billing begins. ${priceStr(first)} ${firstPeriodLabel(cad, false)}, then ${priceStr(full)} ${periodLabel(cad)}.`;
    }
    // No active promo: comma form, "לחודש" for monthly (approved period label
    // otherwise). "מתחיל החיוב, {מחיר_רגיל} לחודש."
    const amt = selectedOption ? amtOf(selectedOption) : 0;
    const recurringLabel = cad === "monthly" ? (isHe ? "לחודש" : "/mo") : periodLabel(cad);
    return isHe
      ? `מתחיל החיוב, ${priceStr(amt)} ${recurringLabel}.`
      : `billing begins, ${priceStr(amt)} ${recurringLabel}.`;
  })();

  return (
    <div className="ar-root" dir={isHe ? "rtl" : "ltr"}>
      {/* ── HERO ───────────────────────────────────────────────────── */}
      <div className="ar-hero">
        <a className="ar-logo" href={`/${locale}`} aria-label="Mioshy home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mioshy-white.svg" alt="Mioshy" width={116} height={37} />
        </a>
        <div className="ar-hero-figure" aria-hidden />
        <div className="ar-hero-content">
          <div className="ar-eyebrow">
            {isSubscribe
              ? rc(cmsSubEyebrow, "מנוי מיאושי", "Mioshy membership")
              : rc(cmsEyebrow, "תוצאות האבחון שלכם", "Your assessment results")}
          </div>
          <h1 className="ar-h1 font-heading">
            {isSubscribe
              ? rc(cmsSubH1, "בחרו את המנוי שמתאים לכם", "Choose your plan")
              : h1Text}
          </h1>
          <p className="ar-sub">
            {isSubscribe
              ? rc(
                  cmsSubFraming,
                  "להצטרפות לשירות, בחרו את המנוי הנוח ביותר לכם, מנוי זוגי כלול לשניכם ללא תוספת.",
                  "To join, choose the plan that suits you best; a couple subscription is included for both at no extra charge.",
                )
              : rc(
                  cmsHeroSub,
                  "השלמת את האבחון. ניתחנו את הנתונים שלך, ובנינו עבורך תמונת מצב אישית שמראה איפה הזוגיות חזקה, ואיפה נמצא הפוטנציאל הגדול ביותר לשיפור.",
                  "You completed the assessment. We analysed your answers and built a personal picture showing where the relationship is strong, and where the biggest potential to improve is.",
                )}
          </p>
          {categoryScores ? (
            <div className="ar-bars">
              {CAT_ORDER.map((key) => {
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
                                "linear-gradient(rgba(255,255,255,.07),rgba(255,255,255,.07)) padding-box, var(--ar-grad) border-box",
                            }
                      }
                    />
                    <span className="ar-lbl">{isHe ? BAR_LABEL[key].he : BAR_LABEL[key].en}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
          {/* Hero link removed (2026-07-02) — duplicated the sticky CTA + the
              offer section and distracted from reading the report. */}
        </div>
      </div>

      {/* ── SHEET ──────────────────────────────────────────────────── */}
      <div className="ar-sheet">
        {/* PERSONAL FEEDBACK — assessment-only; hidden on the subscribe page. */}
        {!isSubscribe && narrative ? (
          <section className="ar-section">
            <div className="ar-fbcard">
              <div className="ar-photo" aria-hidden />
              <div className="ar-sublabel ar-center">
                {rc(cmsFeedbackLabel, "המשוב האישי שלכם", "Your personal feedback")}
              </div>
              <p className="ar-fbtext">{narrative}</p>
            </div>
          </section>
        ) : null}

        {/* CATEGORIES — assessment-only cards; hidden on the subscribe page
            (the 5-domain graph bars in the hero above are kept). */}
        {!isSubscribe && categoryScores ? (
          <section className="ar-section">
            <div className="ar-sublabel">
              {rc(cmsCategoriesLabel, "מה התשובות שלכם מספרות", "What your answers tell")}
            </div>
            <div className="ar-cats">
              {CAT_ORDER.map((key) => {
                const score = categoryScores[key];
                const fb = CATEGORY_FEEDBACK[key];
                const insufficient = insufficientKeys.includes(key);
                const isLowest = !insufficient && key === categoryScores.lowest_key;
                const weak = score < CATEGORY_WEAK_BELOW;
                const text = insufficient
                  ? isHe
                    ? "כדי לתת לכם משוב מדויק בתחום הזה צריך עוד כמה תשובות, וזה מה שהאבחון המלא עושה."
                    : "We need a few more answers to give you accurate feedback here, that's what the full assessment does."
                  : isHe
                    ? weak ? fb.weak_he : fb.strong_he
                    : weak ? fb.weak_en : fb.strong_en;
                return (
                  <div className={`ar-catcard${isLowest ? " low" : ""}`} key={key}>
                    <div className="ar-scorerow">
                      <span className="ar-snum font-heading">{insufficient ? "–" : score}</span>
                      <span className="ar-sof">/ 100</span>
                      <span className="ar-sexp">
                        {insufficient
                          ? isHe ? "דרוש אבחון מלא" : "full assessment needed"
                          : levelDesc(score, isLowest, isHe)}
                      </span>
                      {isLowest ? (
                        <span className="ar-badge">{isHe ? "נתחיל מכאן" : "start here"}</span>
                      ) : null}
                    </div>
                    <div className="ar-cname">{isHe ? fb.he : fb.en}</div>
                    <p className="ar-ctxt">{text}</p>
                  </div>
                );
              })}
            </div>
            <div className="ar-howcard">
              <div className="ar-hl">
                {rc(cmsContinueLabel, "מכאן ממשיכים יחד", "From here we continue together")}
              </div>
              <p>
                {rc(
                  cmsContinueP1,
                  "על כל אחד מהתחומים האלה נעבוד יחד, פרק חדש בכל שבוע, ואתם קובעים את הסדר.",
                  "We'll work on each of these areas together, a new chapter every week, and you set the order.",
                )}
              </p>
              <p>
                {rc(
                  cmsContinueP2,
                  "את האבחון המלא, לתמונה מדויקת ולתוצאות עמוקות יותר, נשלים יחד מיד אחרי ההצטרפות לתוכנית הייעוץ הזוגי של מיאושי.",
                  "We'll complete the full assessment together, for a more accurate picture and deeper results, right after you join Mioshy's couples coaching.",
                )}
              </p>
            </div>
          </section>
        ) : null}

        {/* IMPROVEMENTS — static design copy (NOT the AI recommendations).
            Pre-purchase selling section: hidden for subscribers + on subscribe page. */}
        {!journeySubscribed && !isSubscribe ? (
          <section className="ar-section">
            <div className="ar-sublabel">
              {rc(cmsImprovementsLabel, "מה תקבלו בליווי", "What you get in the program")}
            </div>
            <div className="ar-imp">
              <div className="ar-improw">
                <span className="ar-ic">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 20s-7-4.5-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.5-7 9-7 9z" />
                    <path d="M12 11v-3M10.5 9.5h3" strokeWidth="1.4" />
                  </svg>
                </span>
                <span>{rc(cmsImprove1, "האינטימיות תגדל", "Intimacy will grow")}</span>
              </div>
              <div className="ar-improw">
                <span className="ar-ic">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 7v11" />
                    <path d="M12 9C9 3 3 4.5 4 9.5c.8 3.8 6 4.5 8 1.5" />
                    <path d="M12 9c3-6 9-4.5 8 .5-.8 3.8-6 4.5-8 1.5" />
                  </svg>
                </span>
                <span>{rc(cmsImprove2, "הפרפרים יחזרו לבטן", "The butterflies will return")}</span>
              </div>
              <div className="ar-improw">
                <span className="ar-ic">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 3c1 3-1 4-1 6a3 3 0 006 0c0-1 0-2-1-3 2 1 4 4 4 7a8 8 0 01-16 0c0-4 3-6 4-8 1 1 2 1 4-2z" />
                  </svg>
                </span>
                <span>{rc(cmsImprove3, "הסקס יהיה עוצמתי מתמיד", "Sex will be better than ever")}</span>
              </div>
              <div className="ar-improw">
                <span className="ar-ic">
                  <svg viewBox="0 0 24 24">
                    <circle cx="8" cy="9" r="2.4" />
                    <circle cx="16" cy="9" r="2.4" />
                    <path d="M3.5 19a4.5 4.5 0 019 0M11.5 19a4.5 4.5 0 019 0" />
                  </svg>
                </span>
                <span>{rc(cmsImprove4, "החברות ביניכם תתחזק", "Your friendship will strengthen")}</span>
              </div>
              <div className="ar-improw">
                <span className="ar-ic">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 7h11l3 3-3 3H5z" />
                    <path d="M5 7v12" strokeWidth="1.4" />
                  </svg>
                </span>
                <span>{rc(cmsImprove5, "הריבים יפחתו והשקט יחזור", "Arguments will ease and calm returns")}</span>
              </div>
              <div className="ar-improw">
                <span className="ar-ic">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 20s-7-4.5-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.5-7 9-7 9z" />
                  </svg>
                </span>
                <span>{rc(cmsImprove6, "האהבה תחזור", "Love will return")}</span>
              </div>
            </div>
          </section>
        ) : null}

        {/* PRICE (non-subscriber) / ACTIVE-SUBSCRIBER card */}
        {!journeySubscribed ? (
          <section className="ar-section" id="ar-price">
            <h2 className="ar-sh font-heading">
              {rc(cmsPriceTitle, "איזו חבילה מתאימה לכם?", "Which plan fits you?")}
            </h2>
            <div className="ar-pricecard">
              {/* Stage-1 coaching add-on — with/without choice. Only rendered
                  once a coaching cost is configured (else the bundle == content
                  and a 0₪ choice would only confuse). */}
              {hasCoachingCost ? (
                <div className="ar-coach-wrap">
                  <div
                    className="ar-coach"
                    role="group"
                    aria-label={isHe ? "בחירת ייעוץ זוגי" : "Couples-coaching choice"}
                  >
                    <button
                      type="button"
                      className={`ar-coach-opt${coaching ? " sel" : ""}`}
                      onClick={() => setCoaching(true)}
                      aria-pressed={coaching}
                    >
                      {isHe ? "עם ייעוץ זוגי כלול" : "With couples coaching"}
                    </button>
                    <button
                      type="button"
                      className={`ar-coach-opt${!coaching ? " sel" : ""}`}
                      onClick={() => setCoaching(false)}
                      aria-pressed={!coaching}
                    >
                      {isHe ? "ללא ייעוץ זוגי" : "Without couples coaching"}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Packages ← journeyCadences. Price shown = promo first-charge
                  (server-computed) or the regular price for that cadence. */}
              <div className="ar-opts-wrap">
                {/* Trial tag as a fieldset-style legend on the container's top
                    border (Itzik 2026-07-04): ONE tag for the whole selector
                    (the trial applies to every package), dark solid bg + white
                    text — NOT the brand gradient, which blends into the coaching
                    tabs above. Shows only when the current coaching selection is
                    trial-enabled (useTrialOffer already keys off `coaching`). */}
                {trial.enabled ? (
                  <span className="ar-trial-legend">{trial.cardTag}</span>
                ) : null}
                {enabledCadences.map((c) => {
                const selected = c.cadence === selectedCadence;
                const amt = amtOf(c);
                const pf = promoSet?.firstChargeByCadence[c.cadence];
                const po = promoSet?.originalByCadence[c.cadence];
                const hasPromo = !!(promoSet && pf && po);
                const firstAmt = hasPromo ? (isHe ? pf!.ils : pf!.usd) : amt;
                const origAmt = hasPromo ? (isHe ? po!.ils : po!.usd) : amt;
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
                // Promo (monthly) savings % off the regular price for that
                // cadence — same calc as Stage-3 and the quarterly/yearly rows.
                const promoSavePct =
                  hasPromo && origAmt > 0 && firstAmt < origAmt
                    ? Math.round(((origAmt - firstAmt) / origAmt) * 100)
                    : null;
                // Yearly "N months free" — computed LIVE (Itzik 2026-07-04):
                // floor((full monthly × 12 − yearly price) / full monthly).
                // Today: (67×12 − 1570)/67 = floor(3.4) = 3 → "3 חודשים חינם".
                const freeMonths =
                  c.cadence === "yearly" && monthlyFull != null && amt > 0
                    ? Math.floor((monthlyFull * 12 - amt) / monthlyFull)
                    : null;
                return (
                  <button
                    type="button"
                    className={`ar-opt${selected ? " sel" : ""}`}
                    onClick={() => setSelectedCadence(c.cadence)}
                    aria-pressed={selected}
                    key={c.cadence}
                  >
                    <span className="ar-radio" />
                    <span className="ar-opt-info">
                      <span className="ar-opt-name">{cadenceTitle(c.cadence)}</span>
                    </span>
                    {/* Mobile width fix (Itzik 2026-07-04): tag / sub-line /
                        "חיסכון %" move to their OWN full-width row BELOW the
                        radio+name+price line, so they use the whole card width
                        instead of the narrow info column that shared the row
                        with the big price. */}
                    <span className="ar-opt-details">
                      {/* Trial tag moved to the selector's top-border legend
                          (Itzik 2026-07-04); no longer per-card. */}
                      {hasPromo ? (
                        <>
                          {/* Sub line first; "חיסכון X%" moved to its OWN line
                              below it (2026-07-01, Itzik) — matches the pricing
                              page, no longer inline with the sub. */}
                          <span className="ar-opt-note">
                            {`${firstPeriodLabel(c.cadence, isHe)}${isHe ? ", אח״כ " : ", then "}${priceStr(origAmt)}`}
                          </span>
                          {/* Task 21/#4 (Itzik 2026-07-02, option A REVERTED):
                              "חיסכון %" stays on the card even when the trial tag
                              is present. X is always computed live from the real
                              prices ((regular − promo) / regular, rounded) — never
                              hardcoded. */}
                          {promoSavePct != null ? (
                            <span className="ar-opt-save">
                              {isHe ? "חיסכון" : "Save"} {promoSavePct}%
                              {/* Clarify the monthly promo is a FIRST-month
                                  discount (Itzik 2026-07-04). */}
                              {c.cadence === "monthly"
                                ? isHe ? " על החודש הראשון" : " on the first month"
                                : ""}
                            </span>
                          ) : null}
                        </>
                      ) : savePct != null ? (
                        <span className="ar-opt-save">
                          {isHe ? "חיסכון" : "Save"} {savePct}%
                          {/* Yearly "N months free" — computed live (Itzik
                              2026-07-04), grammatical Hebrew. */}
                          {c.cadence === "yearly" && freeMonths && freeMonths > 0
                            ? isHe
                              ? ` · ${freeMonthsHe(freeMonths)}`
                              : ` · ${freeMonths} months free`
                            : ""}
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
                      <span className="ar-price-num">{fmt(firstAmt)}</span>
                      <span className="ar-price-cur">{sym}</span>
                    </span>
                  </button>
                );
              })}
              </div>

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

              {/* Zone A end — the personal-window offer as a styled strip
                  (mockup v1, Itzik 2026-07-04). Only with an active window. */}
              {offerWindowLabel ? (
                <p className="ar-offer-strip">{offerWindowLabel}</p>
              ) : null}

              <hr className="ar-zone-sep" aria-hidden />

              {/* ── Zone B — "מה כלול" 2-col grid. The coaching DUPLICATE
                  (included5 "ייעוץ זוגי עם מיאושי") is dropped: the chat item
                  (included2) already represents the coaching add-on, so we don't
                  list coaching twice. included2 stays gated on the coaching
                  toggle so the without-coaching bundle never promises the chat.
                  The "מנוי אחד, שני בני זוג" line is the section subtitle. */}
              <div className="ar-incl-head">
                <h3 className="ar-incl-title font-heading">
                  {isHe ? "מה כלול" : "What's included"}
                </h3>
                <p className="ar-incl-sub">
                  {isHe
                    ? "מנוי אחד, שני בני זוג. בלי תוספת מחיר."
                    : "One subscription, both partners. No extra charge."}
                </p>
              </div>
              <div className="ar-incl">
                {[
                  rc(cmsIncluded1, "פרק חדש כל שבוע", "A new chapter every week"),
                  ...(coaching
                    ? [rc(cmsIncluded2, "מומחה זוגיות פרטי בצ'אט", "A private relationship expert in chat")]
                    : []),
                  rc(cmsIncluded3, "משחקי זוגות אונליין", "Online couples games"),
                  rc(cmsIncluded4, "הסקס של מיאושי", "Mioshy's sex games"),
                ].map((it, i) => (
                  <div className="ar-it" key={i}>
                    <span aria-hidden className="ar-it-check">✓</span>
                    <span>{it}</span>
                  </div>
                ))}
              </div>

              <hr className="ar-zone-sep" aria-hidden />

              {/* Task 16 — 7-day trial timeline (Blinkist pattern). Moved below
                  the package options, right above the CTA (Itzik 2026-07-03):
                  choose a plan first, then see what happens from today to day 7
                  beside the action button. Relative-time copy + ✓ markers; the
                  first line bridges to the full assessment; day-7 price injected
                  live. The foot is a summary line (no ✓, no colon). */}
              {trial.enabled ? (
                <div className="ar-trial-tl">
                  <div className="ar-trial-row">
                    <span aria-hidden className="ar-trial-check">✓</span>
                    <span>
                      <b>{isHe ? "היום:" : "Today:"}</b>{" "}
                      {isHe
                        ? "מצטרפים בלי חיוב, והאבחון המלא מחכה לכם עם תמונה מדויקת יותר."
                        : "join with no charge, and the full assessment awaits with a sharper picture."}
                    </span>
                  </div>
                  <div className="ar-trial-row">
                    <span aria-hidden className="ar-trial-check">✓</span>
                    <span>
                      <b>{isHe ? "בעוד 5 ימים:" : "In 5 days:"}</b>{" "}
                      {isHe
                        ? "נשלח לכם תזכורת שתקופת הניסיון עומדת להסתיים."
                        : "we'll send a reminder that the trial is ending."}
                    </span>
                  </div>
                  <div className="ar-trial-row">
                    <span aria-hidden className="ar-trial-check">✓</span>
                    <span>
                      <b>{isHe ? "בעוד 7 ימים:" : "In 7 days:"}</b> {trialDay7}
                    </span>
                  </div>
                  <div className="ar-trial-foot">
                    {isHe
                      ? "ביטול בכל רגע, בלחיצת כפתור מהאזור האישי."
                      : "cancel any time, one click from your account."}
                  </div>
                </div>
              ) : null}

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
                    ? trial.ctaLabel
                    : ctaLabelCms && ctaLabelCms.trim().length > 0
                      ? ctaLabelCms
                      : isHe ? "להצטרפות עכשיו" : "Join now"}
                {!checkoutBusy ? <Arrow className="ar-cta-arrow" aria-hidden /> : null}
              </button>
              {checkoutError ? (
                <p className="ar-checkout-error" role="alert">
                  {checkoutError}
                </p>
              ) : null}
              <div className="ar-stop">
                {trial.enabled && trial.disclosure
                  ? trial.disclosure
                  : rc(cmsStopNote, "אפשר לעצור בכל עת בלחיצת כפתור.", "Cancel anytime with one tap.")}
              </div>
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
                "איתנו תקבלו ליווי צמוד ותוכנית מובנית, עם פרק אחד בשבוע שבו תבצעו משימות ותעצימו את הזוגיות שלכם מיום ליום.",
                "With us you get close guidance and a structured plan, one chapter a week to strengthen your relationship day by day.",
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
          margin-bottom: 20px;
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
        .ar-sh {
          font-size: 25px;
          margin-bottom: 4px;
          line-height: 1.2;
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
        .ar-photo {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          margin: 0 auto 20px;
          background: url("/images/assess.webp") center 25% / cover no-repeat;
          box-shadow: 0 14px 34px -14px rgba(80, 50, 35, 0.45);
          border: 4px solid #fff;
        }
        .ar-fbtext {
          font-size: 24px;
          font-weight: 500;
          line-height: 1.5;
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

        /* IMPROVEMENTS */
        .ar-imp {
          display: flex;
          flex-direction: column;
          gap: 13px;
          margin-top: 18px;
        }
        .ar-improw {
          display: flex;
          gap: 15px;
          align-items: center;
          background: #fffdf9;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 6px 18px -14px rgba(80, 50, 35, 0.3);
        }
        .ar-ic {
          flex: none;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(
            150deg,
            rgba(108, 92, 231, 0.16),
            rgba(214, 64, 159, 0.12)
          );
          display: grid;
          place-items: center;
          color: #b3318c;
        }
        .ar-ic :global(svg) {
          width: 25px;
          height: 25px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.7;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .ar-improw > span:last-child {
          font-size: 20px;
          font-weight: 700;
        }

        /* PRICE */
        .ar-pricecard {
          max-width: 520px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #ece2cf;
          border-radius: 24px;
          padding: 16px;
          box-shadow: 0 18px 44px -22px rgba(120, 70, 120, 0.28);
        }
        /* Task 16 — 7-day trial timeline (Blinkist pattern) */
        /* Task 21 (Itzik 2026-07-02) — the timeline is PART of the price card,
           not a pasted inset: no separate box/border/gradient, same body font
           as the card, ≥20px text. A hairline divider ties it to the price rows
           below without looking like a foreign card. */
        .ar-trial-tl {
          border: 0;
          background: transparent;
          padding: 2px 2px 16px;
          /* Zone C sits below a zone separator now (the old opening sentence was
             deleted in mockup v1), so no extra top margin (Itzik 2026-07-04). */
          margin-top: 0;
          margin-bottom: 16px;
          border-bottom: 1px solid #ece2cf;
          font-family: var(--font-heebo), "Assistant", "Heebo", system-ui, sans-serif;
        }
        .ar-trial-row {
          display: flex;
          gap: 8px;
          align-items: baseline;
          font-size: 20px;
          line-height: 1.5;
          color: #2e2622;
        }
        .ar-trial-row + .ar-trial-row {
          margin-top: 8px;
        }
        /* ✓ marker (Itzik 2026-07-02) — flex:none keeps the wrapped text from
           tucking under it; brand rose to match the bold labels. */
        .ar-trial-check {
          flex: none;
          color: #7a1f2b;
          font-weight: 800;
        }
        .ar-trial-row b {
          color: #7a1f2b;
          font-weight: 800;
        }
        .ar-trial-foot {
          margin-top: 12px;
          font-size: 20px;
          color: #5a4f46;
          font-weight: 600;
        }
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
        /* Tabs (v9): a narrow, centered segmented pill — light cream, ✓ on the
           selected tab only. */
        .ar-coach-wrap {
          text-align: center;
        }
        .ar-coach {
          /* No container pill — transparent; only the selected button carries
             the gradient. Non-selected is text-only. */
          display: inline-flex;
          gap: 4px;
          margin-bottom: 18px;
          background: transparent;
        }
        .ar-coach-opt {
          /* Task 27 (Itzik 2026-07-03): subtle hairline contour so the
             unselected option reads as a clickable tab, not floating text. */
          border: 1px solid #e5dccb;
          cursor: pointer;
          font-family: var(--font-heebo), "Assistant", "Heebo", sans-serif;
          font-weight: 700;
          font-size: 16px;
          color: #4b4640;
          padding: 9px 25px;
          border-radius: 999px;
          background: transparent;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .ar-coach-opt.sel {
          color: #fff;
          /* The gradient fill carries the selected state; drop the hairline so
             it doesn't clash with the gradient edge. */
          border-color: transparent;
          background: var(--ar-grad);
          box-shadow: 0 4px 12px -5px rgba(214, 64, 159, 0.5);
        }
        /* ✓ icon removed from the selected coaching toggle (Itzik 2026-07-04) —
           the gradient fill alone marks the selection. */
        /* Packages container — the top border carries the trial legend
           (Itzik 2026-07-04). The margin/padding-top opens room so the legend
           sits ON the border without touching the coaching tabs above it. */
        .ar-opts-wrap {
          position: relative;
          border-top: 2px solid #ece2cf;
          margin-top: 30px;
          padding-top: 30px;
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
        .ar-opt {
          display: flex;
          flex-wrap: wrap;
          /* Mobile (Itzik 2026-07-04): line 1 is radio + name + price, centered
             on one vertical line; the details row (tag / sub / חיסכון) wraps to
             its own full-width line below. */
          align-items: center;
          gap: 12px;
          width: 100%;
          background: #fcfaf7;
          border: 2px solid #ece2cf;
          border-radius: 16px;
          padding: 16px 18px;
          cursor: pointer;
          text-align: right;
          margin-bottom: 12px;
          transition: 0.15s;
          font-family: inherit;
        }
        .ar-opt:last-of-type {
          margin-bottom: 0;
        }
        .ar-opt.sel {
          border: 2px solid transparent;
          background: linear-gradient(#fff, #fff) padding-box, var(--ar-grad) border-box;
          box-shadow: 0 8px 20px -12px rgba(150, 60, 150, 0.35);
        }
        /* Radio ALWAYS on the right (RTL): order 0 = first in flow = rightmost. */
        .ar-radio {
          flex: none;
          order: 0;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid #d9cdbf;
        }
        .ar-opt.sel .ar-radio {
          border: 6px solid #d6409f;
        }
        .ar-opt-info {
          order: 1;
          /* Mobile: grow so the price is pushed to the far end of the same
             line (not wrapped below). Reset on desktop so the timer's flex:1
             owns the centre instead. */
          flex: 1;
          display: flex;
          flex-direction: column;
          text-align: right;
        }
        .ar-opt-name {
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
          font-weight: 900;
          font-size: 23px;
          line-height: 1;
          color: #2e2622;
        }
        /* Full-width row under the name+price line — holds the trial tag, the
           sub line and "חיסכון %", so each uses the whole card width and only
           wraps where it truly runs out of room (Itzik 2026-07-04). */
        .ar-opt-details {
          order: 4;
          flex-basis: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          text-align: right;
        }
        .ar-opt-note {
          font-size: 18px;
          font-weight: 500;
          color: #4b4640;
          margin-top: 6px;
          /* Mobile: may wrap. Desktop (≥760) forces one line. */
          white-space: normal;
        }
        /* "חיסכון X%" — own line below the sub, brand-gradient text (2026-07-01,
           Itzik), consistent with the pricing page. width:fit-content keeps the
           95deg gradient spanning the glyphs (not the full row) so the full
           purple→magenta→orange shows. Falls back to solid #6C5CE7. */
        .ar-opt-save {
          display: block;
          width: fit-content;
          margin-top: 6px;
          /* 22px per Itzik 2026-07-03 (was 18px). */
          font-size: 22px;
          font-weight: 800;
          line-height: 1.2;
          color: #6c5ce7;
          background: linear-gradient(95deg, #6c5ce7 0%, #d6409f 52%, #f79154 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        /* Timer slot — mobile: full-width centered line below (order 5). */
        .ar-opt-timer {
          order: 5;
          flex-basis: 100%;
          display: flex;
          justify-content: center;
          margin-top: 10px;
        }
        .ar-opt-price {
          order: 3;
          flex: none;
          margin-inline-start: auto;
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          font-family: var(--font-heebo), "Assistant", "Heebo", system-ui,
            sans-serif;
        }
        /* Selected package: big gradient price (sans). */
        .ar-price-num {
          font-size: 40px;
          font-weight: 800;
          line-height: 1;
          background: var(--ar-grad);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .ar-price-cur {
          font-size: 24px;
          font-weight: 800;
          line-height: 1;
          background: var(--ar-grad);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        /* Non-selected packages: plain serif ink price. */
        .ar-opt-price.plain .ar-price-num {
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
          font-size: 30px;
          background: none;
          -webkit-text-fill-color: #2e2622;
          color: #2e2622;
        }
        .ar-opt-price.plain .ar-price-cur {
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
          font-size: 18px;
          background: none;
          -webkit-text-fill-color: #2e2622;
          color: #2e2622;
        }
        /* Zone B — "מה כלול" header + 2-col grid (mockup v1, Itzik 2026-07-04),
           site tokens/fonts; magenta ✓ from the brand palette. */
        .ar-incl-head {
          text-align: center;
          margin-bottom: 14px;
        }
        .ar-incl-title {
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
          font-weight: 700;
          font-size: 24px;
          color: #2e2622;
        }
        .ar-incl-sub {
          margin-top: 4px;
          /* 20px per Itzik 2026-07-04 (was 16px). */
          font-size: 20px;
          font-weight: 600;
          color: #5a4f46;
        }
        /* One horizontal row of feature items — never two rows (Itzik
           2026-07-04), mobile AND desktop. Each item is a compact centered
           column (✓ above the text) so all of them share the row width; the
           text wraps inside its own column when it must. */
        .ar-incl {
          display: flex;
          flex-wrap: nowrap;
          gap: 8px;
          justify-content: space-between;
        }
        .ar-it {
          flex: 1 1 0;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          font-size: 15px;
          font-weight: 600;
          color: #2e2622;
          text-align: center;
          line-height: 1.25;
        }
        .ar-it-check {
          flex: none;
          color: #d6409f;
          font-weight: 800;
          font-size: 17px;
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
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
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
          gap: 8px;
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
        .ar-cta-arrow {
          width: 18px;
          height: 18px;
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
          font-size: 16px;
          color: #7b6b5e;
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
        /* Zone divider between the three areas (choice / included / how it
           works). Hairline in the card-border tone. */
        .ar-zone-sep {
          border: 0;
          border-top: 1px solid #ece2cf;
          margin: 26px 0;
        }

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

        /* ============ DESKTOP (≥760) ============ */
        @media (min-width: 760px) {
          .ar-hero {
            display: block;
            padding: 0;
            background: #241d1a;
            background-image: none;
            min-height: 420px;
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
            background: url("/images/hero-assess.webp") center right / cover
              no-repeat;
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
            padding: 54px 40px 60px;
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
            margin-bottom: 22px;
          }
          .ar-bars {
            max-width: 620px;
            height: 170px;
            width: 100%;
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
          .ar-photo {
            width: 190px;
            height: 190px;
          }
          .ar-fbtext {
            font-size: 28px;
          }
          .ar-imp {
            display: flex;
            flex-flow: row wrap;
            justify-content: center;
            gap: 16px 18px;
            max-width: 820px;
            margin-inline: auto;
          }
          .ar-improw {
            width: auto;
            padding: 20px 26px;
          }
          .ar-improw:nth-child(2),
          .ar-improw:nth-child(4),
          .ar-improw:nth-child(6) {
            transform: translateY(16px);
          }
          .ar-pricecard {
            /* wider (v9) so the one-line sub + centered timer + price fit */
            max-width: 640px;
          }
          /* Desktop: line 1 = radio + name + timer + price (timer's flex:1 owns
             the centre); the details row (tag / sub / חיסכון) wraps to its own
             full-width line below, same as mobile (Itzik 2026-07-04). */
          .ar-opt {
            flex-wrap: wrap;
            align-items: center;
          }
          .ar-opt-info {
            flex: 0 0 auto;
          }
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
