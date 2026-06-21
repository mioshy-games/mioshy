"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { metaTrackCustom } from "@/lib/analytics/meta-pixel";
import type { AiHeroBlock, DimensionScore, Locale } from "@/lib/assessments/types";
import { getResultContent } from "@/lib/assessments/result-content";
import { PROGRAM_VALUE } from "@/lib/assessments/result-content/program";
import type { CadenceOption } from "@/lib/billing/pricing-validations";
import { CmsText } from "@/components/cms/CmsText";

export interface AssessmentResult {
  assessment_id: string;
  dimension_scores: DimensionScore[];
  weakest_dimensions: string[];
  summary: { ai_hero: AiHeroBlock | null };
}

interface Props {
  locale: Locale;
  assessmentId: string;
  assessmentTitleHe: string;
  assessmentTitleEn: string;
  result: AssessmentResult | null;
  subscriptionActive?: boolean;
  journeyCadences?: CadenceOption[];
}

const GOLD = "#FCCA65";

// Precise weeks per cadence (internal math; display rounds to whole units).
const WEEKS_PER_CADENCE: Record<string, number> = {
  weekly: 1,
  monthly: 4.345,
  quarterly: 13.04,
  yearly: 52.14,
};
const CADENCE_ORDER: Record<string, number> = {
  weekly: 0,
  monthly: 1,
  quarterly: 2,
  yearly: 3,
};

export function AssessmentSummary({
  locale,
  assessmentId,
  assessmentTitleHe,
  assessmentTitleEn,
  result,
  subscriptionActive = false,
  journeyCadences = [],
}: Props) {
  const isHe = locale === "he";
  const t = (he: string, en: string) => (isHe ? he : en);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Meta CompleteFullAssessment (custom, browser) — MEASUREMENT only (not a
  // campaign optimization event). Fires once when the long (21-question)
  // assessment results render. Neutral assessment_type (the assessment slug/id).
  const fullAssessmentFiredRef = useRef(false);
  useEffect(() => {
    if (fullAssessmentFiredRef.current) return;
    fullAssessmentFiredRef.current = true;
    metaTrackCustom("CompleteFullAssessment", { assessment_type: assessmentId });
  }, [assessmentId]);

  // C2.4 cadence picker: enabled cadences are the options; the weekly row
  // (display unit) is the savings baseline. Picker shows only when ≥2
  // cadences are enabled — with one (current state: monthly only) we just
  // show the transparency line. Hooks must run before the early return.
  const enabledCadences = journeyCadences
    .filter((c) => c.enabled)
    .sort((a, b) => CADENCE_ORDER[a.cadence] - CADENCE_ORDER[b.cadence]);
  const defaultCadence =
    (enabledCadences.find((c) => c.is_default) ?? enabledCadences[0])?.cadence ??
    "monthly";
  const [selectedCadence, setSelectedCadence] = useState<string>(defaultCadence);

  if (!result) {
    return (
      <div dir={isHe ? "rtl" : "ltr"} className="mx-auto max-w-2xl p-10 text-center text-white/80">
        {t("מכינים את התוצאות שלכם…", "Preparing your results…")}
      </div>
    );
  }

  const dims = result.dimension_scores;
  const lowestKey = result.weakest_dimensions[0] ?? dims.reduce((lo, d) => (d.score < lo.score ? d : lo), dims[0])?.key;
  const lowest = dims.find((d) => d.key === lowestKey);
  const aiHero = result.summary.ai_hero;
  const heroText = aiHero ? (isHe ? aiHero.hero_he : aiHero.hero_en) : null;
  const heroRecs = aiHero ? (isHe ? aiHero.recommendations_he : aiHero.recommendations_en) : [];

  // Per-assessment tailored copy + content-grounded feedback.
  const rc = getResultContent(assessmentId);
  const cp = rc?.copy;
  // Shared program value (5 coaching areas + games + intimacy cross-sell).
  const pv = PROGRAM_VALUE;

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  // ── Cadence picker derived values (C2.4) ──────────────────────────────
  const sym = isHe ? "₪" : "$";
  const fmt = (n: number) => n.toLocaleString(isHe ? "he-IL" : "en-US");
  const amtOf = (c: CadenceOption) => (isHe ? c.price_ils : c.price_usd);
  const weeklyRow = journeyCadences.find((c) => c.cadence === "weekly");
  const baselineWeekly = weeklyRow ? amtOf(weeklyRow) : null;
  const periodLabel = (cadence: string) =>
    cadence === "yearly"
      ? t("/שנה", "/yr")
      : cadence === "quarterly"
        ? t("/רבעון", "/quarter")
        : cadence === "weekly"
          ? t("/שבוע", "/wk")
          : t("/חודש", "/mo");
  const effWeeklyOf = (c: CadenceOption) =>
    Math.round(amtOf(c) / (WEEKS_PER_CADENCE[c.cadence] ?? 1));
  const savingsOf = (c: CadenceOption) =>
    baselineWeekly && baselineWeekly > 0
      ? Math.round(
          ((baselineWeekly - amtOf(c) / (WEEKS_PER_CADENCE[c.cadence] ?? 1)) /
            baselineWeekly) *
            100,
        )
      : null;
  const selectedOption =
    enabledCadences.find((c) => c.cadence === selectedCadence) ??
    enabledCadences[0] ??
    null;
  const showPicker = enabledCadences.length >= 2;
  // plan to send: the selected cadence when we have options, else let the
  // server resolve (it falls back to the product default).
  const checkoutPlan = selectedOption ? selectedOption.cadence : "weekly";

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: checkoutPlan,
          product: "journey",
          source: `assessment_${assessmentId}`,
          language: locale,
          is_israeli: locale === "he",
          return_path: `/${locale}/my`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || data?.code === "UNAUTHORIZED") {
        const raw = typeof window !== "undefined" ? window.location.pathname : `/assessments/${assessmentId}`;
        const back = encodeURIComponent(raw.replace(/^\/(he|en)(?=\/|$)/, "") || `/assessments/${assessmentId}`);
        window.location.href = `/${locale}/auth/signup?next=${back}`;
        return;
      }
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }
      setError(t("משהו השתבש. נסו שוב.", "Something went wrong. Try again."));
      setBusy(false);
    } catch {
      setError(t("בעיית רשת. נסו שוב.", "Network issue. Try again."));
      setBusy(false);
    }
  };

  return (
    <motion.div
      dir={isHe ? "rtl" : "ltr"}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 pb-32 lg:pb-10"
    >
      {/* ── Dimension bar chart ────────────────────────────────────────── */}
      <section className="px-2 py-4">
        <span className="text-start text-[14px] font-semibold uppercase tracking-wider leading-normal" style={{ color: GOLD }}>
          {t("האבחון שלכם", "Your assessment")}
        </span>
        <h2 className="text-balance text-start font-heading text-[26px] font-extrabold leading-tight text-white sm:text-[30px]">
          {isHe ? assessmentTitleHe : assessmentTitleEn}
        </h2>
        <p className="mt-2 text-start text-[20px] leading-snug text-white/60">
          {t(
            "ציון 0-100 לכל ממד, גבוה = יסוד חזק יותר. הציון נגזר ישירות מהתשובות שלכם.",
            "0-100 per dimension, higher = stronger. Scores are derived directly from your answers.",
          )}
        </p>

        <div className="mt-6 grid items-end gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${dims.length}, minmax(0,1fr))` }}>
          {dims.map((d) => {
            const isLowest = d.key === lowestKey;
            const heightPct = Math.max(14, Math.min(100, d.score));
            return (
              <div key={d.key} className="flex flex-col items-center">
                <div
                  className="relative w-full overflow-hidden"
                  style={{ height: 160, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 transition-all"
                    style={{
                      height: `${heightPct}%`,
                      background: GOLD,
                      boxShadow: isLowest ? "0 0 28px rgba(252,202,101,0.55)" : "none",
                    }}
                  />
                </div>
                <span className={`mt-2 text-center text-[20px] font-extrabold tabular-nums leading-none sm:text-[22px] ${isLowest ? "" : "text-white"}`} style={isLowest ? { color: GOLD } : undefined}>
                  {d.score}
                </span>
                <span className={`mt-1.5 text-balance text-center text-[12px] font-semibold leading-tight sm:text-[13px] ${isLowest ? "" : "text-white/75"}`} style={isLowest ? { color: GOLD } : undefined}>
                  {isHe ? d.he : d.en}
                </span>
              </div>
            );
          })}
        </div>

        {lowest ? (
          <div className="mt-5 flex flex-col items-center gap-3 text-center">
            <span className="text-[20px] font-extrabold" style={{ color: GOLD }}>
              {isHe ? `ההמלצה שלנו: להתחיל ב${lowest.he}` : `Our recommendation: start with ${lowest.en}`}
            </span>
            {/* Benefit hero — centered, tight under the recommendation, ties
                to the Mioshy ליווי (Itzik 2026-06-07). */}
            <p className="mx-auto max-w-2xl text-balance text-center font-heading text-[28px] font-extrabold leading-tight text-white sm:text-[34px]">
              {heroText
                ? heroText
                : cp
                  ? (isHe ? cp.fallbackHero_he : cp.fallbackHero_en)
                  : isHe
                    ? "בליווי עם מיאושי תתחזקו במקום שהכי חשוב לכם, והקרבה ביניכם תעמיק."
                    : "With Mioshy's coaching you'll grow where it matters most, and your closeness will deepen."}
            </p>
          </div>
        ) : null}
      </section>

      {/* ── Personal feedback on the answers (grounded in content) ─────── */}
      {rc && cp ? (
        <section className="px-2">
          <span className="text-start text-[14px] font-semibold uppercase tracking-wider leading-normal" style={{ color: GOLD }}>
            {isHe ? cp.feedbackLabel_he : cp.feedbackLabel_en}
          </span>
          <h2 className="mt-1 text-balance text-start font-heading text-[24px] font-extrabold leading-tight text-white sm:text-[28px]">
            {isHe ? cp.feedbackTitle_he : cp.feedbackTitle_en}
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {dims.map((d) => {
              const fb = rc.feedback[d.key];
              if (!fb) return null;
              const weak = d.score < rc.weakBelow;
              const text = isHe
                ? weak ? fb.weak_he : fb.strong_he
                : weak ? fb.weak_en : fb.strong_en;
              const isLowest = d.key === lowestKey;
              return (
                <li
                  key={d.key}
                  className="rounded-2xl border p-4 sm:p-5"
                  style={{
                    borderColor: isLowest ? "rgba(252,202,101,0.55)" : "rgba(255,255,255,0.12)",
                    background: isLowest ? "rgba(252,202,101,0.10)" : "rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* Prominent score block (not an inline number). */}
                    <div
                      className="flex shrink-0 flex-col items-center justify-center rounded-xl px-3 py-2"
                      style={{
                        minWidth: 78,
                        background: isLowest ? "rgba(252,202,101,0.16)" : "rgba(255,255,255,0.06)",
                        border: `1px solid ${isLowest ? "rgba(252,202,101,0.5)" : "rgba(255,255,255,0.12)"}`,
                      }}
                    >
                      <span
                        className="font-heading text-[40px] font-extrabold leading-none tabular-nums"
                        style={{ color: isLowest ? GOLD : "#fff" }}
                      >
                        {d.score}
                      </span>
                      <span className="mt-1 text-[12px] font-semibold text-white">{isHe ? "מתוך 100" : "of 100"}</span>
                    </div>
                    {/* Name + feedback. */}
                    <div className="flex-1">
                      <span className="text-[22px] font-bold leading-tight text-white">{isHe ? d.he : d.en}</span>
                      {isLowest ? (
                        <span
                          className="ms-2 inline-block rounded-full px-2.5 py-0.5 text-[13px] font-bold"
                          style={{ background: GOLD, color: "#1a1018" }}
                        >
                          {isHe ? "נתחיל מכאן" : "start here"}
                        </span>
                      ) : null}
                      <p className="mt-2 text-pretty text-start text-[20px] leading-[1.5] text-white/90">
                        {text}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ── What you'll get ─────────────────────────────────────────────── */}
      {(heroRecs.length > 0) ? (
        <section>
          <h2 className="text-balance text-start font-heading text-[24px] font-extrabold text-white sm:text-[28px]">
            {t("מה תקבלו בליווי", "What you'll get in the program")}
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {heroRecs.map((rec, i) => (
              <li key={i} className="flex items-start gap-3 px-2 py-2">
                <span className="mt-2.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: GOLD }} aria-hidden />
                <span className="flex-1 text-pretty text-start text-[22px] leading-[1.4] text-white/95 sm:text-[20px]">
                  {rec}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── What changes (tailored gains) ─────────────────────────────── */}
      {rc && cp ? (
        <section className="px-2">
          <h2 className="text-balance text-start font-heading text-[24px] font-extrabold text-white sm:text-[28px]">
            {isHe ? cp.gainsTitle_he : cp.gainsTitle_en}
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {(isHe ? cp.gains_he : cp.gains_en).map((g, i) => (
              <li key={i} className="flex items-start gap-3 text-[20px] leading-[1.45] text-white/90">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" style={{ color: GOLD }} aria-hidden />
                <span className="flex-1 text-pretty text-start">{g}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── 5 coaching areas (generic, mirrors Journey) ────────────────── */}
      <section className="px-2">
        <span className="text-start text-[14px] font-semibold uppercase tracking-wider leading-normal" style={{ color: GOLD }}>
          {isHe ? pv.categoriesLabel_he : pv.categoriesLabel_en}
        </span>
        <h2 className="mt-1 text-balance text-start font-heading text-[24px] font-extrabold leading-tight text-white sm:text-[28px]">
          {isHe ? pv.categoriesTitle_he : pv.categoriesTitle_en}
        </h2>
        <ul className="mt-4 flex flex-col">
          {pv.categories.map((c, i) => (
            <li
              key={i}
              className={`px-2 py-3.5 ${i > 0 ? "border-t border-white/10" : ""}`}
            >
              <div className="flex items-baseline gap-2.5">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: GOLD }} aria-hidden />
                <span className="text-[20px] font-bold leading-tight text-white">{isHe ? c.he : c.en}</span>
              </div>
              <p className="mt-1 ps-[18px] text-[18px] leading-snug text-white/65">{isHe ? c.desc_he : c.desc_en}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-pretty text-start text-[20px] font-semibold leading-[1.5]" style={{ color: GOLD }}>
          {isHe ? pv.categoriesNote_he : pv.categoriesNote_en}
        </p>
      </section>

      {/* ── World of Mioshy cross-sell: games + intimacy collection ─────── */}
      <section className="px-2">
        <span className="text-start text-[14px] font-semibold uppercase tracking-wider leading-normal" style={{ color: GOLD }}>
          {isHe ? pv.worldLabel_he : pv.worldLabel_en}
        </span>
        <div className="mt-4 flex flex-col">
          <div className="px-2 py-3.5">
            <h3 className="text-[22px] font-bold text-white">{isHe ? pv.gamesTitle_he : pv.gamesTitle_en}</h3>
            <p className="mt-1.5 text-[20px] leading-[1.5] text-white/75">{isHe ? pv.gamesBody_he : pv.gamesBody_en}</p>
          </div>
          <div className="px-2 py-3.5 border-t border-white/10">
            <h3 className="text-[22px] font-bold text-white">{isHe ? pv.sexTitle_he : pv.sexTitle_en}</h3>
            <p className="mt-1.5 text-[20px] leading-[1.5] text-white/75">{isHe ? pv.sexBody_he : pv.sexBody_en}</p>
          </div>
        </div>
      </section>

      {/* ── Expert (tailored) ─────────────────────────────────────────── */}
      {rc && cp ? (
        <section className="px-2">
          <h2 className="text-balance text-start font-heading text-[22px] font-extrabold leading-tight text-white sm:text-[26px]">
            {isHe ? cp.expertTitle_he : cp.expertTitle_en}
          </h2>
          <p className="mt-2 text-pretty text-start text-[20px] leading-[1.6] text-white/85">
            {isHe ? cp.expertBody_he : cp.expertBody_en}
          </p>
        </section>
      ) : null}

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      {subscriptionActive ? (
        <section className="flex flex-col items-center gap-3 px-2 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, #FCCA65 0%, #B88F32 100%)" }}>
            <CheckCircle2 className="h-7 w-7 text-[#FAF6F7]" />
          </div>
          <h2 className="font-heading text-[26px] font-extrabold text-white">
            {t("אתם כבר בתוכנית הליווי", "You're already in the program")}
          </h2>
          <a
            href={`/${locale}/my`}
            className="mt-2 inline-flex min-h-[52px] items-center justify-center rounded-full px-7 text-[15px] font-semibold text-black transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #FCCA65 0%, #B88F32 100%)" }}
          >
            {t("לאזור האישי", "Go to my account")}
          </a>
        </section>
      ) : (
        <section className="px-2 py-4 sm:py-6">
          <span className="text-start text-[14px] font-semibold uppercase tracking-wider leading-normal" style={{ color: GOLD }}>
            {t("הצעד הבא", "Next step")}
          </span>
          <h2 className="mt-3 text-balance text-start font-heading text-[26px] font-extrabold leading-snug text-white sm:text-[30px]">
            {cp ? (isHe ? cp.offerTitle_he : cp.offerTitle_en) : t("תוכנית הליווי האישית של מיאושי", "Mioshy's personal coaching program")}
          </h2>
          <p className="mt-2 text-pretty text-start text-[20px] font-semibold text-[#FAF6F7]/85">
            {cp
              ? (isHe ? cp.offerSub_he : cp.offerSub_en)
              : t(
                  "פרק אישי בכל שבוע, מומחה זמין בצ'אט, והכל מותאם בדיוק לתוצאות שלכם.",
                  "A personal chapter each week, an expert available in chat, all tailored to your results.",
                )}
          </p>

          {/* Price line (Itzik 2026-06-07: was missing). */}
          {cp ? (
            <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[16px] text-white line-through">
                {isHe ? cp.priceOriginal_he : cp.priceOriginal_en}
              </span>
              <span className="font-heading text-[40px] font-extrabold leading-none text-white">
                {isHe ? cp.priceAmount_he : cp.priceAmount_en}
              </span>
              <span className="text-[14px] text-white/70">
                {isHe ? cp.pricePeriod_he : cp.pricePeriod_en}
              </span>
              <span className="text-[14px] text-white/55">
                · {isHe ? cp.reassurance_he : cp.reassurance_en}
              </span>
            </div>
          ) : null}

          {/* C2.4: billed transparency line — the price above stays weekly,
              this notes the actual charge for the selected cadence. */}
          {selectedOption ? (
            <p className="mt-1 text-start text-[13px] text-white/55">
              {t("מחויב", "Billed")} {sym}
              {fmt(amtOf(selectedOption))}
              {periodLabel(selectedOption.cadence)} ·{" "}
              {t("ביטול בכל עת", "cancel anytime")}
            </p>
          ) : null}

          {/* C2.4: cadence picker — only when ≥2 cadences are enabled.
              Each option shows its effective per-week + actual billed +
              savings vs the weekly baseline. */}
          {showPicker ? (
            <div className="mt-5 flex flex-col gap-2.5">
              {enabledCadences.map((c) => {
                const selected = c.cadence === selectedCadence;
                const sv = savingsOf(c);
                const title =
                  c.cadence === "monthly"
                    ? t("חודשי", "Monthly")
                    : c.cadence === "quarterly"
                      ? t("רבעוני", "Quarterly")
                      : c.cadence === "yearly"
                        ? t("שנתי", "Yearly")
                        : t("שבועי", "Weekly");
                return (
                  <button
                    key={c.cadence}
                    type="button"
                    onClick={() => setSelectedCadence(c.cadence)}
                    aria-pressed={selected}
                    className={`group relative flex w-full items-center gap-3 rounded-2xl border p-4 text-start transition ${
                      selected
                        ? "border-amber-300/60 bg-white/10 ring-2 ring-amber-400/40"
                        : "border-white/15 bg-white/[0.04] hover:border-white/30 hover:bg-white/[0.08]"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] ${
                        selected
                          ? "bg-gradient-to-br from-amber-400 to-rose-500 text-white"
                          : "bg-white/10 text-white/70"
                      }`}
                    >
                      {selected ? "✓" : ""}
                    </span>
                    <span className="flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-[15px] font-semibold text-white">
                          {title}
                        </span>
                        <span className="text-[15px] font-bold text-white">
                          {sym}
                          {fmt(effWeeklyOf(c))}
                          <span className="text-[12px] font-medium text-white/65">
                            {t("/שבוע", "/wk")}
                          </span>
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[12px] text-white/60">
                        {t("מחויב", "billed")} {sym}
                        {fmt(amtOf(c))}
                        {periodLabel(c.cadence)}
                      </span>
                    </span>
                    {sv && sv > 0 ? (
                      <span className="absolute -top-2 end-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                        {t("חיסכון", "Save")} {sv}%
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* C2.4: "what's included" value-points. CMS-driven
              (page='journey', section='assessment') so the copy is
              editable from /admin/content without a deploy; falls back to
              messages. Same dark/gold styling as the CTA. */}
          <div className="mt-5 text-start">
            <CmsText
              cmsKey="journeyAssessment.valuePoints.title"
              as="span"
              className="text-[13px] font-semibold tracking-wide"
              style={{ color: GOLD }}
            />
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {["point1", "point2", "point3"].map((p) => (
                <li key={p} className="flex items-center gap-2.5">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-[#1a1014]"
                    style={{
                      background:
                        "linear-gradient(135deg, #FCCA65 0%, #B88F32 100%)",
                    }}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <CmsText
                    cmsKey={`journeyAssessment.valuePoints.${p}`}
                    as="span"
                    className="text-[15px] font-medium text-white"
                  />
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={startCheckout}
            disabled={busy}
            className="group mt-5 inline-flex min-h-[60px] w-full items-center justify-center gap-3 rounded-full px-8 text-[20px] font-bold text-black transition hover:brightness-110 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #FCCA65 0%, #B88F32 100%)", boxShadow: "0 18px 40px -12px rgba(252,202,101,0.55)" }}
          >
            {busy ? t("רגע...", "One moment...") : cp ? (isHe ? cp.cta_he : cp.cta_en) : t("מצטרפים לליווי", "Join the program")}
            {!busy ? <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-[-3px]" /> : null}
          </button>
          {error ? (
            <p role="alert" className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-center text-[13px] text-rose-200">
              {error}
            </p>
          ) : null}
        </section>
      )}
    </motion.div>
  );
}
