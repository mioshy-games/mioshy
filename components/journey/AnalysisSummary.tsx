"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type { Analysis, CategoryScores, Locale } from "@/lib/journey/types";
import { axisLabel } from "@/lib/journey/analysis";
import {
  CATEGORY_FEEDBACK,
  CATEGORY_ORDER,
  CATEGORY_WEAK_BELOW,
  type CategoryKey,
} from "@/lib/journey/category-feedback";
import {
  getFocusMonthCopy,
  isPriorityKey,
} from "@/lib/journey/focus-month-copy";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

interface AnalysisSummaryProps {
  analysis: Analysis | null;
  locale: Locale;
  subscriptionActive?: boolean;
}

/**
 * Post-completion screen — premium edition (Itzik #62).
 *
 * Three sections:
 *   1. Hero — title + 3 score cards in a tight row.
 *   2. Insight — narrative + focus-month + recommendation bullets,
 *      laid out as a single readable column with consistent rhythm.
 *   3. CTA — wine-palette offer card matching /pricing and the rest
 *      of the site (no fuchsia rainbow).
 *
 * Sprint 4 #3 Phase 2A migration — 42 keys under
 * journeyAssessment.analysis.*. whoFor1..4 and gain1..5 are flat keys
 * so admins get per-item editing (same pattern as PaywallGateModal
 * bullets). Data-driven copy (narrative_he/en, rec.he/en, axisLabel,
 * getFocusMonthCopy) stays as-is — those live in DB rows / library
 * functions outside the CMS scope.
 */
export function AnalysisSummary({
  analysis,
  locale,
  subscriptionActive = false,
}: AnalysisSummaryProps) {
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const isHe = locale === "he";

  // String-prop consumers — error messages and busy labels that must
  // resolve to raw strings before they land in state or props.
  const checkoutErrGeneric = useCmsText("journeyAssessment.analysis.checkoutErrorGeneric").text;
  const checkoutErrNetwork = useCmsText("journeyAssessment.analysis.checkoutErrorNetwork").text;
  const ctaLoadingLabel = useCmsText("journeyAssessment.analysis.ctaLoading").text;
  const stickyCtaLabel = useCmsText("journeyAssessment.analysis.stickyCta").text;

  if (!analysis) {
    return (
      <div
        dir={isHe ? "rtl" : "ltr"}
        className="mx-auto max-w-2xl p-10 text-center text-white/80"
      >
        <CmsText cmsKey="journeyAssessment.analysis.preparingAnalysis" />
      </div>
    );
  }

  const bakedFocus = isHe
    ? analysis.summary.focus_label_he
    : analysis.summary.focus_label_en;
  const focusLabel =
    bakedFocus ??
    (analysis.top_gap ? axisLabel(analysis.top_gap, locale) : null);

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  const startCheckout = async () => {
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/billing/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "weekly",
          product: "journey",
          source: "analysis_summary",
          language: locale,
          is_israeli: locale === "he",
          // Land on the hub (/my), not the journey workspace, so the
          // newly-subscribed user sees the PartnerShareCard and can
          // invite their partner before diving into the program. Per
          // Itzik 2026-05-27: the hub is the "first-screen" — Journey
          // gets opened on demand from there.
          return_path: `/${locale}/my`,
        }),
      });
      const data = await res.json().catch(() => ({}));

      // W1.1 — auth gate. Push the user to signup with a return path
      // back to the assessment so they continue exactly where they were.
      // F1 fix: strip /he|/en prefix from pathname before encoding —
      // signup re-prepends the locale, so leaving it in caused the
      // /he/he/journey/... 404.
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

  // ── AI hero + category bundle (2026-06-02) ───────────────────────────
  // When the AI call succeeded `summary.ai_hero` is populated and we render
  // the new benefit-stack hero. When null we render NOTHING in its place —
  // Itzik 2026-06-02: the deterministic "narrative" was confusing users
  // because it didn't reference their actual answers, so it's been removed
  // from the visible flow entirely. The personalized recommendation body
  // below remains (it references the user's chosen priority).
  const aiHero = analysis.summary.ai_hero ?? null;
  const categoryScores = analysis.summary.category_scores ?? null;
  const heroText = aiHero
    ? isHe ? aiHero.hero_he : aiHero.hero_en
    : null;
  const heroRecs = aiHero
    ? isHe ? aiHero.recommendations_he : aiHero.recommendations_en
    : [];

  return (
    <motion.div
      dir={isHe ? "rtl" : "ltr"}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      // W3.1 (Itzik #11) — extra bottom padding on mobile so the sticky
      // CTA doesn't cover the last content section. lg:pb-10 restores
      // the desktop default since the sticky CTA is mobile-only.
      className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 pb-32 lg:pb-10"
    >
      {/* Mioshy logo lives on the page wrapper (app/[locale]/journey/
          assessment/page.tsx) so it appears on every screen of the flow,
          not just the summary. Don't duplicate it here. */}

      {/* ── Bar chart - the new hero (2026-06-02) ──────────────────────
          Order per Itzik: chart first (establishes "we read you"), then
          AI benefit-stack hero, then personalized method body, then
          recommendation bullets, then the existing sections. */}
      {categoryScores ? (
        <CategoryBarChart scores={categoryScores} isHe={isHe} />
      ) : (
        // Fallback to legacy 3-card grid for older assessments without
        // the 5-category bundle.
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <ScoreCard
            labelKey="journeyAssessment.analysis.friendship"
            value={analysis.friendship_score}
          />
          <ScoreCard
            labelKey="journeyAssessment.analysis.conflict"
            value={analysis.conflict_health}
          />
          <ScoreCard
            labelKey="journeyAssessment.analysis.passion"
            value={analysis.passion_risk}
            invert
          />
        </div>
      )}

      {/* ── Personal feedback per category (2026-06-07, Itzik approved) ──
          Additive: driven by the existing category_scores; no scoring change.
          Two bands per category (strong / needs-work) selected by the real
          score, grounded in the content library. Lowest is highlighted. */}
      {categoryScores ? (
        <section className="px-2">
          <span className="text-start text-[14px] font-semibold uppercase tracking-wider leading-normal text-[#FCCA65]">
            {isHe ? "מה התשובות שלכם מספרות" : "What your answers tell"}
          </span>
          <h2 className="mt-1 text-balance text-start font-heading text-[24px] font-extrabold leading-tight text-white sm:text-[28px]">
            {isHe ? "המשוב האישי שלכם" : "Your personal feedback"}
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {CATEGORY_ORDER.map((key: CategoryKey) => {
              const score = categoryScores[key];
              const fb = CATEGORY_FEEDBACK[key];
              const weak = score < CATEGORY_WEAK_BELOW;
              const text = isHe
                ? weak ? fb.weak_he : fb.strong_he
                : weak ? fb.weak_en : fb.strong_en;
              const isLowest = key === categoryScores.lowest_key;
              return (
                <li
                  key={key}
                  className="rounded-2xl border p-4 sm:p-5"
                  style={{
                    borderColor: isLowest ? "rgba(252,202,101,0.55)" : "rgba(255,255,255,0.12)",
                    background: isLowest ? "rgba(252,202,101,0.10)" : "rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-start gap-4">
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
                        style={{ color: isLowest ? "#FCCA65" : "#fff" }}
                      >
                        {score}
                      </span>
                      <span className="mt-1 text-[12px] font-semibold text-white">{isHe ? "מתוך 100" : "of 100"}</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-[22px] font-bold leading-tight text-white">{isHe ? fb.he : fb.en}</span>
                      {isLowest ? (
                        <span
                          className="ms-2 inline-block rounded-full px-2.5 py-0.5 text-[13px] font-bold"
                          style={{ background: "#FCCA65", color: "#1a1018" }}
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

      {/* ── AI benefit-stack hero ─────────────────────────────────────── */}
      {heroText ? (
        <section className="px-2 py-2">
          <p className="text-balance text-start font-heading text-[26px] font-extrabold leading-tight text-white sm:text-[32px]">
            {heroText}
          </p>
        </section>
      ) : null}

      {/* Personalized method body REMOVED (Itzik 2026-06-02): the same
          content is already covered by the three feature tiles in the
          offer card below ("חדר אישי", "תוכן שבועי", "שיחה שמתפתחת"),
          so a long paragraph above duplicated the value prop. */}

      {/* ── "מה תקבלו בליווי" - AI recommendations as benefit bullets ── */}
      {heroRecs.length > 0 ? (
        <section>
          <h2 className="text-balance text-start font-heading text-[24px] font-extrabold text-white sm:text-[28px]">
            {isHe ? "מה תקבלו בליווי" : "What you'll get in the program"}
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {heroRecs.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-3 px-2 py-2"
              >
                <span
                  className="mt-2.5 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: "#FCCA65" }}
                  aria-hidden
                />
                <span className="flex-1 text-pretty text-start text-[22px] leading-[1.3] text-white/95 sm:text-[19px] sm:leading-[1.65]">
                  {rec}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── Focus for the first month (legacy - only when AI failed) ──
          Itzik 2026-06-02: when the AI hero rendered above, the focus
          block is redundant. Keep it as a fallback so older assessments
          (without ai_hero) still see a structured "focus" prompt. */}
      {!heroText && focusLabel && (() => {
        const priority = isPriorityKey(analysis.summary.top_priority)
          ? analysis.summary.top_priority
          : null;
        const focus = getFocusMonthCopy(priority, locale);
        return (
          <section className="px-2 py-2">
            <div>
              <CmsText
                cmsKey="journeyAssessment.analysis.topGap"
                as="div"
                className="text-start text-[14px] font-semibold uppercase tracking-wider text-[#FCCA65] leading-normal"
              />
              <div className="mt-1.5 text-balance text-start font-heading text-[28px] font-extrabold leading-tight text-white sm:text-[32px]">
                {focusLabel}
              </div>
              {focus ? (
                <ul className="mt-4 flex flex-col gap-2.5">
                  {[focus.reflection, focus.plan, focus.close].map((line, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-pretty text-start text-[22px] leading-[1.3] text-white/90 sm:text-[19px] sm:leading-[1.7]"
                    >
                      <CheckCircle2
                        className="mt-1.5 h-4 w-4 shrink-0 text-[#FCCA65]"
                        aria-hidden
                      />
                      <span className={`flex-1 ${i === 2 ? "font-semibold text-[#FAF6F7]" : ""}`}>
                        {line}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        );
      })()}

      {/* W3.2 (Itzik #14) — what you'll gain. Placed between the
          recommendations and the offer so the user reads concrete
          benefits before they see the price. */}
      <section className="p-2 sm:p-3">
        <CmsText
          cmsKey="journeyAssessment.analysis.gainsLabel"
          as="div"
          className="text-start text-[14px] font-semibold uppercase tracking-wider text-[#FCCA65] leading-normal"
        />
        <CmsText
          cmsKey="journeyAssessment.analysis.gainsTitle"
          as="h2"
          className="mt-2 text-balance text-start font-heading text-[24px] font-extrabold leading-tight text-white sm:text-[28px]"
        />
        <ul className="mt-4 flex flex-col gap-2.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <li
              key={n}
              className="flex items-start gap-3 text-[22px] leading-[1.3] text-white/90 sm:text-[19px] sm:leading-[1.65]"
            >
              <CheckCircle2
                className="mt-1 h-5 w-5 shrink-0 text-[#FCCA65]"
                aria-hidden
              />
              <CmsText
                cmsKey={`journeyAssessment.analysis.gain${n}`}
                className="flex-1 text-pretty text-start"
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Itzik 2026-05-29 — Topics covered. Concrete answer to "what
          will we actually work on?" using the 5 journey priority
          categories (communication / intimacy / emotional_connection /
          friendship / family). Each row: name (bold) + short desc.
          Placed after Gains ("what change") so users see "what areas"
          next, before WhoFor / Expert / Offer. */}
      <section className="p-2 sm:p-3">
        <CmsText
          cmsKey="journeyAssessment.analysis.topicsLabel"
          as="div"
          className="text-start text-[14px] font-semibold uppercase tracking-wider text-[#FCCA65] leading-normal"
        />
        <CmsText
          cmsKey="journeyAssessment.analysis.topicsTitle"
          as="h2"
          className="mt-2 text-balance text-start font-heading text-[24px] font-extrabold leading-tight text-white sm:text-[28px]"
        />
        <CmsText
          cmsKey="journeyAssessment.analysis.topicsSub"
          as="p"
          className="mt-2 text-pretty text-start text-[18px] leading-[1.4] text-white/70 sm:text-[16px] sm:leading-[1.55]"
        />
        <ul className="mt-4 flex flex-col gap-2.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <li
              key={n}
              className="px-2 py-2.5"
            >
              <CmsText
                cmsKey={`journeyAssessment.analysis.topic${n}Name`}
                as="div"
                className="text-balance text-start text-[20px] leading-[1.3] font-bold text-white sm:text-[18px]"
              />
              <CmsText
                cmsKey={`journeyAssessment.analysis.topic${n}Desc`}
                as="p"
                className="mt-1 text-pretty text-start text-[18px] leading-[1.4] text-white/70 sm:text-[15px] sm:leading-[1.55]"
              />
            </li>
          ))}
        </ul>
        {/* Itzik 2026-06-02: reassurance line below the list - the user
            can re-rank priorities later from inside the journey. */}
        <CmsText
          cmsKey="journeyAssessment.analysis.topicsAfterJoin"
          as="p"
          className="mt-4 text-start text-[15px] leading-[1.45] italic text-white/60 sm:text-[14px]"
        />
      </section>

      {/* W3.2 (Itzik #13) — who is this for. Below the gains so the
          user reads "what" before "who" — natural decision order. */}
      <section className="p-2 sm:p-3">
        <CmsText
          cmsKey="journeyAssessment.analysis.whoForLabel"
          as="div"
          className="text-start text-[14px] font-semibold uppercase tracking-wider text-[#FCCA65] leading-normal"
        />
        <CmsText
          cmsKey="journeyAssessment.analysis.whoForTitle"
          as="h2"
          className="mt-2 text-balance text-start font-heading text-[24px] font-extrabold leading-tight text-white sm:text-[28px]"
        />
        <ul className="mt-4 flex flex-col gap-2.5">
          {[1, 2, 3, 4].map((n) => (
            <li
              key={n}
              className="flex items-start gap-3 text-[22px] leading-[1.3] text-white/90 sm:text-[19px] sm:leading-[1.65]"
            >
              <span
                className="mt-2.5 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: "#FCCA65" }}
                aria-hidden
              />
              <CmsText
                cmsKey={`journeyAssessment.analysis.whoFor${n}`}
                className="flex-1 text-pretty text-start"
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Itzik 2026-05-29 — Expert emphasis. The unique human element
          before the price: real couples expert in a private 1:1 chat,
          always available, learning the couple over time. Wine palette
          mirrors the Focus and Offer cards so it reads as the same
          "premium delivery" voice. Placed right before the offer so
          the human face is the last thing the user sees before the
          price. */}
      <section className="px-2 py-2">
        <div>
          <CmsText
            cmsKey="journeyAssessment.analysis.expertLabel"
            as="div"
            className="text-start text-[14px] font-semibold uppercase tracking-wider text-[#FCCA65] leading-normal"
          />
          <CmsText
            cmsKey="journeyAssessment.analysis.expertTitle"
            as="h2"
            className="mt-1.5 text-balance text-start font-heading text-[26px] font-extrabold leading-tight text-white sm:text-[30px]"
          />
          <CmsText
            cmsKey="journeyAssessment.analysis.expertBody"
            as="p"
            className="mt-3 text-pretty text-start text-[20px] leading-[1.4] text-white/90 sm:text-[18px] sm:leading-[1.7]"
          />
          <ul className="mt-4 flex flex-col gap-2.5">
            {[1, 2, 3, 4].map((n) => (
              <li
                key={n}
                className="flex items-start gap-3 text-[22px] leading-[1.3] text-white/95 sm:text-[19px] sm:leading-[1.65]"
              >
                <MessageCircle
                  className="mt-1 h-5 w-5 shrink-0 text-[#FCCA65]"
                  aria-hidden
                />
                <CmsText
                  cmsKey={`journeyAssessment.analysis.expertBullet${n}`}
                  className="flex-1 text-pretty text-start"
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA / Active subscriber ──────────────────────────────────── */}
      {subscriptionActive ? (
        <ActiveSubscriberCard locale={locale} />
      ) : (
        <OfferCard
          checkoutBusy={checkoutBusy}
          checkoutError={checkoutError}
          onCheckout={startCheckout}
          Arrow={Arrow}
          ctaLoadingLabel={ctaLoadingLabel}
        />
      )}

      {/* W3.1 (Itzik #11) — sticky bottom CTA on mobile only.
          F3 (#1) — bar background itself is now the wine gradient so
          the whole strip pulls the eye, not just a button on a black
          plate. The button reads as a clean lighter-tinted overlay on
          top of the wine field. */}
      {!subscriptionActive ? (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 px-4 py-3 lg:hidden"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
            background:
              "linear-gradient(180deg, rgba(252,202,101,0.95) 0%, rgba(184,143,50,0.98) 100%)",
            boxShadow: "0 -16px 40px -12px rgba(252,202,101,0.55)",
          }}
          dir={isHe ? "rtl" : "ltr"}
        >
          <button
            type="button"
            onClick={startCheckout}
            disabled={checkoutBusy}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-full text-[18px] font-semibold text-black transition disabled:opacity-60"
            style={{
              background: "#FCCA65",
              boxShadow: "0 8px 24px -8px rgba(0,0,0,0.5)",
            }}
          >
            {checkoutBusy ? ctaLoadingLabel : stickyCtaLabel}
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Score card — solid surface, big numeric, label above. Invert flips
// the colour mapping for "risk" axes (high=bad, low=good).
// ─────────────────────────────────────────────────────────────────────

function ScoreCard({
  labelKey,
  value,
  invert = false,
}: {
  labelKey: string;
  value: number;
  invert?: boolean;
}) {
  const tone = invert
    ? value >= 60
      ? "text-rose-300"
      : "text-[#FCCA65]"
    : value >= 60
      ? "text-[#FCCA65]"
      : "text-amber-300";
  return (
    <div className="flex flex-col items-center p-3 text-center sm:p-4">
      {/* Itzik 2026-05-29 (mobile): label 20px (was 16), value 36px
          (was 28). min-h on label reserves 3 lines so the three score
          numbers align vertically even when one label wraps to 3 lines
          ("סיכון לירידה בתשוקה") and others to 2. mt-auto on the score
          pushes all numbers to the same baseline. Desktop preserved
          via sm:. */}
      <CmsText
        cmsKey={labelKey}
        as="div"
        className="min-h-[75px] text-[20px] font-medium leading-tight text-white/75 sm:min-h-0 sm:text-[16px]"
      />
      <div className={`mt-auto pt-1 text-[36px] font-extrabold leading-none sm:text-[28px] ${tone}`}>
        {value}
        <span className="ms-1 text-[15px] font-semibold text-white/55">
          /100
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function ActiveSubscriberCard({ locale }: { locale: string }) {
  return (
    <section className="flex flex-col items-center gap-3 px-2 py-4 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          background: "linear-gradient(135deg, #FCCA65 0%, #B88F32 100%)",
          boxShadow: "0 12px 30px -10px rgba(252,202,101,0.55)",
        }}
      >
        <CheckCircle2 className="h-7 w-7 text-[#FAF6F7]" />
      </div>
      <CmsText
        cmsKey="journeyAssessment.analysis.activeTitle"
        as="h2"
        className="font-heading text-[26px] font-extrabold text-white"
      />
      <CmsText
        cmsKey="journeyAssessment.analysis.activeSub"
        as="p"
        className="max-w-md text-[16px] text-white/75"
      />
      <a
        href={`/${locale}/my`}
        className="mt-2 inline-flex min-h-[52px] items-center justify-center rounded-full px-7 text-[15px] font-semibold text-black transition hover:brightness-110"
        style={{
          background: "linear-gradient(135deg, #FCCA65 0%, #B88F32 100%)",
        }}
      >
        <CmsText cmsKey="journeyAssessment.analysis.goAccount" />
      </a>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

function OfferCard({
  checkoutBusy,
  checkoutError,
  onCheckout,
  Arrow,
  ctaLoadingLabel,
}: {
  checkoutBusy: boolean;
  checkoutError: string | null;
  onCheckout: () => void;
  Arrow: typeof ArrowLeft;
  ctaLoadingLabel: string;
}) {
  // Itzik 2026-05-29 — split the price string ("57 ₪ / שבוע") so the
  // "/ שבוע" suffix renders at the same small size as the priceNote
  // ("ניתן לעצור בכל עת"), instead of inheriting the 34px headline
  // size. Keeps admin click-to-edit on the price by tagging the
  // wrapper with data-cms-key.
  const priceRaw = useCmsText("journeyAssessment.analysis.price").text;
  const [priceAmount, ...periodParts] = priceRaw.split(/\s*\/\s*/);
  const pricePeriod = periodParts.join(" / ");
  return (
    <section className="px-2 py-4 sm:py-6">
      <div>
        <CmsText
          cmsKey="journeyAssessment.analysis.offerLabel"
          as="div"
          className="text-start text-[14px] font-semibold uppercase tracking-wider text-[#FCCA65] leading-normal"
        />
        <CmsText
          cmsKey="journeyAssessment.analysis.offerHero"
          as="h2"
          className="mt-3 text-balance text-start font-heading text-[26px] font-extrabold leading-snug text-white sm:text-[30px]"
        />
        <CmsText
          cmsKey="journeyAssessment.analysis.offerSub"
          as="p"
          className="mt-2 text-pretty text-start text-[17px] font-semibold text-[#FAF6F7]/85"
        />

        {/* 3 FeatureTiles removed (Itzik 2026-06-02): the value props
            they carried (private expert chat, weekly tailored content,
            ongoing conversation) are already covered upstream by the
            AI hero, the "מה תקבלו בליווי" bullets, and the topics
            section. The tile row was a third repetition. */}

        <div className="mt-6 flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between sm:gap-4">
          <div
            className="flex items-baseline gap-1.5"
            data-cms-key="journeyAssessment.analysis.price"
          >
            <span className="font-heading text-[34px] font-extrabold text-white">
              {priceAmount}
            </span>
            {pricePeriod ? (
              <span className="text-[14px] text-white/55">
                / {pricePeriod}
              </span>
            ) : null}
            <span className="text-[14px] text-white/55">
              · <CmsText cmsKey="journeyAssessment.analysis.priceNote" />
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCheckout}
          disabled={checkoutBusy}
          className="group mt-5 inline-flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full px-8 text-[17px] font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #FCCA65 0%, #B88F32 100%)",
            boxShadow: "0 18px 40px -12px rgba(252,202,101,0.55)",
          }}
        >
          {checkoutBusy ? (
            ctaLoadingLabel
          ) : (
            <CmsText cmsKey="journeyAssessment.analysis.cta" />
          )}
          {!checkoutBusy ? (
            <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-[-3px]" />
          ) : null}
        </button>

        {/* W1.1 — surface checkout errors instead of silently failing. */}
        {checkoutError ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-center text-[13px] text-rose-200"
          >
            {checkoutError}
          </p>
        ) : null}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// Category bar chart - 5-bar visualisation that opens the summary
// (replaces the legacy 3-card score grid as the new hero).
// Each bar is 0-100, higher = healthier. The lowest-scoring category
// gets a "נקודת ההתחלה שלכם" label on the side, motivating engagement
// without scaring the user (Itzik #4, 2026-06-02).
// ─────────────────────────────────────────────────────────────────────

function CategoryBarChart({
  scores,
  isHe,
}: {
  scores: CategoryScores;
  isHe: boolean;
}) {
  const labelsHe: Record<CategoryScores["lowest_key"], string> = {
    communication: "תקשורת",
    intimacy: "אינטימיות",
    emotional_connection: "חיבור רגשי",
    friendship: "חברות",
    family: "משפחה",
  };
  const labelsEn: Record<CategoryScores["lowest_key"], string> = {
    communication: "Communication",
    intimacy: "Intimacy",
    emotional_connection: "Emotional",
    friendship: "Friendship",
    family: "Family",
  };

  // Order: always render in the same priority order so the visual
  // is comparable across users.
  const rows: Array<{ key: CategoryScores["lowest_key"]; value: number }> = [
    { key: "communication",         value: scores.communication },
    { key: "intimacy",              value: scores.intimacy },
    { key: "emotional_connection",  value: scores.emotional_connection },
    { key: "friendship",            value: scores.friendship },
    { key: "family",                value: scores.family },
  ];

  // Itzik 2026-06-02: was "נקודת ההתחלה שלכם" — implied the user
  // had picked this axis. The label is actually driven by the lowest
  // score, not by the user's priorities. New copy frames it as a
  // recommendation so it's honest about the source.
  const recommendationPrefix = isHe
    ? "ההמלצה שלנו להתחיל ב"
    : "we recommend starting with ";
  const lowestLabel = isHe ? labelsHe[scores.lowest_key] : labelsEn[scores.lowest_key];
  // Hebrew prefix "ב" attaches directly to the noun ("באינטימיות",
  // "בתקשורת"). English keeps a space between "with" and the label.
  const recommendationLine = isHe
    ? `${recommendationPrefix}${lowestLabel}`
    : `${recommendationPrefix}${lowestLabel}`;

  // Itzik 2026-06-02: horizontal 5-column layout. Yellow gradient bars
  // (logo gold #FCCA65 → deeper amber #B88F32), high contrast on dark
  // background per Itzik feedback (red-on-black was unreadable). Square
  // corners, score number SITS INSIDE each bar near the top.
  return (
    <section className="px-2 py-4">
      <div>
        <div className="mb-6 flex flex-col gap-1.5">
          <span className="text-start text-[14px] font-semibold uppercase tracking-wider text-[#FCCA65] leading-normal">
            {isHe ? "האבחון שלכם" : "Your assessment"}
          </span>
          <h2 className="text-balance text-start font-heading text-[26px] font-extrabold leading-tight text-white sm:text-[30px]">
            {isHe ? "האבחון שלכם כיום" : "Your assessment today"}
          </h2>
          <p className="mt-1 text-start text-[13px] leading-snug text-white/55">
            {isHe
              ? "ציון 0-100 לכל תחום, גבוה = חזק יותר. הציון נגזר ישירות מהתשובות שלכם."
              : "0-100 per area, higher = stronger. Scores are derived directly from your answers."}
          </p>
        </div>

        {/* 5 vertical bars in a single horizontal row, square corners.
            Number sits BELOW the bar (aligned across all columns) and
            above the category name. */}
        <div className="grid grid-cols-5 items-end gap-2 sm:gap-3">
          {rows.map((row) => {
            const isLowest = row.key === scores.lowest_key;
            const heightPct = Math.max(14, Math.min(100, row.value));
            return (
              <div key={row.key} className="flex flex-col items-center">
                {/* Bar */}
                <div
                  className="relative w-full overflow-hidden"
                  style={{
                    height: 160,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 transition-all"
                    style={{
                      height: `${heightPct}%`,
                      background: "#FCCA65",
                      boxShadow: isLowest
                        ? "0 0 28px rgba(252,202,101,0.55)"
                        : "none",
                    }}
                  />
                </div>
                {/* Score number BELOW the bar, aligned across all columns */}
                <span
                  className={`mt-2 text-center text-[20px] font-extrabold tabular-nums leading-none sm:text-[22px] ${
                    isLowest ? "text-[#FCCA65]" : "text-white"
                  }`}
                >
                  {row.value}
                </span>
                {/* Category label below the number */}
                <span
                  className={`mt-1.5 text-balance text-center text-[12px] font-semibold leading-tight sm:text-[13px] ${
                    isLowest ? "text-[#FCCA65]" : "text-white/75"
                  }`}
                >
                  {isHe ? labelsHe[row.key] : labelsEn[row.key]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Recommendation caption, anchored to the lowest column.
            2026-06-02 (Itzik): renamed from "your starting point" to
            an explicit recommendation phrasing — clearer about who is
            choosing, and the category name now closes the sentence
            instead of preceding the label. */}
        <div className="mt-4 flex flex-col items-center gap-1 text-center sm:mt-5">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[#FCCA65]">
            {recommendationLine}
          </span>
        </div>
      </div>
    </section>
  );
}

// FeatureTile removed (Itzik 2026-06-02): the 3-tile row inside the
// OfferCard was a third repetition of the value props already covered
// by the AI hero, the "מה תקבלו בליווי" bullets, and the topics list.
