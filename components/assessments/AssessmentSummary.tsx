"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import type { AiHeroBlock, DimensionScore, Locale } from "@/lib/assessments/types";

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
}

const GOLD = "#FCCA65";

export function AssessmentSummary({
  locale,
  assessmentId,
  assessmentTitleHe,
  assessmentTitleEn,
  result,
  subscriptionActive = false,
}: Props) {
  const isHe = locale === "he";
  const t = (he: string, en: string) => (isHe ? he : en);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const Arrow = isHe ? ArrowLeft : ArrowRight;

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "weekly",
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
        <p className="mt-1 text-start text-[13px] leading-snug text-white/55">
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
                  style={{ height: 160, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
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
          <div className="mt-4 flex flex-col items-center gap-1 text-center sm:mt-5">
            <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
              {isHe ? `ההמלצה שלנו להתחיל ב${lowest.he}` : `We recommend starting with ${lowest.en}`}
            </span>
          </div>
        ) : null}
      </section>

      {/* ── AI benefit-stack hero (or deterministic fallback) ──────────── */}
      {heroText ? (
        <section className="px-2 py-2">
          <p className="text-balance text-start font-heading text-[26px] font-extrabold leading-tight text-white sm:text-[32px]">
            {heroText}
          </p>
        </section>
      ) : lowest ? (
        <section className="px-2 py-2">
          <p className="text-balance text-start font-heading text-[26px] font-extrabold leading-tight text-white sm:text-[32px]">
            {isHe
              ? `מהר מאוד ${lowest.he} ביניכם תתחזק, והאינטימיות תתחדש.`
              : `Very quickly your ${lowest.en.toLowerCase()} will strengthen, and intimacy will renew.`}
          </p>
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
                <span className="flex-1 text-pretty text-start text-[22px] leading-[1.3] text-white/95 sm:text-[19px] sm:leading-[1.65]">
                  {rec}
                </span>
              </li>
            ))}
          </ul>
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
            {t("תוכנית הליווי האישית של מיאושי", "Mioshy's personal coaching program")}
          </h2>
          <p className="mt-2 text-pretty text-start text-[17px] font-semibold text-[#FAF6F7]/85">
            {t(
              "פרק אישי בכל שבוע, מומחה זמין בצ'אט, והכל מותאם בדיוק לתוצאות שלכם.",
              "A personal chapter each week, an expert available in chat, all tailored to your results.",
            )}
          </p>
          <button
            type="button"
            onClick={startCheckout}
            disabled={busy}
            className="group mt-5 inline-flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full px-8 text-[17px] font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #FCCA65 0%, #B88F32 100%)", boxShadow: "0 18px 40px -12px rgba(252,202,101,0.55)" }}
          >
            {busy ? t("רגע...", "One moment...") : t("מצטרפים לליווי", "Join the program")}
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
