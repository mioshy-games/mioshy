"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Analysis, Locale } from "@/lib/journey/types";
import { axisLabel } from "@/lib/journey/analysis";

interface AnalysisSummaryProps {
  analysis: Analysis | null;
  locale: Locale;
  subscriptionActive?: boolean;
}

/**
 * Post-completion screen.
 * - Shows the personalized relationship analysis.
 * - If the user doesn't have an active subscription, shows the service CTA.
 * - If they're already subscribed, shows a "you're all set" message.
 */
export function AnalysisSummary({ analysis, locale, subscriptionActive = false }: AnalysisSummaryProps) {
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const isHe = locale === "he";

  if (!analysis) {
    return (
      <div dir={isHe ? "rtl" : "ltr"} className="mx-auto max-w-2xl p-10 text-center text-white/80">
        {isHe ? "מכינים את הניתוח שלכם…" : "Preparing your analysis…"}
      </div>
    );
  }

  const t = isHe
    ? {
        title: "הניתוח שלכם",
        friendship: "חברות זוגית",
        conflict: "שקט בוויכוחים",
        passion: "סיכון לירידה בתשוקה",
        loveLang: "שפת האהבה שלכם",
        topGap: "מוקד לחודש הקרוב",
        recs: "התוכנית המותאמת שלכם",
        ctaTitle: "הצטרפו לשירות וקבלו תוכנית אישית",
        ctaSub: "המסע שלכם רק מתחיל. לאחר הצטרפות תקבלו:",
        features: [
          "2–4 משימות בשבוע, שנבחרו ע\"י מומחים בזוגיות",
          "שאלונים נוספים בשבועות הראשונים — לפרופיל מדויק יותר",
          "שירות מותאם אישית לחלוטין לפי התשובות שלכם",
          "בהמשך: שיחות עם מומחים — כלול במחיר, ללא תוספת",
        ],
        price: "₪98 / חודש — ניתן לביטול בכל עת",
        cta: "הצטרפות לשירות",
        ctaLoading: "מכין תשלום…",
        activeTitle: "אתם כבר חלק מהמסע! 🎉",
        activeSub: "התוכנית האישית שלכם פעילה. המשימות השבועיות יגיעו ישירות אליכם.",
        goAccount: "לחשבון שלי",
      }
    : {
        title: "Your analysis",
        friendship: "Friendship",
        conflict: "Conflict health",
        passion: "Passion at risk",
        loveLang: "Your love language",
        topGap: "Focus this month",
        recs: "Your personalized program",
        ctaTitle: "Join the service and get your personal plan",
        ctaSub: "Your journey is just beginning. After joining you'll get:",
        features: [
          "2–4 expert-curated weekly tasks tailored to your answers",
          "Additional questionnaires in the first weeks for a sharper profile",
          "100% personalized — every task is chosen with your relationship in mind",
          "Later: expert consultations included in the price, no add-ons",
        ],
        price: "$33 / month — cancel anytime",
        cta: "Join the service",
        ctaLoading: "Preparing checkout…",
        activeTitle: "You're all set! 🎉",
        activeSub: "Your personal plan is active. Weekly tasks will be delivered to you soon.",
        goAccount: "My account",
      };

  const startCheckout = async () => {
    setCheckoutBusy(true);
    try {
      const res = await fetch("/api/billing/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "monthly",
          source: "analysis_summary",
          language: locale,
          is_israeli: locale === "he",
        }),
      });
      const data = await res.json();
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        setCheckoutBusy(false);
      }
    } catch {
      setCheckoutBusy(false);
    }
  };

  const scoreCard = (label: string, value: number, invert = false) => (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <div className="text-xs text-white/70">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${
          invert
            ? value >= 60 ? "text-rose-300" : "text-emerald-300"
            : value >= 60 ? "text-emerald-300" : "text-amber-300"
        }`}
      >
        {value}
        <span className="text-sm text-white/50">/100</span>
      </div>
    </div>
  );

  return (
    <motion.div
      dir={isHe ? "rtl" : "ltr"}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10"
    >
      {/* ── Analysis header ── */}
      <h1 className="text-3xl font-bold text-white">{t.title}</h1>

      {/* ── Narrative ── */}
      <p className="rounded-2xl border border-white/15 bg-white/5 p-5 text-base leading-relaxed text-white/90">
        {isHe ? analysis.summary.narrative_he : analysis.summary.narrative_en}
      </p>

      {/* ── Score cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {scoreCard(t.friendship, analysis.friendship_score)}
        {scoreCard(t.conflict, analysis.conflict_health)}
        {scoreCard(t.passion, analysis.passion_risk, true)}
      </div>

      {/* ── Love language ── */}
      {analysis.primary_love_language && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <div className="text-xs text-white/70">{t.loveLang}</div>
          <div className="mt-1 text-xl font-semibold text-white">
            {axisLabel(analysis.primary_love_language, locale)}
          </div>
        </div>
      )}

      {/* ── Top gap ── */}
      {analysis.top_gap && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <div className="text-xs text-white/70">{t.topGap}</div>
          <div className="mt-1 text-xl font-semibold text-white">
            {axisLabel(analysis.top_gap, locale)}
          </div>
        </div>
      )}

      {/* ── Recommendations ── */}
      <div>
        <h2 className="mb-2 text-lg font-semibold text-white">{t.recs}</h2>
        <ul className="flex flex-col gap-2">
          {analysis.summary.recommendations.map((rec) => (
            <li
              key={rec.id}
              className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/85"
            >
              {isHe ? rec.he : rec.en}
            </li>
          ))}
        </ul>
      </div>

      {/* ── CTA / Active subscriber ── */}
      <div className="rounded-2xl border border-fuchsia-500/40 bg-fuchsia-950/40 p-6">
        {subscriptionActive ? (
          <div className="flex flex-col gap-3 text-center">
            <h2 className="text-2xl font-bold text-white">{t.activeTitle}</h2>
            <p className="text-white/75">{t.activeSub}</p>
            <a
              href={`/${locale}/account`}
              className="mx-auto mt-2 rounded-2xl bg-fuchsia-600 px-6 py-3 text-sm font-semibold text-white hover:bg-fuchsia-700 transition"
            >
              {t.goAccount}
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">{t.ctaTitle}</h2>
              <p className="mt-1 text-sm text-white/70">{t.ctaSub}</p>
            </div>

            <ul className="flex flex-col gap-2">
              {t.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/85">
                  <span className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-fuchsia-400" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center text-white/90 font-medium">
              {t.price}
            </div>

            <button
              type="button"
              onClick={startCheckout}
              disabled={checkoutBusy}
              className="w-full rounded-2xl bg-fuchsia-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-fuchsia-700 active:scale-[0.98] disabled:opacity-60"
            >
              {checkoutBusy ? t.ctaLoading : t.cta}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
