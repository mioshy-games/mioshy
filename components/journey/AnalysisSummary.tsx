"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Lock,
  CalendarDays,
  MessageCircle,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type { Analysis, Locale } from "@/lib/journey/types";
import { axisLabel } from "@/lib/journey/analysis";
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
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-2.5">
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[13px] font-semibold uppercase tracking-wider text-white/75">
          <Sparkles className="h-3.5 w-3.5" />
          <CmsText cmsKey="journeyAssessment.analysis.sectionLabel" />
        </span>
        <CmsText
          cmsKey="journeyAssessment.analysis.title"
          as="h1"
          className="font-heading text-[34px] font-extrabold leading-tight text-white sm:text-[42px]"
        />
        <CmsText
          cmsKey="journeyAssessment.analysis.subtitle"
          as="p"
          className="text-[22px] leading-[1.3] text-white/70 sm:text-[19px] sm:leading-[1.55]"
        />
      </header>

      {/* ── Score cards ──────────────────────────────────────────────── */}
      {/* Itzik 2026-05-29 (mobile): 3-up grid on ALL widths (was 1-up on
          mobile), label bumped 16→20px, value 28→36px on mobile. Desktop
          sizes preserved via sm: overrides per mobile-only rule. */}
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

      {/* ── Narrative ────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
        <CmsText
          cmsKey="journeyAssessment.analysis.narrativeLabel"
          as="div"
          className="text-[20px] leading-[1.3] font-semibold uppercase tracking-wider text-[#B83C4D]/85 sm:text-[13px] sm:leading-normal"
        />
        <p className="mt-2 text-[22px] leading-[1.3] text-white/90 sm:text-[19px] sm:leading-[1.7]">
          {isHe ? analysis.summary.narrative_he : analysis.summary.narrative_en}
        </p>
      </section>

      {/* ── Focus for the first month ────────────────────────────────── */}
      {focusLabel && (() => {
        const priority = isPriorityKey(analysis.summary.top_priority)
          ? analysis.summary.top_priority
          : null;
        const focus = getFocusMonthCopy(priority, locale);
        return (
          <section
            className="relative overflow-hidden rounded-3xl border p-6 sm:p-7"
            style={{
              borderColor: "rgba(184,60,77,0.35)",
              background:
                "linear-gradient(135deg, rgba(184,60,77,0.18) 0%, rgba(108,46,64,0.10) 60%, rgba(255,255,255,0.02) 100%)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -end-20 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl"
              style={{ background: "#B83C4D" }}
            />
            <div className="relative">
              <CmsText
                cmsKey="journeyAssessment.analysis.topGap"
                as="div"
                className="text-[20px] leading-[1.3] font-semibold uppercase tracking-wider text-[#FAF6F7]/75 sm:text-[13px] sm:leading-normal"
              />
              <div className="mt-1.5 font-heading text-[28px] font-extrabold leading-tight text-white sm:text-[32px]">
                {focusLabel}
              </div>
              {focus ? (
                <ul className="mt-4 flex flex-col gap-2.5">
                  {[focus.reflection, focus.plan, focus.close].map((line, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-[22px] leading-[1.3] text-white/90 sm:text-[19px] sm:leading-[1.7]"
                    >
                      <CheckCircle2
                        className="mt-1 h-4 w-4 shrink-0 text-[#B83C4D]"
                        aria-hidden
                      />
                      <span className={i === 2 ? "font-semibold text-[#FAF6F7]" : ""}>
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

      {/* ── Recommendations as bullets ───────────────────────────────── */}
      <section>
        <CmsText
          cmsKey="journeyAssessment.analysis.recs"
          as="h2"
          className="font-heading text-[24px] font-extrabold text-white sm:text-[28px]"
        />
        <ul className="mt-4 flex flex-col gap-2.5">
          {analysis.summary.recommendations.map((rec) => (
            <li
              key={rec.id}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4"
            >
              <span
                className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: "#B83C4D" }}
                aria-hidden
              />
              <span className="text-[22px] leading-[1.3] text-white/90 sm:text-[19px] sm:leading-[1.65]">
                {isHe ? rec.he : rec.en}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* W3.2 (Itzik #14) — what you'll gain. Placed between the
          recommendations and the offer so the user reads concrete
          benefits before they see the price. */}
      <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/[0.04] p-6 sm:p-7">
        <CmsText
          cmsKey="journeyAssessment.analysis.gainsLabel"
          as="div"
          className="text-[20px] leading-[1.3] font-semibold uppercase tracking-wider text-emerald-300/80 sm:text-[13px] sm:leading-normal"
        />
        <CmsText
          cmsKey="journeyAssessment.analysis.gainsTitle"
          as="h2"
          className="mt-2 font-heading text-[24px] font-extrabold leading-tight text-white sm:text-[28px]"
        />
        <ul className="mt-4 flex flex-col gap-2.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <li
              key={n}
              className="flex items-start gap-3 text-[22px] leading-[1.3] text-white/90 sm:text-[19px] sm:leading-[1.65]"
            >
              <CheckCircle2
                className="mt-1 h-5 w-5 shrink-0 text-emerald-300"
                aria-hidden
              />
              <CmsText cmsKey={`journeyAssessment.analysis.gain${n}`} />
            </li>
          ))}
        </ul>
      </section>

      {/* W3.2 (Itzik #13) — who is this for. Below the gains so the
          user reads "what" before "who" — natural decision order. */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-7">
        <CmsText
          cmsKey="journeyAssessment.analysis.whoForLabel"
          as="div"
          className="text-[20px] leading-[1.3] font-semibold uppercase tracking-wider text-[#B83C4D]/85 sm:text-[13px] sm:leading-normal"
        />
        <CmsText
          cmsKey="journeyAssessment.analysis.whoForTitle"
          as="h2"
          className="mt-2 font-heading text-[24px] font-extrabold leading-tight text-white sm:text-[28px]"
        />
        <ul className="mt-4 flex flex-col gap-2.5">
          {[1, 2, 3, 4].map((n) => (
            <li
              key={n}
              className="flex items-start gap-3 text-[22px] leading-[1.3] text-white/90 sm:text-[19px] sm:leading-[1.65]"
            >
              <span
                className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: "#B83C4D" }}
                aria-hidden
              />
              <CmsText cmsKey={`journeyAssessment.analysis.whoFor${n}`} />
            </li>
          ))}
        </ul>
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
              "linear-gradient(180deg, rgba(184,60,77,0.95) 0%, rgba(108,46,64,0.98) 100%)",
            boxShadow: "0 -16px 40px -12px rgba(184,60,77,0.55)",
          }}
          dir={isHe ? "rtl" : "ltr"}
        >
          <button
            type="button"
            onClick={startCheckout}
            disabled={checkoutBusy}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-white text-[18px] font-bold text-[#6C2E40] transition disabled:opacity-60"
            style={{
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
      : "text-emerald-300"
    : value >= 60
      ? "text-emerald-300"
      : "text-amber-300";
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center transition hover:border-white/15 sm:p-4">
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
    <section
      className="flex flex-col items-center gap-3 rounded-3xl border p-7 text-center"
      style={{
        borderColor: "rgba(184,60,77,0.35)",
        background:
          "linear-gradient(135deg, rgba(184,60,77,0.18) 0%, rgba(108,46,64,0.08) 100%)",
      }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
          boxShadow: "0 12px 30px -10px rgba(184,60,77,0.55)",
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
        className="mt-2 inline-flex min-h-[52px] items-center justify-center rounded-full px-7 text-[15px] font-bold text-white transition hover:brightness-110"
        style={{
          background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
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
    <section
      className="relative overflow-hidden rounded-3xl border p-7 sm:p-8"
      style={{
        borderColor: "rgba(184,60,77,0.45)",
        background:
          "linear-gradient(160deg, #1a0f15 0%, #0E0810 60%, #0E0810 100%)",
        boxShadow: "0 30px 80px -30px rgba(184,60,77,0.5)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -start-24 -top-24 h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: "#B83C4D" }}
      />

      <div className="relative">
        <CmsText
          cmsKey="journeyAssessment.analysis.offerLabel"
          as="span"
          className="inline-flex items-center gap-2 rounded-full border border-[#B83C4D]/40 bg-[#B83C4D]/15 px-3 py-1 text-[12px] font-semibold uppercase tracking-wider text-[#FAF6F7]"
        />
        <CmsText
          cmsKey="journeyAssessment.analysis.offerHero"
          as="h2"
          className="mt-3 font-heading text-[26px] font-extrabold leading-snug text-white sm:text-[30px]"
        />
        <CmsText
          cmsKey="journeyAssessment.analysis.offerSub"
          as="p"
          className="mt-2 text-[17px] font-semibold text-[#FAF6F7]/85"
        />

        <div className="mt-6 flex flex-col gap-3 sm:grid sm:grid-cols-3">
          <FeatureTile
            icon={<Lock className="size-5" />}
            titleKey="journeyAssessment.analysis.feat1Title"
            bodyKey="journeyAssessment.analysis.feat1Body"
          />
          <FeatureTile
            icon={<CalendarDays className="size-5" />}
            titleKey="journeyAssessment.analysis.feat2Title"
            bodyKey="journeyAssessment.analysis.feat2Body"
          />
          <FeatureTile
            icon={<MessageCircle className="size-5" />}
            titleKey="journeyAssessment.analysis.feat3Title"
            bodyKey="journeyAssessment.analysis.feat3Body"
          />
        </div>

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
          className="group mt-5 inline-flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full px-8 text-[17px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
            boxShadow: "0 18px 40px -12px rgba(184,60,77,0.55)",
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

function FeatureTile({
  icon,
  titleKey,
  bodyKey,
}: {
  icon: React.ReactNode;
  titleKey: string;
  bodyKey: string;
}) {
  // Itzik 2026-05-29 (mobile): icon + title on the same row, title
  // bumped 16→20px (bold preserved), body bumped 14→22px, both with
  // leading 1.3. Desktop layout (icon-above-title-above-body, original
  // sizes) preserved via sm: overrides.
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#FAF6F7]"
          style={{ background: "rgba(184,60,77,0.25)" }}
          aria-hidden
        >
          {icon}
        </span>
        <CmsText
          cmsKey={titleKey}
          as="div"
          className="text-[20px] leading-[1.3] font-bold text-white sm:text-[16px] sm:leading-snug"
        />
      </div>
      <CmsText
        cmsKey={bodyKey}
        as="p"
        className="text-[22px] leading-[1.3] text-white/70 sm:text-[14px] sm:leading-[1.55]"
      />
    </div>
  );
}
