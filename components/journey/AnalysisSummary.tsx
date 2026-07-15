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
  personalWindowDisplay = "text",
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

  // Included panel for the SELECTED plan — exact structure per the approved
  // pricing card: a gradient "חיסכון X%" line under the name, then a divider,
  // muted lead, and a gradient-dot list. `saveText` is the plan's savings string
  // (null → no savings line). The expert item is gated on the coaching toggle.
  return (
    <div className="ar-root" dir={isHe ? "rtl" : "ltr"}>
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
                                  "linear-gradient(rgba(122,31,43,.05),rgba(122,31,43,.05)) padding-box, var(--ar-grad) border-box",
                              }
                        }
                      />
                      <span className="ar-lbl">{isHe ? BAR_LABEL[key].he : BAR_LABEL[key].en}</span>
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
            {/* Stage 1: show ONLY the intimacy card (CAT_ORDER[0]) — the short
                assessment surfaces one domain; the rest come with the full one.
                No "most important" badge (single card). */}
            <div className="ar-cats">
              {(() => {
                const key = CAT_ORDER[0];
                const score = categoryScores[key];
                const fb = CATEGORY_FEEDBACK[key];
                const insufficient = insufficientKeys.includes(key);
                const weak = score < CATEGORY_WEAK_BELOW;
                const text = insufficient
                  ? isHe
                    ? "כדי לתת לכם משוב מדויק בתחום הזה צריך עוד כמה תשובות, וזה מה שהאבחון המלא עושה."
                    : "We need a few more answers to give you accurate feedback here, that's what the full assessment does."
                  : isHe
                    ? weak ? fb.weak_he : fb.strong_he
                    : weak ? fb.weak_en : fb.strong_en;
                return (
                  <div className="ar-catcard" key={key}>
                    <div className="ar-scorerow">
                      <span className="ar-snum font-heading">{insufficient ? "–" : score}</span>
                      <span className="ar-sof">/ 100</span>
                      <span className="ar-sexp">
                        {insufficient
                          ? isHe ? "דרוש אבחון מלא" : "full assessment needed"
                          : levelDesc(score, false, isHe)}
                      </span>
                    </div>
                    <div className="ar-cname">{isHe ? fb.he : fb.en}</div>
                    <p className="ar-ctxt">{text}</p>
                  </div>
                );
              })()}
            </div>
            {/* Link to the plans (Stage 1). Teaser paragraph + arrow removed. */}
            <div className="ar-cats-more">
              <a href="#ar-price" className="ar-cats-more-link" onClick={scrollToPrice}>
                {isHe ? "לתוצאות מדוייקות ולאבחון המלא" : "For accurate results and the full assessment"}
              </a>
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
            <h2 className="ar-sh font-heading">
              {rc(cmsPriceTitle, "איזו חבילה מתאימה לכם?", "Which plan fits you?")}
            </h2>
            {/* Personal-window countdown (display='clock') moved DOWN to sit
                beside the selected price/promo (Itzik 2026-07-15) — the urgency
                belongs next to the number it applies to, not at the card top.
                Now rendered inside the selected cadence card, below price+savings. */}
            <div className="ar-pricecard">
              {/* Stage-1 coaching add-on — with/without choice. Only rendered
                  once a coaching cost is configured (else the bundle == content
                  and a 0₪ choice would only confuse). */}
              {hasCoachingCost ? (
                <div className="ar-addon">
                  {/* Coaching add-on as a single checkbox (solid #D6409F), not
                      tabs. Toggles the shared `coaching` state → the cadence
                      cards below fold the add-on into their totals (amtOf), the
                      trial/checkout re-probe with {plan, coaching}. The "+X" is
                      the SELECTED cadence's coaching_cost (per-cadence, dynamic
                      from the admin — no hardcode). */}
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
                    {selectedOption ? (
                      <div className="ar-addbig">
                        +{fmt(coachingCostOf(selectedOption))} <span className="ar-cur">{sym}</span>{" "}
                        <span className="ar-mo">{periodLabel(selectedCadence)}</span>
                      </div>
                    ) : null}
                  </div>
                  {coaching ? (
                    <div className="ar-cexpert">
                      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
                        <defs>
                          <linearGradient id="arCoachGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="#6C5CE7" />
                            <stop offset=".55" stopColor="#D6409F" />
                            <stop offset="1" stopColor="#F79154" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="ar-cexpert-lead">
                        {isHe ? "המומחה זמין לשני בני הזוג" : "The expert is available to both partners"}
                      </div>
                      <ul className="ar-points">
                        <li>
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
                          <span>{isHe ? "זמין לכם בצ'אט לכל שאלה" : "Available in chat for any question"}</span>
                        </li>
                        <li>
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.9 4.9l2.8 2.8" /><path d="M16.3 16.3l2.8 2.8" /><circle cx="12" cy="12" r="4" /></svg>
                          <span>{isHe ? "עוקב אחריכם ומנהל לכם את התוכן השבועי" : "Follows you and curates your weekly content"}</span>
                        </li>
                        <li>
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
                          <span>{isHe ? "מבצע מעקב שבועי וחודשי" : "Weekly and monthly tracking"}</span>
                        </li>
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

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
                // "חיסכון X%" line — shown under the name inside the selected
                // card's included block (psave). null → no savings line.
                const saveText =
                  promoSavePct != null
                    ? `${isHe ? "חיסכון" : "Save"} ${promoSavePct}%${
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
                    <div className="ar-trial-strip">{trial.cardTag}</div>
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
                      {hasPromo ? (
                        <span className="ar-opt-note">
                          {`${firstPeriodLabel(c.cadence, isHe)}${isHe ? ", אח״כ " : ", then "}${priceStr(origAmt)}`}
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
                      <div className="incl-div" aria-hidden />
                      <div className="incl-lead">
                        {isHe
                          ? "המנוי כולל גישה מלאה לשני בני הזוג"
                          : "The subscription includes full access for both partners"}
                      </div>
                      <ul>
                        {[
                          rc(cmsIncluded1, "פרק חדש כל שבוע", "A new chapter every week"),
                          ...(coaching
                            ? [rc(cmsIncluded2, "מומחה זוגיות פרטי בצ'אט", "A private relationship expert in chat")]
                            : []),
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
                {rc(
                  cmsStopNote,
                  "תזינו פרטי אשראי, ובעוד 5 ימים נזכיר לכם לפני החיוב.",
                  "Enter your card details; in 5 days we'll remind you before the charge.",
                )}
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
        .ar-sh {
          font-size: 25px;
          margin-bottom: 4px;
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
        /* Coaching add-on (v2, 2026-07): a single checkbox in solid brand pink
           (D6409F, NOT the gradient) plus a per-cadence add-on price and, when
           checked, the expert value points. Replaces the with/without segmented
           toggle. Money plumbing unchanged (drives the shared coaching state). */
        .ar-addon {
          margin-bottom: 22px;
        }
        .ar-addon-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 11px;
        }
        .ar-addbtn {
          display: flex;
          align-items: center;
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
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
          font-weight: 900;
          font-size: 26px;
          line-height: 1.1;
          white-space: nowrap;
          color: #2e2622;
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
        .ar-cexpert-lead {
          font-size: 13px;
          color: #8a7a6b;
          font-weight: 600;
          margin-bottom: 12px;
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
          align-items: flex-start;
          gap: 10px;
          font-size: 14.5px;
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
          gap: 11px;
          width: 100%;
          background: none;
          border: 0;
          padding: 16px 17px 0;
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
        /* Mockup v2 — "7 ימי ניסיון חינם" as a big (26px) gradient headline, not a
           filled bar, so it reads as the card's opening line. */
        .ar-trial-strip {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 2px 0 14px;
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
          font-weight: 900;
          font-size: 26px;
          line-height: 1.15;
          background: linear-gradient(95deg, #6c5ce7, #d6409f 52%, #f79154);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .ar-opt-group.sel .ar-opt {
          border: 0;
          background: transparent;
          border-radius: 0;
          box-shadow: none;
        }
        /* Radio: hollow ring; selected = gradient fill + white centre dot. */
        .ar-radio {
          flex: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid #d8c8b3;
          display: grid;
          place-items: center;
          /* Pin to the name line (top) so radio + name + price sit on one row
             even when the promo note wraps a second line below the name. */
          align-self: flex-start;
          margin-top: 3px;
        }
        .ar-opt.sel .ar-radio {
          border-color: transparent;
          background: var(--ar-grad);
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
        /* Price — ink number + muted currency, no gradient, no period label. */
        .ar-opt-price {
          margin-inline-start: auto;
          flex: none;
          /* Align the price with the plan name (top), not the taller info column. */
          align-self: flex-start;
          margin-top: 1px;
          display: inline-flex;
          align-items: baseline;
          /* A real space before the ₪ (Stage 1). */
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
          font-size: 15px;
          font-weight: 800;
          line-height: 1;
          color: #8a7a6b;
          background: none;
          -webkit-text-fill-color: #8a7a6b;
        }
        /* Mockup v2 — the SELECTED card is the focal package: 46px price + serif,
           so it matches the reference. Other (revealed) cadences stay compact. */
        .ar-opt-group.sel .ar-opt-price {
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
          font-size: 46px;
        }
        .ar-opt-group.sel .ar-price-num {
          font-family: var(--font-frank-ruhl), "Frank Ruhl Libre", serif;
          font-size: 46px;
        }
        .ar-opt-group.sel .ar-price-cur {
          font-size: 19px;
        }
        /* Included list under the SELECTED plan (pricing-redesign-approved.html):
           lead line + gradient-dot list aligned under the plan name (padding-
           start clears the radio). No "מה כלול" heading, no top divider. */
        /* Selected-card included block — exact approved spec. */
        .psave {
          padding: 5px 50px 0 17px;
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
        /* Countdown sits right below the price/savings inside the selected card. */
        .ar-inline-timer {
          padding: 12px 17px 2px;
        }
        .incl {
          padding: 14px 50px 16px 17px;
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
          margin: 4px auto 0;
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
          font-size: 20px;
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
          .ar-pricecard {
            /* wider (v9) so the one-line sub + centered timer + price fit */
            max-width: 640px;
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
