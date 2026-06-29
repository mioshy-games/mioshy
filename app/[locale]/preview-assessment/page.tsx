// TEMPORARY QA preview for the AnalysisSummary redesign (Phase 4 review on a
// Vercel Preview deployment). Renders the results screen with a RICH mock
// analysis (ai_hero incl. narrative + category_scores) and REAL
// journeyCadences/promo from the DB when reachable, with a representative
// fallback so the page always renders on preview. DELETE before merging to game.
import { setRequestLocale } from "next-intl/server";

import { AnalysisSummary, type JourneyPromoSummary } from "@/components/journey/AnalysisSummary";
import type { Analysis, Locale } from "@/lib/journey/types";
import { listAllPrices } from "@/lib/billing/pricing-queries";
import type { CadenceOption } from "@/lib/billing/pricing-validations";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { findActivePromo, applyDiscount, promoAppliesToCadence } from "@/lib/billing/promos";

export const dynamic = "force-dynamic";

const MOCK_NARRATIVE_HE =
  "כתבת שהתשוקה דעכה ושלפעמים את מרגישה שהוא כבר לא פונה אלייך, וזה עולה גם מהתשובות. הציונים מראים שהחברות והמשפחתיות ביניכם דווקא חזקות, וזה הבסיס שממנו אפשר להצית מחדש את הקרבה. אתם קרובים יותר ממה שזה מרגיש עכשיו.";
const MOCK_NARRATIVE_EN =
  "You wrote that desire has faded and that sometimes you feel he no longer turns toward you, and your answers show that too. Your scores show the friendship and family side between you are actually strong, and that's the base to reignite closeness from. You're closer than it feels right now.";

function buildMockAnalysis(): Analysis {
  const mock = {
    friendship_score: 43,
    conflict_health: 52,
    passion_risk: 69,
    top_gap: "passion_play",
    four_horsemen_flag: false,
    primary_love_language: "physical_touch",
    summary: {
      narrative_he: MOCK_NARRATIVE_HE,
      narrative_en: MOCK_NARRATIVE_EN,
      top_priority: "intimacy",
      category_scores: {
        communication: 58,
        intimacy: 31,
        emotional_connection: 39,
        friendship: 43,
        family: 64,
        lowest_key: "intimacy",
        insufficient_keys: [],
      },
      ai_hero: {
        hero_he:
          "דנה, מהר מאוד תחזירו את הקרבה והתשוקה, תשברו את השגרה, ושוב תרצו אחד את השני.",
        hero_en:
          "Dana, very quickly you'll bring closeness and desire back, break the routine, and want each other again.",
        recommendations_he: ["תחזירו את הפרפרים בבטן.", "תתאהבו מחדש.", "האינטימיות תתחדש."],
        recommendations_en: ["The butterflies come back.", "Fall in love again.", "Intimacy renews."],
        narrative_he: MOCK_NARRATIVE_HE,
        narrative_en: MOCK_NARRATIVE_EN,
        expert_mentioned: false,
        pain_signal: "reflection",
        model: "claude-sonnet-4-6",
        generated_at: "2026-06-29T00:00:00.000Z",
        latency_ms: 0,
      },
    },
  };
  return mock as unknown as Analysis;
}

// Representative fallback so the preview always renders prices even if the DB
// is unreachable on the preview environment.
const FALLBACK_CADENCES: CadenceOption[] = [
  { cadence: "monthly", price_ils: 222, price_usd: 69, enabled: true, is_default: true },
  { cadence: "quarterly", price_ils: 597, price_usd: 186, enabled: true, is_default: false },
  { cadence: "yearly", price_ils: 1970, price_usd: 599, enabled: true, is_default: false },
];

export default async function PreviewAssessmentPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const locale = (params.locale === "en" ? "en" : "he") as Locale;

  // REAL cadences/prices from the DB when reachable; fallback otherwise.
  let journeyCadences: CadenceOption[] = [];
  try {
    journeyCadences = (await listAllPrices())
      .filter((p) => p.product === "journey")
      .map(({ cadence, price_ils, price_usd, enabled, is_default }) => ({
        cadence,
        price_ils,
        price_usd,
        enabled,
        is_default,
      }));
  } catch {
    /* fall through to fallback below */
  }
  if (journeyCadences.length === 0) journeyCadences = FALLBACK_CADENCES;

  // REAL active promo (same logic as the live page). If none/unavailable, build
  // a representative one on the monthly cadence so the promo path is exercised.
  let activePromo: JourneyPromoSummary | null = null;
  try {
    const promoClient = createServiceRoleClient();
    if (promoClient) {
      const { promo } = await findActivePromo(promoClient, { product: "journey" });
      if (promo) {
        const firstChargeByCadence: JourneyPromoSummary["firstChargeByCadence"] = {};
        const originalByCadence: JourneyPromoSummary["originalByCadence"] = {};
        for (const c of journeyCadences) {
          if (!c.enabled) continue;
          if (!promoAppliesToCadence(promo, c.cadence)) continue;
          const ils = applyDiscount({ amount: c.price_ils, currency: "ILS", promo });
          const usd = applyDiscount({ amount: c.price_usd, currency: "USD", promo });
          if (ils.promoId || usd.promoId) {
            firstChargeByCadence[c.cadence] = { ils: ils.discountedAmount, usd: usd.discountedAmount };
            originalByCadence[c.cadence] = { ils: ils.originalAmount, usd: usd.originalAmount };
          }
        }
        if (Object.keys(firstChargeByCadence).length > 0) {
          activePromo = {
            name: promo.name,
            displayText: promo.display_text,
            firstChargeByCadence,
            originalByCadence,
          };
        }
      }
    }
  } catch {
    /* no-op for QA */
  }
  if (!activePromo) {
    const monthly = journeyCadences.find((c) => c.cadence === "monthly" && c.enabled);
    if (monthly) {
      activePromo = {
        name: "QA",
        displayText: "מבצע השקה",
        firstChargeByCadence: { monthly: { ils: 57, usd: 19 } },
        originalByCadence: { monthly: { ils: monthly.price_ils, usd: monthly.price_usd } },
      };
    }
  }

  return (
    <AnalysisSummary
      analysis={buildMockAnalysis()}
      locale={locale}
      journeySubscribed={false}
      journeyCadences={journeyCadences}
      activePromo={activePromo}
    />
  );
}
